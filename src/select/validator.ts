/**
 * SELECT Query Validator
 * 
 * This module provides comprehensive validation for SELECT queries.
 * It is separate from the matcher (QueryResult) to allow for deeper
 * validation checks without impacting the performance of result type extraction.
 * 
 * Design Philosophy:
 * -----------------
 * - QueryResult: Lightweight, focused on extracting column types for the result.
 *   Reports errors only for columns it can't resolve.
 * 
 * - ValidateSelectSQL: Comprehensive validation. Can include:
 *   - Column existence checks (same as QueryResult)
 *   - JOIN condition field validation (future)
 *   - WHERE clause field validation (future)
 *   - Type compatibility checks (future)
 * 
 * This separation allows us to add deeper validation without making
 * QueryResult slower or more complex.
 */

import type {
  SQLSelectQuery,
  SQLQuery,
  SelectClause,
  ColumnRef,
  SubqueryExpr,
  UnionClause,
  UnionClauseAny,
  SelectItem,
} from "./ast.js"

import type {
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  ComplexExpr,
  ValidatableColumnRef,
  TableRef,
  TableSource,
  DerivedTableRef,
  CTEDefinition,
  JoinClause,
  AggregateExpr,
  SubquerySelectClause,
  MapSQLTypeToTS,
} from "../common/ast.js"

import type { Flatten, MatchError, IsMatchError, ParseError, IsParseError } from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

import type { ParseSelectSQL } from "./parser.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation error with context about what failed
 */
type ValidationError<Message extends string> = MatchError<Message>

// ============================================================================
// Main Validator Entry Point
// ============================================================================

/**
 * Validate a SELECT query against a schema
 * 
 * This is the comprehensive validation entry point.
 * Returns true if valid, or an error message if invalid.
 * 
 * Unlike QueryResult which focuses on extracting the result type,
 * this validator is designed to perform all validation checks
 * including future deep validation of JOIN/WHERE clauses.
 */
export type ValidateSelectSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ParseSelectSQL<SQL> extends infer Parsed
  ? Parsed extends ParseError<infer E>
    ? E
    : Parsed extends SQLSelectQuery<infer QueryContent>
      ? ValidateQueryContent<QueryContent, Schema>
      : Parsed extends SQLQuery<infer QueryContent>
        ? ValidateQueryContent<QueryContent, Schema>
        : "Failed to parse query"
  : never

/**
 * Validate the query content (SelectClause or UnionClause)
 */
type ValidateQueryContent<
  Content,
  Schema extends DatabaseSchema,
> = Content extends UnionClauseAny
  ? ValidateUnionClause<Content, Schema>
  : Content extends SelectClause
    ? ValidateSelectClause<Content, Schema>
    : "Invalid query content"

// ============================================================================
// Union Clause Validation
// ============================================================================

/**
 * Validate a union clause
 */
type ValidateUnionClause<
  Union extends UnionClauseAny,
  Schema extends DatabaseSchema,
> = Union extends UnionClause<infer Left, infer _Op, infer Right>
  ? ValidateSelectClause<Left, Schema> extends true
    ? Right extends UnionClauseAny
      ? ValidateUnionClause<Right, Schema>
      : Right extends SelectClause
        ? ValidateSelectClause<Right, Schema>
        : "Invalid right side of union"
    : ValidateSelectClause<Left, Schema>
  : "Invalid union clause"

// ============================================================================
// Select Clause Validation
// ============================================================================

/**
 * Validate a SELECT clause
 * 
 * This validates:
 * 1. The FROM clause table exists
 * 2. All JOIN tables exist
 * 3. All selected columns exist
 * 4. (Future) JOIN conditions reference valid fields
 * 5. (Future) WHERE clause references valid fields
 */
type ValidateSelectClause<
  Select,
  Schema extends DatabaseSchema,
> = Select extends SelectClause<
  infer Columns,
  infer From,
  infer Joins,
  infer _Where,
  infer _GroupBy,
  infer _Having,
  infer _OrderBy,
  infer _Limit,
  infer _Offset,
  infer _Distinct,
  infer CTEs
