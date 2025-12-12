/**
 * Validation Context Building
 *
 * Types for building validation context from table sources,
 * joins, and CTEs for schema matching.
 */

import type { ColumnRef, SelectItem } from "../ast.js";

import type {
    AggregateExpr,
    CTEDefinition,
    DerivedTableRef,
    JoinClause,
    MapSQLTypeToTS,
    SubquerySelectClause,
    TableColumnRef,
    TableRef,
    TableSource,
    TableWildcard,
    UnboundColumnRef,
} from "../../common/ast.js";

import type { DatabaseSchema, GetDefaultSchema } from "../../common/schema.js";
import type { Flatten, MatchError } from "../../common/utils.js";
import type { UnionToIntersection } from "./utils.js";

// ============================================================================
// Context Building (for validation)
// ============================================================================

/**
 * Build validation context with CTE support
 */
export type BuildValidationContext<
    From extends TableSource,
    Joins,
    CTEs,
    Schema extends DatabaseSchema,
> = BuildCTEContext<CTEs, Schema> extends infer CTEContext
    ? CTEContext extends MatchError<string> ? CTEContext
    : BuildTableContext<From, Joins, Schema, CTEContext>
    : never;

/**
 * Build context from CTE definitions
 */
export type BuildCTEContext<
    CTEs,
    Schema extends DatabaseSchema,
    Acc = {},
> = CTEs extends [ infer First, ...infer Rest ]
    ? First extends CTEDefinition<infer Name, infer Query>
        ? ResolveCTEQuery<Query, Schema, Acc> extends infer CTEColumns
            ? CTEColumns extends MatchError<string> ? CTEColumns
            : Rest extends CTEDefinition[]
                ? BuildCTEContext<
                    Rest,
                    Schema,
                    Acc & { [K in Name]: CTEColumns; }
                >
            : Acc & { [K in Name]: CTEColumns; }
        : never
    : Acc
    : Acc;

/**
 * Resolve a CTE query to its column types
 */
export type ResolveCTEQuery<
    Query extends SubquerySelectClause,
    Schema extends DatabaseSchema,
    CTEContext,
> = Query extends
    {
        columns: infer Columns;
        from: infer From extends TableSource;
        joins: infer Joins;
    }
    ? BuildTableContext<From, Joins, Schema, CTEContext> extends
        infer InnerContext
        ? InnerContext extends MatchError<string> ? InnerContext
        : ExtractColumnsAsObject<Columns, InnerContext, Schema>
    : never
    : never;

/**
 * Extract columns from a SELECT as an object type
 */
export type ExtractColumnsAsObject<
    Columns,
    Context,
    Schema extends DatabaseSchema,
> = Columns extends "*" ? ExpandAllColumns<Context>
    : Columns extends SelectItem[]
        ? ExtractColumnListAsObject<Columns, Context, Schema>
    : {};

/**
 * Extract a list of columns as an object type
 * Uses accumulator pattern with single flatten at the end for better performance
 */
export type ExtractColumnListAsObject<
    Columns extends SelectItem[],
    Context,
    Schema extends DatabaseSchema,
    Acc = {},
> = Columns extends [ infer First, ...infer Rest extends SelectItem[] ]
    ? ExtractSingleColumnAsObject<First, Context, Schema> extends
        infer FirstResult
        ? ExtractColumnListAsObject<Rest, Context, Schema, Acc & FirstResult>
        : Acc
    : Flatten<Acc>;

/**
 * Extract a single column as an object entry
 */
export type ExtractSingleColumnAsObject<
    Col,
    Context,
    Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer Alias>
    ? { [K in Alias]: ResolveColumnType<Ref, Context, Schema>; }
    : Col extends AggregateExpr<infer _Func, infer _Arg, infer Alias>
        ? { [K in Alias]: number; }
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
        ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : {};

/**
 * Build table context
 */
export type BuildTableContext<
    From extends TableSource,
    Joins,
    Schema extends DatabaseSchema,
    CTEContext = {},
> = ResolveTableSource<From, Schema, CTEContext> extends infer FromContext
    ? FromContext extends MatchError<string> ? FromContext
    : Joins extends JoinClause[]
        ? Flatten<MergeJoinContexts<FromContext, Joins, Schema, CTEContext>>
    : FromContext
    : never;

/**
 * Resolve a table source
 */
export type ResolveTableSource<
    Source extends TableSource,
    Schema extends DatabaseSchema,
    CTEContext = {},
> = Source extends DerivedTableRef<infer Query, infer Alias>
    ? ResolveDerivedTable<Query, Alias, Schema, CTEContext>
    : Source extends TableRef<infer Table, infer Alias, infer TableSchema>
        ? ResolveTableRefOrCTE<Table, Alias, TableSchema, Schema, CTEContext>
    : MatchError<"Invalid table source">;

/**
 * Resolve table reference or CTE
 */
export type ResolveTableRefOrCTE<
    Table extends string,
    Alias extends string,
    TableSchema extends string | undefined,
    Schema extends DatabaseSchema,
    CTEContext,
> = Table extends keyof CTEContext ? { [K in Alias]: CTEContext[Table]; }
    : ResolveTableInSchema<Table, Alias, TableSchema, Schema>;

/**
 * Resolve a table in the database schema
 */
export type ResolveTableInSchema<
    Table extends string,
    Alias extends string,
    TableSchema extends string | undefined,
    Schema extends DatabaseSchema,
