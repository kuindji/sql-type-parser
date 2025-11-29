/**
 * Type-level schema matcher
 * Takes a parsed SQL AST and a database schema, returns the result row type
 */

import type {
  SQLQuery,
  SelectClause,
  SubquerySelectClause,
  ColumnRef,
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  ComplexExpr,
  SubqueryExpr,
  ValidatableColumnRef,
  TableRef,
  TableSource,
  DerivedTableRef,
  CTEDefinition,
  JoinClause,
  AggregateExpr,
  SelectItem,
} from "./ast.js"
import type { Flatten } from "./utils.js"

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error type for unresolvable columns/tables
 */
export type MatchError<Message extends string> = {
  readonly __error: true
  readonly message: Message
}

// ============================================================================
// Schema Types
// ============================================================================

/**
 * Expected structure of a database schema
 * Uses a generic object constraint to allow interfaces without index signatures
 */
export type DatabaseSchema = {
  tables: object
}

// ============================================================================
// Main Matcher
// ============================================================================

/**
 * Match a parsed SQL query against a schema to get the result type
 */
export type MatchQuery<
  Query,
  Schema extends DatabaseSchema,
> = Query extends SQLQuery<infer Select>
  ? MatchSelectClause<Select, Schema>
  : MatchError<"Invalid query type">

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
    ? { [K in Alias]: GetAggregateResultType<Func, Arg, Context> }
    : Col extends TableWildcard<infer TableOrAlias>
      ? ResolveTableWildcard<TableOrAlias, Context>
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
  : Source extends TableRef<infer Table, infer Alias>
    ? ResolveTableRefOrCTE<Table, Alias, Schema, CTEContext>
    : MatchError<"Invalid table source">

/**
 * Resolve a table reference, checking CTEs first, then schema
 */
type ResolveTableRefOrCTE<
  Table extends string,
  Alias extends string,
  Schema extends DatabaseSchema,
  CTEContext,
> = Table extends keyof CTEContext
  ? { [K in Alias]: CTEContext[Table] }
  : Table extends keyof Schema["tables"]
    ? { [K in Alias]: Schema["tables"][Table] }
    : MatchError<`Table '${Table}' not found in schema`>

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
 * Resolve a table reference to a context entry (legacy - for backwards compat)
 * Returns { [alias]: { [column]: type } }
 */
type ResolveTableRef<
  Ref extends TableRef,
  Schema extends DatabaseSchema,
> = Ref extends TableRef<infer Table, infer Alias>
  ? Table extends keyof Schema["tables"]
  ? { [K in Alias]: Schema["tables"][Table] }
  : MatchError<`Table '${Table}' not found in schema`>
  : never

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
  : Col extends TableWildcard<infer TableOrAlias>
    ? ResolveTableWildcard<TableOrAlias, Context>
    : Col extends AggregateExpr<infer Func, infer Arg, infer Alias>
      ? { [K in Alias]: GetAggregateResultType<Func, Arg, Context> }
      : MatchError<"Unknown column type">

/**
 * Resolve a table.* or alias.* wildcard to all columns from that table
 */
type ResolveTableWildcard<
  TableOrAlias extends string,
  Context,
> = TableOrAlias extends keyof Context
  ? Context[TableOrAlias]
  : MatchError<`Table or alias '${TableOrAlias}' not found`>

/**
 * Resolve a column reference to its type
 */
type ResolveColumnRef<
  Ref,
  Context,
  Schema extends DatabaseSchema = DatabaseSchema,
> = Ref extends SubqueryExpr<infer Query, infer CastType>
  ? ResolveSubqueryExpr<Query, CastType, Context, Schema>
  : Ref extends ComplexExpr<infer ColumnRefs, infer CastType>
  ? ResolveComplexExpr<ColumnRefs, CastType, Context>
  : Ref extends TableColumnRef<infer Table, infer Column>
  ? ResolveTableColumn<Table, Column, Context>
  : Ref extends UnboundColumnRef<infer Column>
  ? ResolveUnboundColumn<Column, Context>
  : MatchError<"Invalid column reference">

/**
 * Resolve a complex expression
 * Validates all column references exist, then returns the cast type or unknown
 */
type ResolveComplexExpr<
  ColumnRefs,
  CastType,
  Context,
> = ValidateAllColumnRefs<ColumnRefs, Context> extends infer ValidationResult
  ? ValidationResult extends MatchError<string>
    ? ValidationResult
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
  ? GetAggregateResultType<Func, Arg, Context>
  : unknown