>
  ? BuildValidationContext<From, Joins, CTEs, Schema> extends infer Context
    ? Context extends MatchError<infer E>
      ? E
      : ValidateColumns<Columns, Context, Schema> extends infer ColResult
        ? ColResult extends true
          // Future: Add JOIN condition validation here
          // Future: Add WHERE clause validation here
          ? true
          : ColResult
        : "Column validation failed"
    : "Context building failed"
  : "Invalid SELECT clause"

// ============================================================================
// Context Building (for validation)
// ============================================================================

/**
 * Build validation context with CTE support
 */
type BuildValidationContext<
  From extends TableSource,
  Joins,
  CTEs,
  Schema extends DatabaseSchema,
> = BuildCTEContext<CTEs, Schema> extends infer CTEContext
  ? CTEContext extends MatchError<string>
    ? CTEContext
    : BuildTableContext<From, Joins, Schema, CTEContext>
  : never

/**
 * Build context from CTE definitions
 */
type BuildCTEContext<
  CTEs,
  Schema extends DatabaseSchema,
  Acc = {}
> = CTEs extends [infer First, ...infer Rest]
  ? First extends CTEDefinition<infer Name, infer Query>
    ? ResolveCTEQuery<Query, Schema, Acc> extends infer CTEColumns
      ? CTEColumns extends MatchError<string>
        ? CTEColumns
        : Rest extends CTEDefinition[]
          ? BuildCTEContext<Rest, Schema, Acc & { [K in Name]: CTEColumns }>
          : Acc & { [K in Name]: CTEColumns }
      : never
    : Acc
  : Acc

/**
 * Resolve a CTE query to its column types
 */
type ResolveCTEQuery<
  Query extends SubquerySelectClause,
  Schema extends DatabaseSchema,
  CTEContext
> = Query extends { columns: infer Columns; from: infer From extends TableSource; joins: infer Joins }
  ? BuildTableContext<From, Joins, Schema, CTEContext> extends infer InnerContext
    ? InnerContext extends MatchError<string>
      ? InnerContext
      : ExtractColumnsAsObject<Columns, InnerContext, Schema>
    : never
  : never

/**
 * Extract columns from a SELECT as an object type
 */
type ExtractColumnsAsObject<
  Columns,
  Context,
  Schema extends DatabaseSchema
> = Columns extends "*"
  ? ExpandAllColumns<Context>
  : Columns extends SelectItem[]
    ? ExtractColumnListAsObject<Columns, Context, Schema>
    : {}

/**
 * Extract a list of columns as an object type
 */
type ExtractColumnListAsObject<
  Columns extends SelectItem[],
  Context,
  Schema extends DatabaseSchema
> = Columns extends [infer First, ...infer Rest]
  ? ExtractSingleColumnAsObject<First, Context, Schema> extends infer FirstResult
    ? Rest extends SelectItem[]
      ? ExtractColumnListAsObject<Rest, Context, Schema> extends infer RestResult
        ? Flatten<FirstResult & RestResult>
        : FirstResult
      : FirstResult
    : {}
  : {}

/**
 * Extract a single column as an object entry
 */
type ExtractSingleColumnAsObject<
  Col,
  Context,
  Schema extends DatabaseSchema
> = Col extends ColumnRef<infer Ref, infer Alias>
  ? { [K in Alias]: ResolveColumnType<Ref, Context, Schema> }
  : Col extends AggregateExpr<infer _Func, infer _Arg, infer Alias>
    ? { [K in Alias]: number }
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
      ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
      : {}

/**
 * Build table context
 */
type BuildTableContext<
  From extends TableSource,
  Joins,
  Schema extends DatabaseSchema,
  CTEContext = {},
> = ResolveTableSource<From, Schema, CTEContext> extends infer FromContext
  ? FromContext extends MatchError<string>
    ? FromContext
    : Joins extends JoinClause[]
      ? Flatten<MergeJoinContexts<FromContext, Joins, Schema, CTEContext>>
      : FromContext
  : never

/**
 * Resolve a table source
 */
type ResolveTableSource<
  Source extends TableSource,
  Schema extends DatabaseSchema,
  CTEContext = {},
