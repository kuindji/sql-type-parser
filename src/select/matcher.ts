/**
 * Type-level schema matcher for SELECT queries
 * 
 * Takes a parsed SQL SELECT AST and a database schema, returns the result row type.
 * This module handles SELECT-specific matching logic.
 */

import type {
  SQLSelectQuery,
  SelectClause,
  ColumnRef,
  LiteralExpr,
  SubqueryExpr,
  UnionClause,
  UnionClauseAny,
  UnionOperatorType,
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

import type { Flatten, MatchError, IsMatchError, DynamicQuery, DynamicQueryResult, IsStringLiteral } from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Main Matcher
// ============================================================================

/**
 * Match a parsed SQL SELECT query against a schema to get the result type
 * 
 * For dynamic queries (DynamicQuery marker), returns DynamicQueryResult
 * which allows any property access without type errors.
 */
export type MatchSelectQuery<
  Query,
  Schema extends DatabaseSchema,
> = Query extends DynamicQuery
  ? DynamicQueryResult
  : Query extends SQLSelectQuery<infer QueryContent>
    ? QueryContent extends UnionClauseAny
      ? MatchUnionClause<QueryContent, Schema>
      : QueryContent extends SelectClause
        ? MatchSelectClause<QueryContent, Schema>
        : MatchError<"Invalid query content type">
    : MatchError<"Invalid query type">

/**
 * Match a union clause and return the combined result type
 * For UNION: result is the union of both sides (same shape, TypeScript union of values)
 * For INTERSECT: result is the intersection (same shape)
 * For EXCEPT: result is the left side's shape
 */
type MatchUnionClause<
  Union extends UnionClauseAny,
  Schema extends DatabaseSchema,
> = Union extends UnionClause<infer Left, infer Op, infer Right>
  ? MatchSelectClause<Left, Schema> extends infer LeftResult
    ? LeftResult extends MatchError<string>
      ? LeftResult
      : Right extends UnionClauseAny
        ? MatchUnionClause<Right, Schema> extends infer RightResult
          ? RightResult extends MatchError<string>
            ? RightResult
            : CombineUnionResults<LeftResult, RightResult, Op>
          : never
        : Right extends SelectClause
          ? MatchSelectClause<Right, Schema> extends infer RightResult
            ? RightResult extends MatchError<string>
              ? RightResult
              : CombineUnionResults<LeftResult, RightResult, Op>
            : never
          : MatchError<"Invalid right side of union">
    : never
  : MatchError<"Invalid union clause">

/**
 * Combine results from two sides of a union operation
 * The result columns must have matching names - we return the left side's structure
 * with types that could come from either side
 */
type CombineUnionResults<
  Left,
  Right,
  Op extends UnionOperatorType,
> = Op extends "UNION" | "UNION ALL"
  ? UnionResultType<Left, Right>
  : Op extends "INTERSECT" | "INTERSECT ALL"
    ? IntersectResultType<Left, Right>
    : Op extends "EXCEPT" | "EXCEPT ALL"
      ? Left // EXCEPT returns left side's rows, so use left's type
      : Left

/**
 * For UNION: create a type that could be from either side
 * If both sides have the same column name, the result is the union of their types
 */
type UnionResultType<Left, Right> = {
  [K in keyof Left]: K extends keyof Right
    ? Left[K] | Right[K]
    : Left[K]
}

/**
 * For INTERSECT: create a type that exists in both sides
 * If both sides have the same column name, the result is their common type
 */
type IntersectResultType<Left, Right> = {
  [K in keyof Left]: K extends keyof Right
    ? Left[K] & Right[K] extends never
      ? Left[K] | Right[K]  // If no intersection, allow either
      : Left[K] & Right[K]
    : Left[K]
}

/**
 * Match a SELECT clause against the schema
 */
type MatchSelectClause<
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
  ? BuildTableContextWithCTEs<From, Joins, CTEs, Schema> extends infer Context
    ? Context extends MatchError<string>
      ? Context
      : MatchColumns<Columns, Context, Schema>
    : never
  : MatchError<"Invalid SELECT clause">

// ============================================================================
// Table Context Builder
// ============================================================================

/**
 * Build a context with CTE support
 * First resolves CTEs to virtual tables, then builds the main context
 */
type BuildTableContextWithCTEs<
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
 * Returns a context mapping CTE names to their column types
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
 * Extract columns from a SELECT as an object type (for CTE/derived table)
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
 * Extract a single column as an object entry { alias: type }
 */
type ExtractSingleColumnAsObject<
  Col,
  Context,
  Schema extends DatabaseSchema
> = Col extends ColumnRef<infer Ref, infer Alias>
  ? { [K in Alias]: ResolveColumnRef<Ref, Context, Schema> }
  : Col extends AggregateExpr<infer Func, infer Arg, infer Alias>
    ? { [K in Alias]: GetAggregateResultType<Func, Arg, Context, Schema> }
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
      ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
      : {}

/**
 * Build a context mapping table aliases to their column types
 * This allows us to resolve both "table.column" and "alias.column" references
 * Note: We flatten only once at the end to reduce recursion depth
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
      ? FlattenContext<MergeJoinContexts<FromContext, Joins, Schema, CTEContext>>
      : FromContext
  : never

/**
 * Flatten the merged context - done once at the end
 */
type FlattenContext<T> = T extends MatchError<string> ? T : Flatten<T>

/**
 * Resolve a table source (can be TableRef or DerivedTableRef)
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
 * Resolve a table reference, checking CTEs first, then schema
 * TableSchema is the schema specified in the query (undefined if not specified)
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
 * Resolve a table within the database schema structure
 * If TableSchema is undefined, use the default schema
 * Note: We check for undefined first due to TypeScript 5.9+ behavior where
 * `undefined extends string` can be true in some contexts
 */
type ResolveTableInSchema<
  Table extends string,
  Alias extends string,
  TableSchema extends string | undefined,
  Schema extends DatabaseSchema,
> = TableSchema extends undefined
  // No schema specified, use default
  ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
    ? DefaultSchema extends keyof Schema["schemas"]
      ? Table extends keyof Schema["schemas"][DefaultSchema]
        ? { [K in Alias]: Schema["schemas"][DefaultSchema][Table] }
        : MatchError<`Table '${Table}' not found in default schema '${DefaultSchema}'`>
      : MatchError<`Default schema not found`>
    : MatchError<`Cannot determine default schema`>
  // Explicit schema specified
  : TableSchema extends string
    ? TableSchema extends keyof Schema["schemas"]
      ? Table extends keyof Schema["schemas"][TableSchema]
        ? { [K in Alias]: Schema["schemas"][TableSchema][Table] }
        : MatchError<`Table '${Table}' not found in schema '${TableSchema}'`>
      : MatchError<`Schema '${TableSchema}' not found`>
    : MatchError<`Invalid schema type`>

/**
 * Resolve a derived table (subquery in FROM)
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
 * Merge JOIN tables into the context
 * Note: We don't flatten during recursion to reduce type depth.
 * The intersection is only flattened once at the end.
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

// ============================================================================
// Column Matching
// ============================================================================

/**
 * Match columns against the table context
 */
type MatchColumns<
  Columns,
  Context,
  Schema extends DatabaseSchema,
> = Columns extends "*"
  ? ExpandAllColumns<Context>
  : Columns extends SelectItem[]
    ? MatchColumnList<Columns, Context, Schema>
    : MatchError<"Invalid columns type">

/**
 * Expand * to all columns from all tables in context
 */
type ExpandAllColumns<Context> = UnionToIntersection<
  {
    [Alias in keyof Context]: Context[Alias]
  }[keyof Context]
>

/**
 * Match a list of columns
 */
type MatchColumnList<
  Columns extends SelectItem[],
  Context,
  Schema extends DatabaseSchema,
> = Columns extends [infer First, ...infer Rest]
  ? MatchSingleColumn<First, Context, Schema> extends infer FirstResult
    ? FirstResult extends MatchError<string>
      ? FirstResult
      : Rest extends SelectItem[]
        ? MatchColumnList<Rest, Context, Schema> extends infer RestResult
          ? RestResult extends MatchError<string>
            ? RestResult
            : Flatten<FirstResult & RestResult>
          : never
        : FirstResult
    : never
  : {}

/**
 * Match a single column (ColumnRef, AggregateExpr, or TableWildcard)
 * Note: We use [ColType] extends [...] to prevent distribution over union types
 */
type MatchSingleColumn<
  Col,
  Context,
  Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer Alias>
  ? ResolveColumnRef<Ref, Context, Schema> extends infer ColType
    ? [ColType] extends [MatchError<string>]
      ? { [K in Alias]: ColType }
      : { [K in Alias]: ColType }
    : never
  : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
    ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : Col extends AggregateExpr<infer Func, infer Arg, infer Alias>
      ? { [K in Alias]: GetAggregateResultType<Func, Arg, Context, Schema> }
      : MatchError<"Unknown column type">

/**
 * Resolve a table.* or alias.* or schema.table.* wildcard to all columns from that table
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
type ResolveTableWildcard<
  TableOrAlias extends string,
  WildcardSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = WildcardSchema extends undefined
  // No schema specified - use context
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias]
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
  // Schema-qualified: schema.table.* - look up directly in schema
  : WildcardSchema extends string
    ? ResolveSchemaTableWildcard<WildcardSchema, TableOrAlias, Schema>
    : MatchError<`Invalid schema type`>

/**
 * Resolve schema.table.* wildcard directly from schema
 */
type ResolveSchemaTableWildcard<
  SchemaName extends string,
  TableName extends string,
  Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
  ? TableName extends keyof Schema["schemas"][SchemaName]
    ? Schema["schemas"][SchemaName][TableName]
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
  : MatchError<`Schema '${SchemaName}' not found`>

/**
 * Resolve a column reference to its type
 */
type ResolveColumnRef<
  Ref,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = Ref extends LiteralExpr<infer Value>
  ? ResolveLiteralExpr<Value>
  : Ref extends SubqueryExpr<infer Query, infer CastType>
    ? ResolveSubqueryExpr<Query, CastType, Context, Schema>
    : Ref extends ComplexExpr<infer ColumnRefs, infer CastType>
      ? ResolveComplexExpr<ColumnRefs, CastType, Context, Schema>
      : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
        ? ResolveTableColumn<Table, Column, ColSchema, Context, Schema>
        : Ref extends UnboundColumnRef<infer Column>
          ? ResolveUnboundColumn<Column, Context>
          : MatchError<"Invalid column reference">

/**
 * Resolve a literal expression to its TypeScript type
 * The literal value is directly used as the type
 */
type ResolveLiteralExpr<Value> =
  Value extends null ? null :
  Value extends boolean ? Value :
  Value extends number ? Value :
  Value extends string ? Value :
  unknown

/**
 * Resolve a complex expression
 * Validates all column references exist, then returns the cast type or unknown
 * Note: We use [CastType] extends [undefined] to properly check for undefined,
 * because `undefined extends string` can be true in TypeScript when inferred from constraints
 */
type ResolveComplexExpr<
  ColumnRefs,
  CastType,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = ValidateAllColumnRefs<ColumnRefs, Context, Schema> extends infer ValidationResult
  ? ValidationResult extends MatchError<string>
    ? ValidationResult
    : [CastType] extends [undefined]
      ? unknown
      : CastType extends string
        ? MapSQLTypeToTS<CastType>
        : unknown
  : never

/**
 * Resolve a scalar subquery expression
 * Builds combined context (outer + inner), matches the inner query,
 * and returns the type of the first selected column
 */
type ResolveSubqueryExpr<
  Query extends SubquerySelectClause,
  CastType,
  OuterContext,
  Schema extends DatabaseSchema,
> = Query extends {
  columns: infer Columns
  from: infer From extends TableSource
  joins: infer Joins
}
  ? BuildSubqueryContext<From, Joins, Schema> extends infer InnerContext
    ? InnerContext extends MatchError<string>
      ? CastType extends string ? MapSQLTypeToTS<CastType> : InnerContext
      : MergeContexts<OuterContext, InnerContext> extends infer CombinedContext
        ? MatchSubqueryColumns<Columns, CombinedContext, Schema> extends infer ResultType
          ? ResultType extends MatchError<string>
            ? CastType extends string ? MapSQLTypeToTS<CastType> : ResultType
            : CastType extends string
              ? MapSQLTypeToTS<CastType>
              : ResultType
          : unknown
        : unknown
    : unknown
  : unknown

/**
 * Build context for a subquery, handling the looser types
 */
type BuildSubqueryContext<
  From extends TableSource,
  Joins,
  Schema extends DatabaseSchema,
> = ResolveTableSource<From, Schema, {}> extends infer FromContext
  ? FromContext extends MatchError<string>
    ? FromContext
    : Joins extends JoinClause[]
      ? FlattenContext<MergeJoinContexts<FromContext, Joins, Schema, {}>>
      : FromContext
  : never

/**
 * Merge outer and inner contexts for correlated subqueries
 * Inner context takes precedence (inner table aliases shadow outer)
 */
type MergeContexts<Outer, Inner> = Flatten<Outer & Inner>

/**
 * Match columns in a subquery and return the type of the first column
 * (scalar subqueries typically return a single value)
 */
type MatchSubqueryColumns<
  Columns,
  Context,
  Schema extends DatabaseSchema,
> = Columns extends "*"
  ? unknown // SELECT * in scalar subquery is unusual, return unknown
  : Columns extends readonly [infer First, ...infer _Rest]
    ? MatchSingleSubqueryColumn<First, Context, Schema>
    : Columns extends [infer First, ...infer _Rest]
      ? MatchSingleSubqueryColumn<First, Context, Schema>
      : Columns extends readonly (infer Item)[]
        ? MatchSingleSubqueryColumn<Item, Context, Schema>
        : Columns extends (infer Item)[]
          ? MatchSingleSubqueryColumn<Item, Context, Schema>
          : unknown

/**
 * Match a single column in a subquery context
 */
type MatchSingleSubqueryColumn<
  Col,
  Context,
  Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer _Alias>
  ? ResolveColumnRef<Ref, Context, Schema>
  : Col extends AggregateExpr<infer Func, infer Arg, infer _Alias>
    ? GetAggregateResultType<Func, Arg, Context, Schema>
    : unknown

/**
 * Validate all column references in the array
 * Returns the first error found, or true if all valid
 */
type ValidateAllColumnRefs<
  ColumnRefs,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = ColumnRefs extends []
  ? true
  : ColumnRefs extends [infer First, ...infer Rest]
    ? ValidateSingleColumnRef<First, Context, Schema> extends infer FirstResult
      ? FirstResult extends MatchError<string>
        ? FirstResult
        : ValidateAllColumnRefs<Rest, Context, Schema>
      : never
    : true

/**
 * Validate a single column reference exists in context
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
type ValidateSingleColumnRef<
  Ref,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
  ? ColSchema extends undefined
    // Use context
    ? Table extends keyof Context
      ? Context[Table] extends infer TableType
        ? Column extends keyof TableType
          ? true
          : MatchError<`Column '${Column}' not found in '${Table}'`>
        : never
      : MatchError<`Table or alias '${Table}' not found`>
    // Schema-qualified: validate directly against schema
    : ColSchema extends string
      ? ValidateSchemaTableColumn<ColSchema, Table, Column, Schema>
      : MatchError<`Invalid schema type`>
  : Ref extends UnboundColumnRef<infer Column>
    ? FindColumnExists<Column, Context, keyof Context>
    : true

/**
 * Validate a schema.table.column reference exists
 */
type ValidateSchemaTableColumn<
  SchemaName extends string,
  TableName extends string,
  ColumnName extends string,
  Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
  ? TableName extends keyof Schema["schemas"][SchemaName]
    ? ColumnName extends keyof Schema["schemas"][SchemaName][TableName]
      ? true
      : MatchError<`Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`>
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
  : MatchError<`Schema '${SchemaName}' not found`>

/**
 * Check if an unbound column exists in any table
 */
type FindColumnExists<
  Column extends string,
  Context,
  Keys,
> = [Keys] extends [never]
  ? MatchError<`Column '${Column}' not found in any table`>
  : Keys extends keyof Context
    ? Context[Keys] extends infer Table
      ? Column extends keyof Table
        ? true
        : FindColumnExists<Column, Context, Exclude<keyof Context, Keys>>
      : FindColumnExists<Column, Context, Exclude<keyof Context, Keys>>
    : MatchError<`Column '${Column}' not found in any table`>

/**
 * Resolve a table-qualified column (table.column, alias.column, or schema.table.column)
 * ColSchema is the schema from the query (undefined if not specified)
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
type ResolveTableColumn<
  TableOrAlias extends string,
  Column extends string,
  ColSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = ColSchema extends undefined
  // No schema specified - use context (which already has resolved aliases)
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias] extends infer Table
      ? Column extends keyof Table
        ? Table[Column]
        : MatchError<`Column '${Column}' not found in '${TableOrAlias}'`>
      : never
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
  // Schema-qualified: schema.table.column - look up directly in schema
  : ColSchema extends string
    ? ResolveSchemaTableColumn<ColSchema, TableOrAlias, Column, Schema>
    : MatchError<`Invalid schema type`>

/**
 * Resolve a fully qualified schema.table.column reference directly from schema
 */
type ResolveSchemaTableColumn<
  SchemaName extends string,
  TableName extends string,
  ColumnName extends string,
  Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
  ? TableName extends keyof Schema["schemas"][SchemaName]
    ? ColumnName extends keyof Schema["schemas"][SchemaName][TableName]
      ? Schema["schemas"][SchemaName][TableName][ColumnName]
      : MatchError<`Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`>
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
  : MatchError<`Schema '${SchemaName}' not found`>

/**
 * Resolve an unbound column by searching all tables in context
 */
type ResolveUnboundColumn<
  Column extends string,
  Context,
> = FindColumnInContext<Column, Context, keyof Context>

/**
 * Search for a column across all tables in context
 * Note: We use [Keys] extends [never] to prevent distributive conditional behavior
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
// Aggregate Result Types
// ============================================================================

/**
 * Get the result type of an aggregate function
 */
type GetAggregateResultType<
  Func extends string,
  Arg,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = Func extends "COUNT"
  ? number
  : Func extends "SUM" | "AVG"
    ? Arg extends "*"
      ? number
      : Arg extends TableColumnRef<infer T, infer C, infer ColSchema>
        ? ResolveTableColumn<T, C, ColSchema, Context, Schema> extends number
          ? number
          : MatchError<`SUM/AVG requires numeric column`>
        : Arg extends UnboundColumnRef<infer C>
          ? ResolveUnboundColumn<C, Context> extends number
            ? number
            : MatchError<`SUM/AVG requires numeric column`>
          : number
    : Func extends "MIN" | "MAX"
      ? Arg extends "*"
        ? unknown
        : Arg extends TableColumnRef<infer T, infer C, infer ColSchema>
          ? ResolveTableColumn<T, C, ColSchema, Context, Schema>
          : Arg extends UnboundColumnRef<infer C>
            ? ResolveUnboundColumn<C, Context>
            : unknown
      : unknown

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Convert union to intersection
 * Used to merge all table columns when SELECT *
 */
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Parse SQL and match against schema in one step
 * 
 * This is the lightweight type extraction path - focused on determining
 * the result type of a query. It reports errors for columns it can't resolve,
 * but does not perform deep validation (JOIN conditions, WHERE clauses, etc.)
 * 
 * For dynamic queries (non-literal strings or those containing template interpolations),
 * returns DynamicQueryResult which allows any property access.
 * 
 * For comprehensive validation, use ValidateSQL from ./validator.js
 */
export type QueryResult<
  SQL extends string,
  Schema extends DatabaseSchema,
> = IsStringLiteral<SQL> extends false
  ? DynamicQueryResult
  : MatchSelectQuery<import("./parser.js").ParseSelectSQL<SQL>, Schema>

// ============================================================================
// Query Result Error Checking
// ============================================================================

/**
 * Extract error message from a MatchError (if it is one)
 */
type ExtractError<T> = T extends { readonly __error: true; readonly message: infer M }
  ? M
  : never

/**
 * Check if a type could potentially be or contain a MatchError
 */
type CouldContainError<T> = T extends { readonly __error: true } ? true : false

/**
 * Find the first error in a QueryResult object
 * Checks direct properties only - MatchErrors appear at the first level
 */
type FindFirstError<T> =
  IsMatchError<T> extends true
    ? ExtractError<T>
    : T extends object
      ? CollectErrors<T> extends infer Errors
        ? [Errors] extends [never]
          ? never
          : Errors
        : never
      : never

/**
 * Collect errors from direct properties of an object
 */
type CollectErrors<T> = {
  [K in keyof T]: IsMatchError<T[K]> extends true
    ? ExtractError<T[K]>
    : CouldContainError<T[K]> extends true
      ? FindFirstError<T[K]>
      : never
}[keyof T]

/**
 * Check if a QueryResult has errors
 * Returns true if no errors, or the error message if there are errors
 * 
 * Note: This only checks errors from column resolution.
 * For comprehensive validation, use ValidateSQL from ./validator.js
 */
export type ValidateQuery<Result> = FindFirstError<Result> extends never
  ? true
  : FindFirstError<Result>

// ============================================================================
// Legacy Validation (delegates to validator)
// ============================================================================

/**
 * Validate a SQL query against a schema
 * Returns true if valid, or error message if invalid
 * 
 * This uses the dedicated validator for comprehensive validation.
 * 
 * @see ValidateSelectSQL in ./validator.js for the implementation
 */
export type ValidateSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
> = import("./validator.js").ValidateSelectSQL<SQL, Schema>


