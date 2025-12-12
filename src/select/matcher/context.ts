/**
 * Table context building types
 *
 * Builds a context mapping table aliases to their column types.
 * Handles CTEs, derived tables (subqueries in FROM), and JOINs.
 */

import type {
    CTEDefinition,
    DerivedTableRef,
    JoinClause,
    SubquerySelectClause,
    TableRef,
    TableSource,
} from "../../common/ast.js";

import type { DatabaseSchema, GetDefaultSchema } from "../../common/schema.js";
import type { Flatten, MatchError } from "../../common/utils.js";

import type { ExtractColumnsAsObject } from "./columns.js";

// ============================================================================
// Main Context Building
// ============================================================================

/**
 * Build a context with CTE support
 * First resolves CTEs to virtual tables, then builds the main context
 */
export type BuildTableContextWithCTEs<
    From extends TableSource,
    Joins,
    CTEs,
    Schema extends DatabaseSchema,
> = BuildCTEContext<CTEs, Schema> extends infer CTEContext
    ? CTEContext extends MatchError<string> ? CTEContext
    : BuildTableContext<From, Joins, Schema, CTEContext>
    : never;

/**
 * Build a context mapping table aliases to their column types
 * This allows us to resolve both "table.column" and "alias.column" references
 * Note: We flatten only once at the end to reduce recursion depth
 */
export type BuildTableContext<
    From extends TableSource,
    Joins,
    Schema extends DatabaseSchema,
    CTEContext = {},
> = ResolveTableSource<From, Schema, CTEContext> extends infer FromContext
    ? FromContext extends MatchError<string> ? FromContext
    : Joins extends JoinClause[] ? FlattenContext<
            MergeJoinContexts<FromContext, Joins, Schema, CTEContext>
        >
    : FromContext
    : never;

/**
 * Flatten the merged context - done once at the end
 */
export type FlattenContext<T> = T extends MatchError<string> ? T : Flatten<T>;

// ============================================================================
// CTE Context Building
// ============================================================================

/**
 * Build context from CTE definitions
 * Returns a context mapping CTE names to their column types
 */
export type BuildCTEContext<
    CTEs,
    Schema extends DatabaseSchema,
    Acc = {},
> = CTEs extends [ infer First, ...infer Rest ]
    ? First extends CTEDefinition<infer Name, infer Query>
        ? ResolveCTEQuery<Query, Schema, Acc> extends infer CTEColumns
            ? CTEColumns extends MatchError<string> ? CTEColumns
            : Rest extends CTEDefinition[] ? BuildCTEContext<
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
> = Query extends {
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

// ============================================================================
// Table Source Resolution
// ============================================================================

/**
 * Resolve a table source (can be TableRef or DerivedTableRef)
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
 * Resolve a table reference, checking CTEs first, then schema
 * TableSchema is the schema specified in the query (undefined if not specified)
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
 * Resolve a table within the database schema structure
 * If TableSchema is undefined, use the default schema
 * Note: We check for undefined first due to TypeScript 5.9+ behavior where
 * `undefined extends string` can be true in some contexts
 */
export type ResolveTableInSchema<
    Table extends string,
    Alias extends string,
    TableSchema extends string | undefined,
    Schema extends DatabaseSchema,
> = TableSchema extends undefined
    // No schema specified, use default
    ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
        ? DefaultSchema extends keyof Schema["schemas"]
            ? Table extends keyof Schema["schemas"][DefaultSchema]
                ? { [K in Alias]: Schema["schemas"][DefaultSchema][Table]; }
            : MatchError<
                `Table '${Table}' not found in default schema '${DefaultSchema}'`
            >
        : MatchError<`Default schema not found`>
    : MatchError<`Cannot determine default schema`>
    // Explicit schema specified
    : TableSchema extends string
        ? TableSchema extends keyof Schema["schemas"]
            ? Table extends keyof Schema["schemas"][TableSchema]
                ? { [K in Alias]: Schema["schemas"][TableSchema][Table]; }
            : MatchError<
                `Table '${Table}' not found in schema '${TableSchema}'`
            >
        : MatchError<`Schema '${TableSchema}' not found`>
    : MatchError<`Invalid schema type`>;

// ============================================================================
// Derived Table Resolution
// ============================================================================

/**
 * Resolve a derived table (subquery in FROM)
 */
export type ResolveDerivedTable<
    Query extends SubquerySelectClause,
    Alias extends string,
    Schema extends DatabaseSchema,
    CTEContext,
> = Query extends {
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

// ============================================================================
// JOIN Context Merging
// ============================================================================

/**
 * Merge JOIN tables into the context
 * Note: We don't flatten during recursion to reduce type depth.
 * The intersection is only flattened once at the end.
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
            : Rest extends JoinClause[] ? MergeJoinContexts<
                    Context & JoinContext,
                    Rest,
                    Schema,
                    CTEContext
                >
            : Context & JoinContext
        : never
    : Context
    : Context;