> = Source extends DerivedTableRef<infer Query, infer Alias>
  ? ResolveDerivedTable<Query, Alias, Schema, CTEContext>
  : Source extends TableRef<infer Table, infer Alias, infer TableSchema>
    ? ResolveTableRefOrCTE<Table, Alias, TableSchema, Schema, CTEContext>
    : MatchError<"Invalid table source">

/**
 * Resolve table reference or CTE
 */
type ResolveTableRefOrCTE<
  Table extends string,
  Alias extends string,
  TableSchema extends string | undefined,
  Schema extends DatabaseSchema,
  CTEContext,
> = Table extends keyof CTEContext
  ? { [K in Alias]: CTEContext[Table] }
  : ResolveTableInSchema<Table, Alias, TableSchema, Schema>

/**
 * Resolve a table in the database schema
 */
type ResolveTableInSchema<
  Table extends string,
  Alias extends string,
  TableSchema extends string | undefined,
  Schema extends DatabaseSchema,
> = TableSchema extends undefined
  ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
    ? DefaultSchema extends keyof Schema["schemas"]
      ? Table extends keyof Schema["schemas"][DefaultSchema]
        ? { [K in Alias]: Schema["schemas"][DefaultSchema][Table] }
        : MatchError<`Table '${Table}' not found in default schema '${DefaultSchema}'`>
      : MatchError<`Default schema not found`>
    : MatchError<`Cannot determine default schema`>
  : TableSchema extends string
    ? TableSchema extends keyof Schema["schemas"]
      ? Table extends keyof Schema["schemas"][TableSchema]
        ? { [K in Alias]: Schema["schemas"][TableSchema][Table] }
        : MatchError<`Table '${Table}' not found in schema '${TableSchema}'`>
      : MatchError<`Schema '${TableSchema}' not found`>
    : MatchError<`Invalid schema type`>

/**
 * Resolve a derived table
 */
type ResolveDerivedTable<
  Query extends SubquerySelectClause,
  Alias extends string,
  Schema extends DatabaseSchema,
  CTEContext,
> = Query extends { columns: infer Columns; from: infer From extends TableSource; joins: infer Joins }
  ? BuildTableContext<From, Joins, Schema, CTEContext> extends infer InnerContext
    ? InnerContext extends MatchError<string>
      ? InnerContext
      : ExtractColumnsAsObject<Columns, InnerContext, Schema> extends infer DerivedColumns
        ? { [K in Alias]: DerivedColumns }
        : never
    : never
  : MatchError<"Invalid derived table query">

/**
 * Merge JOIN tables into context
 */
type MergeJoinContexts<
  Context,
  Joins extends JoinClause[],
  Schema extends DatabaseSchema,
  CTEContext = {},
> = Joins extends [infer First, ...infer Rest]
  ? First extends JoinClause<infer _Type, infer JoinTable, infer _On>
    ? ResolveTableSource<JoinTable, Schema, CTEContext> extends infer JoinContext
      ? JoinContext extends MatchError<string>
        ? JoinContext
        : Rest extends JoinClause[]
          ? MergeJoinContexts<Context & JoinContext, Rest, Schema, CTEContext>
          : Context & JoinContext
      : never
    : Context
  : Context

/**
 * Expand all columns from context
 */
type ExpandAllColumns<Context> = UnionToIntersection<
  {
    [Alias in keyof Context]: Context[Alias]
  }[keyof Context]
>

/**
 * Resolve table wildcard
 */
type ResolveTableWildcard<
  TableOrAlias extends string,
  WildcardSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema,
> = WildcardSchema extends undefined
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias]
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
  : WildcardSchema extends string
    ? WildcardSchema extends keyof Schema["schemas"]
      ? TableOrAlias extends keyof Schema["schemas"][WildcardSchema]
        ? Schema["schemas"][WildcardSchema][TableOrAlias]
        : MatchError<`Table '${TableOrAlias}' not found in schema '${WildcardSchema}'`>
      : MatchError<`Schema '${WildcardSchema}' not found`>
    : MatchError<`Invalid schema type`>

/**
 * Resolve column type (simplified for validation - just needs to check existence)
 */
type ResolveColumnType<
  Ref,
  Context,
  Schema extends DatabaseSchema,