> = TableSchema extends undefined
    ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
        ? DefaultSchema extends keyof Schema["schemas"]
            ? Table extends keyof Schema["schemas"][DefaultSchema]
                ? { [K in Alias]: Schema["schemas"][DefaultSchema][Table]; }
            : MatchError<
                `Table '${Table}' not found in default schema '${DefaultSchema}'`
            >
        : MatchError<`Default schema not found`>
    : MatchError<`Cannot determine default schema`>
    : TableSchema extends string
        ? TableSchema extends keyof Schema["schemas"]
            ? Table extends keyof Schema["schemas"][TableSchema]
                ? { [K in Alias]: Schema["schemas"][TableSchema][Table]; }
            : MatchError<
                `Table '${Table}' not found in schema '${TableSchema}'`
            >
        : MatchError<`Schema '${TableSchema}' not found`>
    : MatchError<`Invalid schema type`>;

/**
 * Resolve a derived table
 */
export type ResolveDerivedTable<
    Query extends SubquerySelectClause,
    Alias extends string,
    Schema extends DatabaseSchema,
    CTEContext,
> = Query extends
    {
        columns: infer Columns;
        from: infer From extends TableSource;
        joins: infer Joins;
    }
    ? BuildTableContext<From, Joins, Schema, CTEContext> extends
        infer InnerContext
        ? InnerContext extends MatchError<string> ? InnerContext
        : ExtractColumnsAsObject<Columns, InnerContext, Schema> extends
            infer DerivedColumns ? { [K in Alias]: DerivedColumns; }
        : never
    : never
    : MatchError<"Invalid derived table query">;

/**
 * Merge JOIN tables into context
 */
export type MergeJoinContexts<
    Context,
    Joins extends JoinClause[],
    Schema extends DatabaseSchema,
    CTEContext = {},
> = Joins extends [ infer First, ...infer Rest ]
    ? First extends JoinClause<infer _Type, infer JoinTable, infer _On>
        ? ResolveTableSource<JoinTable, Schema, CTEContext> extends
            infer JoinContext
            ? JoinContext extends MatchError<string> ? JoinContext
            : Rest extends JoinClause[]
                ? MergeJoinContexts<
                    Context & JoinContext,
                    Rest,
                    Schema,
                    CTEContext
                >
            : Context & JoinContext
        : never
    : Context
    : Context;

/**
 * Expand all columns from context
 */
export type ExpandAllColumns<Context> = UnionToIntersection<
    {
        [Alias in keyof Context]: Context[Alias];
    }[keyof Context]
>;

/**
 * Resolve table wildcard
 */
export type ResolveTableWildcard<
    TableOrAlias extends string,
    WildcardSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema,
> = WildcardSchema extends undefined
    ? TableOrAlias extends keyof Context ? Context[TableOrAlias]
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
    : WildcardSchema extends string
        ? WildcardSchema extends keyof Schema["schemas"]
            ? TableOrAlias extends keyof Schema["schemas"][WildcardSchema]
                ? Schema["schemas"][WildcardSchema][TableOrAlias]
            : MatchError<
                `Table '${TableOrAlias}' not found in schema '${WildcardSchema}'`
            >
        : MatchError<`Schema '${WildcardSchema}' not found`>
    : MatchError<`Invalid schema type`>;

/**
 * Resolve column type (simplified for validation - just needs to check existence)
 */
export type ResolveColumnType<
    Ref,
    Context,
    Schema extends DatabaseSchema,
> = Ref extends { subquery: SubquerySelectClause; castType?: infer CastType; }
    ? CastType extends string ? MapSQLTypeToTS<CastType> : unknown
    : Ref extends { columnRefs: unknown[]; castType?: infer CastType; }
        ? CastType extends string ? MapSQLTypeToTS<CastType> : unknown
    : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
        ? ResolveTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
        ? ResolveUnboundColumn<Column, Context>
    : unknown;

/**
 * Resolve table-qualified column
 */
export type ResolveTableColumn<
    TableOrAlias extends string,
    Column extends string,
    ColSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema,
> = ColSchema extends undefined
    ? TableOrAlias extends keyof Context
        ? Context[TableOrAlias] extends infer Table
            ? Column extends keyof Table ? Table[Column]
            : MatchError<`Column '${Column}' not found in '${TableOrAlias}'`>
        : never
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
    : ColSchema extends string
        ? ColSchema extends keyof Schema["schemas"]
            ? TableOrAlias extends keyof Schema["schemas"][ColSchema]
                ? Column extends
                    keyof Schema["schemas"][ColSchema][TableOrAlias]
                    ? Schema["schemas"][ColSchema][TableOrAlias][Column]
                : MatchError<
                    `Column '${Column}' not found in '${ColSchema}.${TableOrAlias}'`
                >
            : MatchError<
                `Table '${TableOrAlias}' not found in schema '${ColSchema}'`
            >
        : MatchError<`Schema '${ColSchema}' not found`>
    : MatchError<`Invalid schema type`>;

/**
 * Resolve unbound column by searching all tables
 */
export type ResolveUnboundColumn<
    Column extends string,
    Context,
> = FindColumnInContext<Column, Context>;

/**
 * Search for a column across all tables
 * Uses mapped type to avoid distributive conditional infinite recursion
 */
export type FindColumnInContext<
    Column extends string,
    Context,
    _Keys = keyof Context, // Kept for backwards compatibility, not used
> = {
    [K in keyof Context]: Column extends keyof Context[K] ? Context[K][Column]
        : never;
}[keyof Context] extends infer Result
    ? [ Result ] extends [ never ]
        ? MatchError<`Column '${Column}' not found in any table`>
    : Result
    : never;