/**
 * Validate all column references in the array
 * Returns the first error found, or true if all valid
 */
type ValidateAllColumnRefs<
  ColumnRefs,
  Context,
> = ColumnRefs extends []
  ? true
  : ColumnRefs extends [infer First, ...infer Rest]
    ? ValidateSingleColumnRef<First, Context> extends infer FirstResult
      ? FirstResult extends MatchError<string>
        ? FirstResult
        : ValidateAllColumnRefs<Rest, Context>
      : never
    : true

/**
 * Validate a single column reference exists in context
 */
type ValidateSingleColumnRef<
  Ref,
  Context,
> = Ref extends TableColumnRef<infer Table, infer Column>
  ? Table extends keyof Context
    ? Context[Table] extends infer TableType
      ? Column extends keyof TableType
        ? true
        : MatchError<`Column '${Column}' not found in '${Table}'`>
      : never
    : MatchError<`Table or alias '${Table}' not found`>
  : Ref extends UnboundColumnRef<infer Column>
    ? FindColumnExists<Column, Context, keyof Context>
    : true

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
 * Map SQL type names to TypeScript types
 */
type MapSQLTypeToTS<T extends string> =
  T extends "text" | "varchar" | "char" | "character varying" | "character" ? string :
  T extends "int" | "integer" | "int4" | "int8" | "bigint" | "smallint" | "serial" | "bigserial" ? number :
  T extends "float" | "float4" | "float8" | "real" | "double precision" | "numeric" | "decimal" ? number :
  T extends "bool" | "boolean" ? boolean :
  T extends "json" | "jsonb" ? object :
  T extends "date" | "timestamp" | "timestamptz" | "time" | "timetz" ? string :
  T extends "uuid" ? string :
  T extends "bytea" ? Uint8Array :
  unknown

/**
 * Resolve a table-qualified column (table.column or alias.column)
 */
type ResolveTableColumn<
  TableOrAlias extends string,
  Column extends string,
  Context,
> = TableOrAlias extends keyof Context
  ? Context[TableOrAlias] extends infer Table
  ? Column extends keyof Table
  ? Table[Column]
  : MatchError<`Column '${Column}' not found in '${TableOrAlias}'`>
  : never
  : MatchError<`Table or alias '${TableOrAlias}' not found`>

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
> = Func extends "COUNT"
  ? number
  : Func extends "SUM" | "AVG"
  ? Arg extends "*"
  ? number
  : Arg extends TableColumnRef<infer T, infer C>
  ? ResolveTableColumn<T, C, Context> extends number
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
  : Arg extends TableColumnRef<infer T, infer C>
  ? ResolveTableColumn<T, C, Context>
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
// Convenience Type
// ============================================================================

/**
 * Parse SQL and match against schema in one step
 */
export type QueryResult<
  SQL extends string,
  Schema extends DatabaseSchema,
> = MatchQuery<import("./parser.js").ParseSQL<SQL>, Schema>

// ============================================================================
// Query Validator
// ============================================================================

/**
 * Extract error message from a MatchError (if it is one)
 */
type ExtractError<T> = T extends { readonly __error: true; readonly message: infer M }
  ? M
  : never

/**
 * Check if a type is a MatchError
 */
type IsMatchError<T> = T extends { readonly __error: true } ? true : false

/**
 * Find the first error in an object, recursively checking nested objects
 */
type FindFirstError<T> =
  // First check if T itself is an error
  IsMatchError<T> extends true
  ? ExtractError<T>
  // Then check if it's an object with potential errors
  : T extends object
  ? CollectErrors<T> extends infer Errors
  ? [Errors] extends [never]
  ? never
  : Errors
  : never
  : never

/**
 * Collect errors from all properties of an object
 */
type CollectErrors<T> = {
  [K in keyof T]: IsMatchError<T[K]> extends true
  ? ExtractError<T[K]>
  : T[K] extends object
  ? FindFirstError<T[K]>
  : never
}[keyof T]

/**
 * Validate a query result - returns true if valid, or the error message if invalid
 */
export type ValidateQuery<Result> = FindFirstError<Result> extends never
  ? true
  : FindFirstError<Result>

/**
 * Validate a SQL query against a schema in one step
 * Returns true if valid, or error message if invalid
 */
export type ValidateSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ValidateQuery<QueryResult<SQL, Schema>>