> = Ref extends SubqueryExpr<infer _Query, infer CastType>
  ? CastType extends string ? MapSQLTypeToTS<CastType> : unknown
  : Ref extends ComplexExpr<infer _ColumnRefs, infer CastType>
    ? CastType extends string ? MapSQLTypeToTS<CastType> : unknown
    : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
      ? ResolveTableColumn<Table, Column, ColSchema, Context, Schema>
      : Ref extends UnboundColumnRef<infer Column>
        ? ResolveUnboundColumn<Column, Context>
        : unknown

/**
 * Resolve table-qualified column
 */
type ResolveTableColumn<
  TableOrAlias extends string,
  Column extends string,
  ColSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema,
> = ColSchema extends undefined
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias] extends infer Table
      ? Column extends keyof Table
        ? Table[Column]
        : MatchError<`Column '${Column}' not found in '${TableOrAlias}'`>
      : never
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
  : ColSchema extends string
    ? ColSchema extends keyof Schema["schemas"]
      ? TableOrAlias extends keyof Schema["schemas"][ColSchema]
        ? Column extends keyof Schema["schemas"][ColSchema][TableOrAlias]
          ? Schema["schemas"][ColSchema][TableOrAlias][Column]
          : MatchError<`Column '${Column}' not found in '${ColSchema}.${TableOrAlias}'`>
        : MatchError<`Table '${TableOrAlias}' not found in schema '${ColSchema}'`>
      : MatchError<`Schema '${ColSchema}' not found`>
    : MatchError<`Invalid schema type`>

/**
 * Resolve unbound column by searching all tables
 */
type ResolveUnboundColumn<
  Column extends string,
  Context,
> = FindColumnInContext<Column, Context, keyof Context>

/**
 * Search for a column across all tables
 */
type FindColumnInContext<
  Column extends string,
  Context,
  Keys,
> = [Keys] extends [never]
  ? MatchError<`Column '${Column}' not found in any table`>
  : Keys extends keyof Context
    ? Context[Keys] extends infer Table
      ? Column extends keyof Table
        ? Table[Column]
        : FindColumnInContext<Column, Context, Exclude<keyof Context, Keys>>
      : FindColumnInContext<Column, Context, Exclude<keyof Context, Keys>>
    : MatchError<`Column '${Column}' not found in any table`>

// ============================================================================
// Column Validation
// ============================================================================

/**
 * Validate all selected columns
 */
type ValidateColumns<
  Columns,
  Context,
  Schema extends DatabaseSchema,
> = Columns extends "*"
  ? true
  : Columns extends SelectItem[]
    ? ValidateColumnList<Columns, Context, Schema>
    : "Invalid columns type"

/**
 * Validate a list of columns
 */
type ValidateColumnList<
  Columns extends SelectItem[],
  Context,
  Schema extends DatabaseSchema,
> = Columns extends [infer First, ...infer Rest]
  ? ValidateSingleColumn<First, Context, Schema> extends infer FirstResult
    ? FirstResult extends true
      ? Rest extends SelectItem[]
        ? ValidateColumnList<Rest, Context, Schema>
        : true
      : FirstResult
    : "Column validation failed"
  : true

/**
 * Validate a single column
 */
type ValidateSingleColumn<
  Col,
  Context,
  Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer _Alias>
  ? ValidateColumnRef<Ref, Context, Schema>
  : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
    ? ValidateTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : Col extends AggregateExpr<infer _Func, infer Arg, infer _Alias>
      ? ValidateAggregateArg<Arg, Context, Schema>
      : true

/**
 * Validate a column reference
 */
type ValidateColumnRef<
  Ref,
  Context,
  Schema extends DatabaseSchema,
> = Ref extends SubqueryExpr<infer Query, infer _CastType>
  ? ValidateSubquery<Query, Context, Schema>
  : Ref extends ComplexExpr<infer ColumnRefs, infer _CastType>
    ? ValidateComplexExprRefs<ColumnRefs, Context, Schema>
    : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
      ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
      : Ref extends UnboundColumnRef<infer Column>
        ? ValidateUnboundColumn<Column, Context>
        : true

/**
 * Validate a subquery
 */
type ValidateSubquery<
  Query extends SubquerySelectClause,
  OuterContext,
  Schema extends DatabaseSchema,
