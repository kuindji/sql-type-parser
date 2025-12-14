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
 * Input is expected to be normalized (keywords uppercased).
 *
 * The challenge with JOIN clauses is that we need to handle both:
 * - "table JOIN ..." (plain join)
 * - "table LEFT JOIN ..." (compound join)
 * - "table JOIN ... LEFT JOIN ..." (multiple joins)
 *
 * TypeScript's template literal matching finds the FIRST occurrence of the
 * pattern. So we first match on ` JOIN ` which catches ANY join keyword at
 * its earliest occurrence. If the result ends with a join modifier (LEFT,
 * INNER, etc.), we strip it using TrimJoinModifier.
 */
export type ExtractTableSpecBeforeKeyword<S extends string> =
    // Match any JOIN first (catches earliest join in the string)
    S extends `${infer Before} JOIN ${string}` ? TrimJoinModifier<TrimStr<Before>>
    // Non-join terminators
    : S extends `${infer Before} WHERE ${string}` ? TrimStr<Before>
    : S extends `${infer Before} GROUP ${string}` ? TrimStr<Before>
    : S extends `${infer Before} ORDER ${string}` ? TrimStr<Before>
    : S extends `${infer Before} LIMIT ${string}` ? TrimStr<Before>
    : S extends `${infer Before} OFFSET ${string}` ? TrimStr<Before>
    : S extends `${infer Before} HAVING ${string}` ? TrimStr<Before>
    : S extends `${infer Before} UNION ${string}` ? TrimStr<Before>
    : TrimStr<S>;

/**
 * Strip trailing join modifiers (LEFT, INNER, RIGHT, FULL, CROSS, OUTER)
 * from a string. These appear when matching `${Before} JOIN` on compound
 * joins like "table LEFT JOIN" where Before = "table LEFT".
 */
type TrimJoinModifier<S extends string> =
    S extends `${infer Rest} LEFT` ? TrimStr<Rest>
    : S extends `${infer Rest} INNER` ? TrimStr<Rest>
    : S extends `${infer Rest} RIGHT` ? TrimStr<Rest>
    : S extends `${infer Rest} FULL` ? TrimStr<Rest>
    : S extends `${infer Rest} CROSS` ? TrimStr<Rest>
    : S extends `${infer Rest} OUTER` ? TrimStr<Rest>
    : S;

/**
 * Parse "users u" or "users AS u" or "schema.users u" to extract table for alias.
 * Returns the actual table name if the alias matches.
 * Input is expected to be normalized (AS keyword uppercased).
 */
export type ParseTableAlias<
    Spec extends string,
    Alias extends string,
> =
    // Handle "table AS alias" format
    TrimStr<Spec> extends `${infer Table} AS ${infer FoundAlias}`
        ? TrimStr<FoundAlias> extends Alias ? ExtractTableName<TrimStr<Table>>
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
 * Input is expected to be normalized (JOIN/ON keywords uppercased).
 */
export type ExtractAliasFromJoins<
    Context extends string,
    Alias extends string,
> = Context extends `${string}JOIN ${infer JoinContent} ON ${infer AfterOn}`
    ? ExtractJoinAliasMatch<JoinContent, AfterOn, Alias>
    : never;

/**
 * Helper for ExtractAliasFromJoins to reduce duplication.
 */
type ExtractJoinAliasMatch<
    JoinContent extends string,
    AfterOn extends string,
    Alias extends string,
> = ExtractTableSpecBeforeKeyword<JoinContent> extends infer JoinSpec extends string
    ? ParseTableAlias<JoinSpec, Alias> extends infer T extends string ? T
    : ExtractAliasFromJoins<`JOIN ${AfterOn}`, Alias>
    : ExtractAliasFromJoins<`JOIN ${AfterOn}`, Alias>;

/**
 * Join types that produce nullable columns.
 * LEFT/FULL joins can produce NULL when there's no matching row.
 */
type NullableJoinKeyword = "LEFT JOIN" | "LEFT OUTER JOIN" | "FULL JOIN" | "FULL OUTER JOIN";

/**
 * Check if an alias comes from a nullable join (LEFT/FULL) in the context.
 * Searches through JOIN clauses to find a match for the alias and checks
 * if it's preceded by LEFT or FULL.
 */
