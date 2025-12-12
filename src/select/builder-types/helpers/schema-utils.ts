/**
 * Schema Utilities
 *
 * Type-level utilities for working with database schemas and resolving
 * column types from schema definitions.
 */

import type { DatabaseSchema } from "../../../common/schema.js";
import type { ParseTableRef } from "../../parser.js";
import type { AnyBuilderStateTag, BuilderStateTag } from "./state-tags.js";
import type {
    CastReturnType,
    CastTarget,
    ExtractColumnIdentifier,
    ExtractFinalCast,
    IsUnknown,
    NormalizeCastTarget,
    SplitAlias,
    StripIdentifierQuotes,
    TrimStr,
} from "./string-utils.js";

// ============================================================================
// Schema Helpers
// ============================================================================

export type DefaultSchemaName<Schema extends DatabaseSchema> =
    Schema["defaultSchema"] extends infer D extends string ? D : never;

export type SchemaTables<
    Schema extends DatabaseSchema,
> = Schema["schemas"][DefaultSchemaName<Schema>];

export type TableNameOf<
    Schema extends DatabaseSchema,
> = Extract<keyof SchemaTables<Schema>, string>;

// ============================================================================
// Column Type Lookup
// ============================================================================

/** Look up a column's TS type from the default schema tables. */
export type ColumnTypeFromSchema<
    Schema extends DatabaseSchema,
    ColName extends string,
> = {
    [Table in keyof SchemaTables<Schema>]: ColName extends keyof SchemaTables<
        Schema
    >[Table] ? SchemaTables<Schema>[Table][ColName]
        : never;
}[keyof SchemaTables<Schema>] extends infer R
    ? [R] extends [never] ? unknown
    : R
    : unknown;

export type ColumnTypeFromTable<
    Schema extends DatabaseSchema,
    Table extends string,
    ColName extends string,
> = Table extends keyof SchemaTables<Schema>
    ? ColName extends keyof SchemaTables<Schema>[Table]
        ? SchemaTables<Schema>[Table][ColName]
    : unknown
    : unknown;

// ============================================================================
// Alias Resolution
// ============================================================================

/**
 * Resolve an alias to a table name from the contextSQL.
 * Given contextSQL like "FROM users u LEFT JOIN orders o ON ..." and alias "u",
 * returns "users".
 */
export type ResolveAliasToTable<
    Context extends string | undefined,
    Alias extends string,
> = Context extends string
    ? ExtractAliasFromFrom<Context, Alias> extends infer T
        ? [T] extends [never] ? ExtractAliasFromJoins<Context, Alias>
        : T
    : ExtractAliasFromJoins<Context, Alias>
    : never;

/**
 * Extract the FROM table spec and parse alias from it.
 */
export type ExtractAliasFromFrom<
    Context extends string,
    Alias extends string,
> = Context extends `${string}FROM ${infer FromContent}`
    ? ExtractTableSpecBeforeKeyword<FromContent> extends
        infer TableSpec extends string ? ParseTableAlias<TableSpec, Alias>
    : never
    : never;

/**
 * Get table spec before next SQL keyword (JOIN, WHERE, etc.)
 */
export type ExtractTableSpecBeforeKeyword<S extends string> = S extends
    `${infer Before} INNER JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} LEFT JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} RIGHT JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} FULL JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} CROSS JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} JOIN ${string}` ? TrimStr<Before>
    : S extends `${infer Before} WHERE ${string}` ? TrimStr<Before>
    : S extends `${infer Before} GROUP ${string}` ? TrimStr<Before>
    : S extends `${infer Before} ORDER ${string}` ? TrimStr<Before>
    : S extends `${infer Before} LIMIT ${string}` ? TrimStr<Before>
    : S extends `${infer Before} OFFSET ${string}` ? TrimStr<Before>
    : S extends `${infer Before} HAVING ${string}` ? TrimStr<Before>
    : S extends `${infer Before} UNION ${string}` ? TrimStr<Before>
    : TrimStr<S>;

/**
 * Parse "users u" or "users AS u" or "schema.users u" to extract table for alias.
 * Returns the actual table name if the alias matches.
 */
export type ParseTableAlias<
    Spec extends string,
    Alias extends string,
> =
    // Handle "table AS alias" format
    TrimStr<Spec> extends `${infer Table} AS ${infer FoundAlias}`
        ? TrimStr<FoundAlias> extends Alias ? ExtractTableName<TrimStr<Table>>
        : never
        // Handle "table as alias" format (lowercase)
        : TrimStr<Spec> extends `${infer Table} as ${infer FoundAlias}`
            ? TrimStr<FoundAlias> extends Alias
                ? ExtractTableName<TrimStr<Table>>
            : never
        // Handle "table alias" format (space-separated, match last token as alias)
        : TrimStr<Spec> extends `${infer Table} ${infer FoundAlias}`
            ? TrimStr<FoundAlias> extends Alias
                ? ExtractTableName<TrimStr<Table>>
            : never
        : never;