> = Query extends { columns: infer _Columns; from: infer From extends TableSource; joins: infer Joins }
  ? BuildTableContext<From, Joins, Schema, {}> extends infer InnerContext
    ? InnerContext extends MatchError<infer E>
      ? E
      : true // Subquery structure is valid
    : true
  : true

/**
 * Validate column refs in a complex expression
 */
type ValidateComplexExprRefs<
  ColumnRefs,
  Context,
  Schema extends DatabaseSchema,
> = ColumnRefs extends []
  ? true
  : ColumnRefs extends [infer First, ...infer Rest]
    ? ValidateSingleRef<First, Context, Schema> extends infer FirstResult
      ? FirstResult extends true
        ? ValidateComplexExprRefs<Rest, Context, Schema>
        : FirstResult
      : true
    : true

/**
 * Validate a single ref in complex expr
 */
type ValidateSingleRef<
  Ref,
  Context,
  Schema extends DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
  ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
  : Ref extends UnboundColumnRef<infer Column>
    ? ValidateUnboundColumn<Column, Context>
    : true

/**
 * Validate a table-qualified column exists
 */
type ValidateTableColumn<
  TableOrAlias extends string,
  Column extends string,
  ColSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema,
> = ColSchema extends undefined
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias] extends infer Table
      ? Column extends keyof Table
        ? true
        : `Column '${Column}' not found in '${TableOrAlias}'`
      : never
    : `Table or alias '${TableOrAlias}' not found`
  : ColSchema extends string
    ? ColSchema extends keyof Schema["schemas"]
      ? TableOrAlias extends keyof Schema["schemas"][ColSchema]
        ? Column extends keyof Schema["schemas"][ColSchema][TableOrAlias]
          ? true
          : `Column '${Column}' not found in '${ColSchema}.${TableOrAlias}'`
        : `Table '${TableOrAlias}' not found in schema '${ColSchema}'`
      : `Schema '${ColSchema}' not found`
    : `Invalid schema type`

/**
 * Validate an unbound column exists in some table
 */
type ValidateUnboundColumn<
  Column extends string,
  Context,
> = ColumnExistsInContext<Column, Context, keyof Context>

/**
 * Check if column exists in any table in context
 */
type ColumnExistsInContext<
  Column extends string,
  Context,
  Keys,
> = [Keys] extends [never]
  ? `Column '${Column}' not found in any table`
  : Keys extends keyof Context
    ? Context[Keys] extends infer Table
      ? Column extends keyof Table
        ? true
        : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
      : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
    : `Column '${Column}' not found in any table`

/**
 * Validate table wildcard
 */
type ValidateTableWildcard<
  TableOrAlias extends string,
  WildcardSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema,
> = WildcardSchema extends undefined
  ? TableOrAlias extends keyof Context
    ? true
    : `Table or alias '${TableOrAlias}' not found`
  : WildcardSchema extends string
    ? WildcardSchema extends keyof Schema["schemas"]
      ? TableOrAlias extends keyof Schema["schemas"][WildcardSchema]
        ? true
        : `Table '${TableOrAlias}' not found in schema '${WildcardSchema}'`
      : `Schema '${WildcardSchema}' not found`
    : `Invalid schema type`

/**
 * Validate aggregate function argument
 */
type ValidateAggregateArg<
  Arg,
  Context,
  Schema extends DatabaseSchema,
> = Arg extends "*"
  ? true
  : Arg extends TableColumnRef<infer Table, infer Column, infer ColSchema>
    ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Arg extends UnboundColumnRef<infer Column>
      ? ValidateUnboundColumn<Column, Context>
      : true

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Convert union to intersection
 */
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// ============================================================================
// Future Extension Points
// ============================================================================

// TODO: Add JOIN condition validation
// type ValidateJoinConditions<Joins, Context, Schema>

// TODO: Add WHERE clause validation
// type ValidateWhereClause<Where, Context, Schema>

// TODO: Add GROUP BY validation
// type ValidateGroupBy<GroupBy, Context, Schema>

// TODO: Add HAVING validation
// type ValidateHaving<Having, Context, Schema>

// TODO: Add ORDER BY validation
// type ValidateOrderBy<OrderBy, Context, Schema>