export type IsNullableJoinAlias<
    Context extends string | undefined,
    Alias extends string,
> = Context extends string
    ? CheckJoinNullability<Context, Alias>
    : false;

/**
 * Internal helper to check if ParseTableAlias found a match (not never).
 * Using [T] extends [never] pattern to avoid distributive conditional type issues.
 */
type IsAliasMatch<T> = [T] extends [never] ? false : true;

/**
 * Internal helper to check join nullability.
 * Searches for patterns like "LEFT JOIN table alias" or "LEFT JOIN table AS alias".
 * Input is expected to be normalized (keywords uppercased).
 */
type CheckJoinNullability<
    Context extends string,
    Alias extends string,
> =
    // LEFT OUTER JOIN
    Context extends `${string}LEFT OUTER JOIN ${infer JoinContent} ON ${infer AfterOn}`
        ? CheckJoinMatch<JoinContent, AfterOn, Alias>
    // LEFT JOIN
    : Context extends `${string}LEFT JOIN ${infer JoinContent} ON ${infer AfterOn}`
        ? CheckJoinMatch<JoinContent, AfterOn, Alias>
    // FULL OUTER JOIN
    : Context extends `${string}FULL OUTER JOIN ${infer JoinContent} ON ${infer AfterOn}`
        ? CheckJoinMatch<JoinContent, AfterOn, Alias>
    // FULL JOIN
    : Context extends `${string}FULL JOIN ${infer JoinContent} ON ${infer AfterOn}`
        ? CheckJoinMatch<JoinContent, AfterOn, Alias>
    : false;

/**
 * Helper to check if join content matches the alias and recurse if not.
 */
type CheckJoinMatch<
    JoinContent extends string,
    AfterOn extends string,
    Alias extends string,
> = ExtractTableSpecBeforeKeyword<JoinContent> extends infer JoinSpec extends string
    ? IsAliasMatch<ParseTableAlias<JoinSpec, Alias>> extends true ? true
    : CheckJoinNullability<`JOIN ${AfterOn}`, Alias>
    : CheckJoinNullability<`JOIN ${AfterOn}`, Alias>;

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

/**
 * Apply nullability to a column type if the alias comes from a LEFT/FULL JOIN.
 */
type ApplyJoinNullability<
    State extends AnyBuilderStateTag,
    TableOrAlias extends string,
    ColType,
> = IsNullableJoinAlias<State["contextSQL"], TableOrAlias> extends true
    ? ColType | null
    : ColType;

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
                : ApplyJoinNullability<State, StripIdentifierQuotes<TableOrAlias>, ColType>
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

/**
 * Expand all columns from a table given its resolved name.
 * Returns all columns from the table in the default schema.
 */
export type ExpandTableColumns<
    Schema extends DatabaseSchema,
    TableName extends string,
> = TableName extends keyof SchemaTables<Schema>
    ? SchemaTables<Schema>[TableName]
    : {};

/**
 * Expand alias.* wildcard to all columns from the aliased table.
 * Resolves the alias using contextSQL, then expands all columns.
 */
export type ExpandAliasWildcard<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Alias extends string,
> = ResolveAliasToTable<
    State["contextSQL"],
    StripIdentifierQuotes<Alias>
> extends infer ResolvedTable extends string
    ? ExpandTableColumns<Schema, ResolvedTable>
    : StripIdentifierQuotes<Alias> extends keyof SchemaTables<Schema>
        ? SchemaTables<Schema>[StripIdentifierQuotes<Alias>]
    : {};

/**
 * Expand * wildcard to all columns from the primary FROM table.
 */
export type ExpandAllWildcard<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
> = PrimaryTable<Schema, State> extends infer FromTable extends string
    ? ExpandTableColumns<Schema, FromTable>
    : {};

export type ColumnRow<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Col extends string,
> = TrimStr<Col> extends "*"
    ? ExpandAllWildcard<Schema, State>
    : TrimStr<Col> extends `${infer Alias}.*`
        ? ExpandAliasWildcard<Schema, State, Alias>
    : SplitAlias<Col> extends [
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