/**
 * Extract actual table name (handle schema.table and quoted identifiers).
 */
export type ExtractTableName<S extends string> = S extends
    `${infer _Schema}.${infer Table}` ? StripIdentifierQuotes<Table>
    : StripIdentifierQuotes<S>;

/**
 * Search JOINs in the context for alias.
 */
export type ExtractAliasFromJoins<
    Context extends string,
    Alias extends string,
> = Context extends `${string}JOIN ${infer JoinContent} ON ${infer AfterOn}`
    ? ExtractTableSpecBeforeKeyword<JoinContent> extends
        infer JoinSpec extends string
        ? ParseTableAlias<JoinSpec, Alias> extends infer T extends string ? T
        : ExtractAliasFromJoins<`JOIN ${AfterOn}`, Alias>
    : ExtractAliasFromJoins<`JOIN ${AfterOn}`, Alias>
    : never;

/**
 * Best-effort extraction of the primary FROM table.
 * Falls back to parsing the recorded contextSQL if fromTable is not set.
 */
export type PrimaryTable<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
> = State["fromTable"] extends infer From extends string ? From
    : State["contextSQL"] extends `FROM ${infer FromSrc}`
        ? ParseTableRef<FromSrc> extends { table: infer T extends string; } ? T
        : never
    : never;

/**
 * Helper: resolve table name for a qualified column expression.
 * First tries direct table lookup, then alias resolution from context.
 */
export type ResolveTableForQualifiedColumn<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    TableOrAlias extends string,
> =
    // First check if it's a direct table name
    StripIdentifierQuotes<TableOrAlias> extends keyof SchemaTables<Schema>
        ? StripIdentifierQuotes<TableOrAlias>
        // Otherwise try to resolve as alias from contextSQL
        : ResolveAliasToTable<
            State["contextSQL"],
            TableOrAlias
        > extends infer Resolved extends string ? Resolved
        : never;

// ============================================================================
// Column Type Resolution
// ============================================================================

/** Compute the result type for a simple column expression. */
export type ColumnTypeForExpr<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Expr extends string,
> = CastTarget<Expr> extends infer Cast extends string ? CastReturnType<Cast>
    : Expr extends `${string}::${string}` ? string
    : Expr extends `CAST(${string}` ? string
    : Expr extends `${infer TableOrAlias}.${string}`
        ? ResolveTableForQualifiedColumn<
            Schema,
            State,
            TableOrAlias
        > extends infer ResolvedTable extends string ? ColumnTypeFromTable<
                Schema,
                ResolvedTable,
                ExtractColumnIdentifier<Expr>
            > extends infer ColType extends unknown
                ? IsUnknown<ColType> extends true ? ColumnTypeFromSchema<
                        Schema,
                        ExtractColumnIdentifier<Expr>
                    >
                : ColType
            : unknown
        : ColumnTypeFromSchema<Schema, ExtractColumnIdentifier<Expr>>
    : PrimaryTable<Schema, State> extends infer From extends string
        ? ColumnTypeFromTable<
            Schema,
            From,
            ExtractColumnIdentifier<Expr>
        > extends infer FromType extends unknown
            ? IsUnknown<FromType> extends true
                ? ColumnTypeFromSchema<Schema, ExtractColumnIdentifier<Expr>>
            : FromType
        : unknown
    : ColumnTypeFromSchema<Schema, ExtractColumnIdentifier<Expr>>;

export type ExpressionType<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Expr extends string,
> = ExtractFinalCast<Expr> extends infer Cast extends string
    ? CastReturnType<NormalizeCastTarget<Cast>>
    : Expr extends `CAST(${string} AS ${infer Cast})${string}`
        ? CastReturnType<NormalizeCastTarget<Cast>>
    : Expr extends `COUNT${string}` ? number
    : Expr extends `(SELECT COUNT${string})` ? number
    : ColumnTypeForExpr<Schema, State, Expr> extends never ? unknown
    : ColumnTypeForExpr<Schema, State, Expr>;

export type ColumnRow<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Col extends string,
> = SplitAlias<Col> extends [
    infer Expr extends string,
    infer Alias extends string | undefined,
] ? {
        [
            K in Alias extends string ? StripIdentifierQuotes<Alias>
                : ExtractColumnIdentifier<Expr>
        ]: ExpressionType<Schema, State, Expr>;
    }
    : {
        [K in ExtractColumnIdentifier<Col>]: ExpressionType<
            Schema,
            State,
            Col
        >;
    };
