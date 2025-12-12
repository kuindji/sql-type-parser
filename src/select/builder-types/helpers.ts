/**
 * SELECT Query Builder - Type-Level State & Utilities
 *
 * Phase 2 focuses on type-level pieces only:
 * - Core builder state types
 * - Join strictness and replacement rules
 * - State-to-AST conversion scaffolding
 *
 * Runtime builder implementation is added in Phase 3 and later.
 */

import type { MapSQLTypeToTS } from "../../common/ast.js";
import type { ConditionTreeBuilder } from "../../common/builder.js";
import type { QueryParamValue } from "../../common/builder.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type { Flatten, IsUnion, UnionQueryError } from "../../common/utils.js";
import type { ParseTableRef } from "../parser.js";
import type { SelectQueryBuilder } from "./builder.js";
import type { BuilderFullRow } from "./return-type.js";

// ============================================================================
// Lightweight Builder State Tag
// ============================================================================

/**
 * Lightweight, non-AST builder state tag used for result typing.
 *
 * This deliberately does NOT mirror the full SQL AST. It only tracks:
 * - `fromTable`: the primary table name (for simple table-driven cases)
 * - `row`: the current inferred result row type
 * - `contextSQL`: the FROM/JOIN fragment used to build a per-column
 *   synthetic query for `QueryResult`, so that aliasing and joins are
 *   resolved by the existing parser + matcher.
 *
 * The heavy AST-centric state types (`SelectBuilderState`, etc.) below
 * remain available for future, more advanced builder phases, but are not
 * threaded through the runtime builder generics to keep TypeScript
 * instantiation depth manageable.
 */
export interface BuilderStateTag<
    FromTable extends string | undefined = string | undefined,
    Row = unknown,
    ContextSQL extends string | undefined = string | undefined,
> {
    readonly fromTable: FromTable;
    readonly row: Row;
    readonly contextSQL: ContextSQL;
}

/**
 * Lightweight type-level tag that tracks the assembled SQL fragments for a
 * builder. This is used only for type-level SQL reconstruction and optional
 * validation; it has no runtime representation.
 *
 * All fields store clause *fragments* (for example, `select` stores the column
 * list without the SELECT keyword) so that assembly logic can mirror
 * `assembleSelectSQL` closely.
 */
export interface BuilderSqlTag<
    Select extends string | ClauseList | undefined = undefined,
    From extends string | undefined = undefined,
    Joins extends string | ClauseList | undefined = undefined,
    Where extends string | undefined = undefined,
    GroupBy extends string | undefined = undefined,
    Having extends string | undefined = undefined,
    OrderBy extends string | undefined = undefined,
    Limit extends number | undefined = undefined,
    Params extends readonly QueryParamValue[] = readonly [],
    Offset extends number | undefined = undefined,
    NamedParams extends Record<string, QueryParamValue> | undefined = undefined,
> {
    readonly select: Select;
    readonly from: From;
    readonly joins: Joins;
    readonly where: Where;
    readonly groupBy: GroupBy;
    readonly having: Having;
    readonly orderBy: OrderBy;
    readonly limit: Limit;
    readonly params: Params;
    readonly offset: Offset;
    readonly namedParams: NamedParams;
}

/**
 * Initial empty SQL tag: no clauses present.
 */
export type EmptySqlState = BuilderSqlTag;

/**
 * Error SQL tag that marks the builder as having a union type error.
 * This propagates through the builder chain and results in UnionQueryError
 * when the final result type is extracted.
 */
export type UnionSqlError = BuilderSqlTag<
    "__UNION_ERROR__",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    readonly [],
    undefined,
    undefined
>;

/**
 * Check if an SQL tag is a union error marker.
 */
export type IsUnionSqlError<Sql extends AnyBuilderSqlTag> =
    Sql["select"] extends "__UNION_ERROR__" ? true : false;

/**
 * Initial lightweight builder state: no FROM table, no context, and an
 * empty result row.
 */
export type EmptyBuilderState = BuilderStateTag<undefined, {}, undefined>;

/**
 * Constraint type for generic functions accepting any BuilderSqlTag.
 * Use this instead of `BuilderSqlTag<any, any, ...>` to avoid verbose notation
 * and ensure resilience to future library changes.
 */
export type AnyBuilderSqlTag = BuilderSqlTag<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
>;

/**
 * Constraint type for generic functions accepting any BuilderStateTag.
 * Use this instead of `BuilderStateTag<any, any, any>` to avoid verbose notation
 * and ensure resilience to future library changes.
 */
export type AnyBuilderStateTag = BuilderStateTag<any, any, any>;

// Schema helpers for default-schema table lookup (used only for simple
// table-name resolution; alias and join handling comes from QueryResult +
// parser/matcher via contextSQL).

export type DefaultSchemaName<Schema extends DatabaseSchema> =
    Schema["defaultSchema"] extends infer D extends string ? D : never;

export type SchemaTables<
    Schema extends DatabaseSchema,
> = Schema["schemas"][DefaultSchemaName<Schema>];

export type TableNameOf<
    Schema extends DatabaseSchema,
> = Extract<keyof SchemaTables<Schema>, string>;

// Column mapping helpers – implemented by delegating to QueryResult on a
// per-column synthetic query that uses the builder's contextSQL so that
// aliases, joins, expressions, and casts are handled by the existing
// parser + matcher.

export type IsTuple<T extends readonly any[]> = number extends T["length"]
    ? false
    : true;

/**
 * Convert a union of types into an intersection (A | B -> A & B).
 * Used to merge column rows derived from non-tuple string arrays.
 */
export type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;

export type ToStringArray<T extends string | readonly string[]> =
    // Preserve tuple shapes to keep literal ordering for SQL reconstruction.
    T extends
        readonly [ infer First extends string, ...infer Rest extends string[] ]
        ? [ First, ...Rest ]
        : T extends readonly (infer S extends string)[] ? S[]
        : [ T ];

export type ColumnQuery<
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> = State["contextSQL"] extends string ? `SELECT ${Col} ${State["contextSQL"]}`
    : never;

/**
 * Helper to detect literal string types (as opposed to plain `string`).
 */
export type IsLiteralString<T> = T extends string
    ? string extends T ? false : true
    : false;

/** Detect `unknown` specifically (not just assignable to unknown). */
export type IsUnknown<T> = unknown extends T ? [ T ] extends [ unknown ] ? true
    : false
    : false;

/** Strip simple PostgreSQL-style casts (`expr::type`). */
export type StripCast<S extends string> = S extends `${infer Base}::${string}`
    ? Base
    : S;

/**
 * Remove surrounding double quotes from an identifier segment.
 * Keeps the inner content intact so case-sensitive names survive.
 */
export type StripIdentifierQuotes<S extends string> = S extends
    `"${infer Inner}"` ? Inner
    : S;

export type TrimStr<S extends string> = S extends ` ${infer T}` ? TrimStr<T>
    : S extends `${infer T} ` ? TrimStr<T>
    : S;

export type FirstToken<S extends string> = TrimStr<S> extends
    `${infer Head} ${string}` ? Head
    : TrimStr<S>;

export type StripAliasFromCast<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${string}` ? StripAliasFromCast<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${string}`
        ? StripAliasFromCast<TrimStr<Before>>
    : S;

export type StripCastParams<S extends string> = S extends
    `${infer Base}(${string})` ? Base
    : S;

export type NormalizeCastTarget<S extends string> = Lowercase<
    StripCastParams<FirstToken<StripAliasFromCast<TrimStr<S>>>>
>;

/**
 * Extract the final (outermost) cast type from an expression.
 * The naive pattern `${string}::${infer Cast}` matches the FIRST ::,
 * but we need the LAST one for expressions like `sum(x::int)::float8`.
 */
export type ExtractFinalCast<S extends string> = S extends
    `${string}::${infer After}`
    ? After extends `${string}::${infer _Deeper}` ? ExtractFinalCast<After>
    : After
    : undefined;

export type CastTarget<Expr extends string> = ExtractFinalCast<Expr> extends
    infer Cast extends string ? NormalizeCastTarget<Cast>
    : Expr extends `CAST(${string} AS ${infer Cast})${string}`
        ? NormalizeCastTarget<Cast>
    : undefined;

export type CastReturnType<Cast extends string> = MapSQLTypeToTS<Cast> extends
    infer M ? IsUnknown<M> extends true ? string
    : M
    : string;

export type ExtractAlias<S extends string> = TrimStr<S> extends
    `${infer _Before} AS ${infer After}`
    ? ExtractAlias<TrimStr<After>> extends infer Alias extends string ? Alias
    : TrimStr<After>
    : TrimStr<S> extends `${infer _Before} as ${infer After}`
        ? ExtractAlias<TrimStr<After>> extends infer Alias extends string
            ? Alias
        : TrimStr<After>
    : undefined;

export type ExprWithoutAlias<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${infer _After}` ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${infer _After}`
        ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S>;

export type SplitAlias<S extends string> = [
    ExprWithoutAlias<S>,
    ExtractAlias<S>,
];

export type StripAliasIdentifier<S extends string> = S extends
    `${infer _Expr} AS ${infer Alias}` ? TrimStr<Alias>
    : S;

/** Extract the final identifier part of a column expression (alias wins). */
export type ExtractColumnIdentifier<S extends string> = SplitAlias<S> extends [
    infer Expr extends string,
    infer Alias extends string | undefined,
] ? Alias extends string ? StripIdentifierQuotes<Alias>
    : StripIdentifierQuotes<
        StripCast<Expr> extends `${string}.${infer Tail}` ? Tail
            : StripCast<Expr>
    >
    : StripIdentifierQuotes<StripCast<S>>;

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
    ? [ R ] extends [ never ] ? unknown
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
        ? [ T ] extends [ never ] ? ExtractAliasFromJoins<Context, Alias>
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
    State extends BuilderStateTag<any, any, any>,
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
    State extends BuilderStateTag<any, any, any>,
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

/** Compute the result type for a simple column expression. */
export type ColumnTypeForExpr<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
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
    State extends BuilderStateTag<any, any, any>,
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
    State extends BuilderStateTag<any, any, any>,
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

/**
 * Convert an array of column strings to a row type.
 * Uses accumulator pattern with single flatten at the end for better performance.
 */
export type ColumnsArrayToRow<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Cols extends readonly string[],
    Acc = {},
> = Cols extends readonly [
    infer First extends string,
    ...infer Rest extends readonly string[],
] ? ColumnsArrayToRow<
        Schema,
        State,
        Rest,
        // NOTE: we intersect with ColumnRow<...> here, but do not try to
        // over‑optimize alias resolution at the type level; complex alias
        // cases fall back to whatever QueryResult can infer from contextSQL.
        Acc & ColumnRow<Schema, State, First>
    >
    : Flatten<Acc>; // Single flatten at the end

type ColumnsToRow<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    ColSpec extends string | readonly string[],
> =
    // Single column selection.
    ColSpec extends string ? ColumnRow<Schema, State, ColSpec>
        // Tuple/readonly array of columns – map each entry to its column row and
        // intersect the results. For non-literal arrays we deliberately fall
        // back to per-entry union via ColumnRow instead of dropping typing.
        : ColSpec extends readonly (infer S extends string)[]
            ? IsTuple<ColSpec> extends true
                ? ColumnsArrayToRow<Schema, State, ColSpec>
            : UnionToIntersection<ColumnRow<Schema, State, S>>
        : {};

/**
 * Error state for when union types are detected in column specifications.
 * This prevents TypeScript from distributing over unions and causing
 * exponential type computation.
 */
type UnionColumnsError = BuilderStateTag<
    undefined,
    UnionQueryError,
    undefined
>;

/**
 * Internal helper that adds columns to the builder state.
 * Does not check for unions - use AddColumnsForSchema instead.
 */
type AddColumnsForSchemaInternal<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    ColSpec extends string | readonly string[],
> = BuilderStateTag<
    State["fromTable"],
    State["row"] & ColumnsToRow<Schema, State, ColSpec>,
    State["contextSQL"]
>;

/**
 * Add columns to the builder state, with union type detection.
 *
 * When ColSpec is a union type (e.g., from template literals with union interpolations
 * like `"GBP" | "USD"`), this returns UnionColumnsError early to prevent
 * exponential type computation from TypeScript distributing over the union.
 *
 * Users should cast such values to `string` to bypass type checking, or use
 * a single literal value.
 */
export type AddColumnsForSchema<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    ColSpec extends string | readonly string[],
> = IsUnion<ColSpec> extends true ? UnionColumnsError
    : AddColumnsForSchemaInternal<Schema, State, ColSpec>;

// ---------------------------------------------------------------------------
// Validation helpers (lightweight, per-fragment)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lightweight SQL assembly helpers (type-level)
// ---------------------------------------------------------------------------

/**
 * Join an array of string literal parts with a separator.
 * Optimized with tail-call accumulator pattern.
 */
type JoinWith<
    Parts extends string[],
    Sep extends string,
    Acc extends string = "",
> = Parts extends [ infer First extends string, ...infer Rest extends string[] ]
    ? JoinWith<
        Rest,
        Sep,
        Acc extends "" ? First : `${Acc}${Sep}${First}`
    >
    : Acc;

/**
 * Convert column spec (string or string[]) into a comma-separated column list.
 */
export type ColsToString<
    Cols extends string | readonly string[],
> = ToStringArray<Cols> extends infer Arr extends string[] ? JoinWith<Arr, ", ">
    : "";

// Clause fragment helpers with ID-aware lists to support removal.
export type SqlClausePart = { readonly id: string; readonly sql: string; };
export type ClauseList = readonly SqlClausePart[];

export type NormalizeClauseList<Value> = Value extends ClauseList ? Value
    : Value extends string ? readonly [
            { readonly id: "__legacy"; readonly sql: Value; },
        ]
    : readonly [];

export type ClauseListOrUndefined<Parts extends ClauseList> =
    Parts["length"] extends 0 ? undefined
        : Parts;

export type ClauseListToString<
    Parts extends ClauseList,
    Sep extends string,
    Acc extends string = "",
> = Parts extends readonly [
    infer First extends SqlClausePart,
    ...infer Rest extends ClauseList,
] ? ClauseListToString<
        Rest,
        Sep,
        Acc extends "" ? First["sql"] : `${Acc}${Sep}${First["sql"]}`
    >
    : Acc;

export type ClauseListStringOrUndefined<
    Parts extends ClauseList,
    Sep extends string,
> = Parts["length"] extends 0 ? undefined : ClauseListToString<Parts, Sep>;

export type UpsertClausePart<
    Parts extends ClauseList,
    Id extends string,
    Sql extends string,
    Seen extends boolean = false,
    Acc extends ClauseList = readonly [],
> = Parts extends readonly [
    infer First extends SqlClausePart,
    ...infer Rest extends ClauseList,
] ? First["id"] extends Id ? UpsertClausePart<
            Rest,
            Id,
            Sql,
            true,
            readonly [
                ...Acc,
                { readonly id: Id; readonly sql: Sql; },
            ]
        >
    : UpsertClausePart<Rest, Id, Sql, Seen, readonly [ ...Acc, First ]>
    : Seen extends true ? Acc
    : readonly [ ...Acc, { readonly id: Id; readonly sql: Sql; } ];

export type RemoveClausePart<
    Parts extends ClauseList,
    Id extends string,
    Acc extends ClauseList = readonly [],
> = Parts extends readonly [
    infer First extends SqlClausePart,
    ...infer Rest extends ClauseList,
] ? RemoveClausePart<
        Rest,
        Id,
        First["id"] extends Id ? Acc : readonly [ ...Acc, First ]
    >
    : Acc;

export type ClauseValueToString<Value, Sep extends string> = Value extends
    string ? Value
    : Value extends ClauseList ? ClauseListStringOrUndefined<Value, Sep>
    : undefined;

export type SelectClauseString<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = ClauseValueToString<Sql["select"], ", ">;

export type JoinClauseString<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = ClauseValueToString<Sql["joins"], " ">;

export type ContextSqlFromTag<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = Sql["from"] extends infer From extends string
    ? JoinClauseString<Sql> extends infer Joins extends string
        ? Joins extends "" ? `FROM ${From}` : `FROM ${From} ${Joins}`
    : `FROM ${From}`
    : JoinClauseString<Sql> extends infer Joins extends string ? Joins
    : undefined;

// ---------------------------------------------------------------------------
// Optimized BuilderSqlTag Update Helpers
// ---------------------------------------------------------------------------

/**
 * Helper type to update a single field in BuilderSqlTag without manually
 * specifying all 10 type parameters. Uses mapped types for efficiency.
 *
 * This reduces type instantiation complexity when updating the SQL tag.
 */
type UpdateSqlTag<
    Sql extends AnyBuilderSqlTag,
    Updates extends Partial<{
        select: any;
        from: any;
        joins: any;
        where: any;
        groupBy: any;
        having: any;
        orderBy: any;
        limit: any;
        params: any;
        offset: any;
        namedParams: any;
    }>,
> = BuilderSqlTag<
    "select" extends keyof Updates ? Updates["select"] : Sql["select"],
    "from" extends keyof Updates ? Updates["from"] : Sql["from"],
    "joins" extends keyof Updates ? Updates["joins"] : Sql["joins"],
    "where" extends keyof Updates ? Updates["where"] : Sql["where"],
    "groupBy" extends keyof Updates ? Updates["groupBy"] : Sql["groupBy"],
    "having" extends keyof Updates ? Updates["having"] : Sql["having"],
    "orderBy" extends keyof Updates ? Updates["orderBy"] : Sql["orderBy"],
    "limit" extends keyof Updates ? Updates["limit"] : Sql["limit"],
    "params" extends keyof Updates ? Updates["params"] : Sql["params"],
    "offset" extends keyof Updates ? Updates["offset"] : Sql["offset"],
    "namedParams" extends keyof Updates ? Updates["namedParams"]
        : Sql["namedParams"]
>;

/**
 * Internal: Add columns to the SELECT fragment in the SQL tag.
 * Use WithSelectSql which includes union detection.
 */
type WithSelectSqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    select: ClauseListOrUndefined<
        UpsertClausePart<
            NormalizeClauseList<Sql["select"]>,
            Id extends string ? Id
                : `select_${NormalizeClauseList<Sql["select"]>["length"]}`,
            ColsToString<Cols>
        >
    >;
}>;

/**
 * Add columns to the SELECT fragment in the SQL tag.
 * Returns UnionSqlError if Cols is a union type to prevent exponential computation.
 */
export type WithSelectSql<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Cols> extends true ? UnionSqlError
    : WithSelectSqlInternal<Sql, Cols, Id>;

/**
 * Internal: Set or replace the FROM fragment in the SQL tag.
 * Use WithFromSql which includes union detection.
 */
type WithFromSqlInternal<
    Sql extends AnyBuilderSqlTag,
    Src,
> = UpdateSqlTag<Sql, {
    from: Src extends string ? Src : string;
}>;

/**
 * Set or replace the FROM fragment in the SQL tag.
 * Returns UnionSqlError if Src is a union type to prevent exponential computation.
 *
 * For subqueries we conservatively fall back to `string`, which will prevent
 * full SQL literal reconstruction but keeps types sound.
 */
export type WithFromSql<
    Sql extends AnyBuilderSqlTag,
    Src,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Src> extends true ? UnionSqlError
    : WithFromSqlInternal<Sql, Src>;

/**
 * Internal: Append a JOIN fragment to the SQL tag.
 * Use WithJoinSql which includes union detection.
 */
type WithJoinSqlInternal<
    Sql extends AnyBuilderSqlTag,
    JoinSql extends string,
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    joins: ClauseListOrUndefined<
        UpsertClausePart<
            NormalizeClauseList<Sql["joins"]>,
            Id extends string ? Id
                : `join_${NormalizeClauseList<Sql["joins"]>["length"]}`,
            JoinSql
        >
    >;
}>;

/**
 * Append a JOIN fragment to the SQL tag.
 * Returns UnionSqlError if JoinSql is a union type to prevent exponential computation.
 */
export type WithJoinSql<
    Sql extends AnyBuilderSqlTag,
    JoinSql extends string,
    Id extends string | undefined,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<JoinSql> extends true ? UnionSqlError
    : WithJoinSqlInternal<Sql, JoinSql, Id>;

/**
 * Remove a SELECT fragment by ID.
 * Optimized to use UpdateSqlTag helper.
 */
export type WithoutSelectSql<
    Sql extends AnyBuilderSqlTag,
    Id extends string,
> = UpdateSqlTag<Sql, {
    select: ClauseListOrUndefined<
        RemoveClausePart<NormalizeClauseList<Sql["select"]>, Id>
    >;
}>;

/**
 * Remove a JOIN fragment by ID.
 * Optimized to use UpdateSqlTag helper.
 */
export type WithoutJoinSql<
    Sql extends AnyBuilderSqlTag,
    Id extends string,
> = UpdateSqlTag<Sql, {
    joins: ClauseListOrUndefined<
        RemoveClausePart<NormalizeClauseList<Sql["joins"]>, Id>
    >;
}>;

export type StateFromSql<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = BuilderStateTag<
    State["fromTable"],
    BuilderFullRow<Schema, Sql>,
    ContextSqlFromTag<Sql>
>;

/**
 * Normalize a WHERE / HAVING condition to a string fragment.
 */
export type ConditionToSql<Cond> = Cond extends
    ConditionTreeBuilder<any, infer Expr extends string> ? Expr
    : Cond extends string ? Cond
    : string;

/**
 * Internal: Append a WHERE fragment (combined with AND) to the SQL tag.
 * Use WithWhereSql which includes union detection.
 */
export type WithWhereSqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = UpdateSqlTag<Sql, {
    where: [ Sql["where"] ] extends [ string ]
        ? `${Sql["where"]} AND ${ConditionToSql<Cond>}`
        : ConditionToSql<Cond>;
}>;

/**
 * Append a WHERE fragment (combined with AND) to the SQL tag.
 * Returns UnionSqlError if Cond is a union type to prevent exponential computation.
 */
export type WithWhereSql<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Cond> extends true ? UnionSqlError
    : WithWhereSqlInternal<Sql, Cond>;

/**
 * Internal: Append a GROUP BY fragment (combined with commas) to the SQL tag.
 * Use WithGroupBySql which includes union detection.
 */
export type WithGroupBySqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    groupBy: [ Sql["groupBy"] ] extends [ string ]
        ? `${Sql["groupBy"]}, ${ColsToString<Cols>}`
        : ColsToString<Cols>;
}>;

/**
 * Append a GROUP BY fragment (combined with commas) to the SQL tag.
 * Returns UnionSqlError if Cols is a union type to prevent exponential computation.
 */
export type WithGroupBySql<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Cols> extends true ? UnionSqlError
    : WithGroupBySqlInternal<Sql, Cols, Id>;

/**
 * Internal: Append a HAVING fragment (combined with AND) to the SQL tag.
 * Use WithHavingSql which includes union detection.
 */
export type WithHavingSqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = UpdateSqlTag<Sql, {
    having: [ Sql["having"] ] extends [ string ]
        ? `${Sql["having"]} AND ${ConditionToSql<Cond>}`
        : ConditionToSql<Cond>;
}>;

/**
 * Append a HAVING fragment (combined with AND) to the SQL tag.
 * Returns UnionSqlError if Cond is a union type to prevent exponential computation.
 */
export type WithHavingSql<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Cond> extends true ? UnionSqlError
    : WithHavingSqlInternal<Sql, Cond>;

/**
 * Internal: Append an ORDER BY fragment (combined with commas) to the SQL tag.
 * Use WithOrderBySql which includes union detection.
 */
export type WithOrderBySqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    orderBy: [ Sql["orderBy"] ] extends [ string ]
        ? `${Sql["orderBy"]}, ${ColsToString<Cols>}`
        : ColsToString<Cols>;
}>;

/**
 * Append an ORDER BY fragment (combined with commas) to the SQL tag.
 * Returns UnionSqlError if Cols is a union type to prevent exponential computation.
 */
export type WithOrderBySql<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = IsUnionSqlError<Sql> extends true ? Sql
    : IsUnion<Cols> extends true ? UnionSqlError
    : WithOrderBySqlInternal<Sql, Cols, Id>;

/**
 * Set or replace the LIMIT fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
export type WithLimitSql<
    Sql extends AnyBuilderSqlTag,
    Limit extends number,
> = UpdateSqlTag<Sql, { limit: Limit; }>;

/**
 * Set or replace the OFFSET fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
export type WithOffsetSql<
    Sql extends AnyBuilderSqlTag,
    Offset extends number,
> = UpdateSqlTag<Sql, { offset: Offset; }>;

/**
 * Set named parameters on the SQL tag.
 * Named params use `:name` syntax in SQL strings and are replaced with `$N`
 * placeholders at runtime based on Object.keys() order.
 */
export type WithNamedParamsSql<
    Sql extends AnyBuilderSqlTag,
    P extends Record<string, QueryParamValue>,
> = UpdateSqlTag<Sql, {
    namedParams: P;
}>;

// ---------------------------------------------------------------------------
// Conditional *If() Type Helpers
// ---------------------------------------------------------------------------

/**
 * Conditional type helper for *If() methods.
 *
 * When condition is:
 * - `true` (literal): returns IfTrue type (clause added)
 * - `false` (literal): returns IfFalse type (unchanged Sql)
 * - `boolean` (widened): returns IfTrue (optimistic, avoids union explosion)
 *
 * For Sql tags, we use IfTrue when condition is boolean because:
 * 1. It avoids exponential union growth with multiple *If() calls
 * 2. The Sql tag is primarily for SQL string assembly, not result type inference
 * 3. Result type inference uses State which properly handles optionality
 */
export type ConditionalSqlUpdate<
    Cond extends boolean,
    IfTrue extends AnyBuilderSqlTag,
    IfFalse extends AnyBuilderSqlTag,
> = boolean extends Cond ? IfTrue
    : Cond extends true ? IfTrue
    : IfFalse;

/**
 * Conditional state update for selectIf/joinIf that may add columns.
 *
 * - When condition is literal `true`: returns After (columns definitely added)
 * - When condition is literal `false`: returns Before (columns definitely not added)
 * - When condition is `boolean`: merges states with new columns marked as `| undefined`
 *
 * This avoids union explosion when multiple *If() methods are chained.
 */
export type ConditionalStateUpdate<
    Cond extends boolean,
    Before extends AnyBuilderStateTag,
    After extends AnyBuilderStateTag,
> = boolean extends Cond ? MergeConditionalState<Before, After>
    : Cond extends true ? After
    : Before;

// ---------------------------------------------------------------------------
// Optimized SQL Assembly Helpers
// ---------------------------------------------------------------------------

/**
 * Append a clause to SQL if the value is a string, otherwise return unchanged.
 * This helper reduces nested conditionals in AssembleBuilderSql.
 */
export type AppendClause<
    Base extends string,
    Keyword extends string,
    Value,
> = [ Value ] extends [ string ] ? `${Base} ${Keyword} ${Value}` : Base;

/**
 * Append a clause to SQL without a keyword (for JOINs which include their own keywords).
 */
export type AppendClauseNoKeyword<
    Base extends string,
    Value,
> = [ Value ] extends [ string ] ? `${Base} ${Value}` : Base;

/**
 * Append LIMIT clause (uses number type).
 */
export type AppendLimitClause<
    Base extends string,
    Value,
> = [ Value ] extends [ number ] ? `${Base} LIMIT ${Value}` : Base;

/**
 * Append OFFSET clause (uses number type).
 */
export type AppendOffsetClause<
    Base extends string,
    Value,
> = [ Value ] extends [ number ] ? `${Base} OFFSET ${Value}` : Base;

/**
 * Assemble a SQL string from a BuilderSqlTag. This mirrors the core ordering
 * of `assembleSelectSQL` for SELECT/FROM/JOIN/WHERE/GROUP BY/HAVING/ORDER BY
 * and LIMIT.
 *
 * Optimized to use helper types instead of 8+ levels of nested conditionals.
 */
export type AssembleBuilderSql<
    P extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = AppendOffsetClause<
    AppendLimitClause<
        AppendClause<
            AppendClause<
                AppendClause<
                    AppendClause<
                        AppendClauseNoKeyword<
                            AppendClause<
                                [ SelectClauseString<P> ] extends [ string ]
                                    ? `SELECT ${SelectClauseString<P>}`
                                    : "SELECT *",
                                "FROM",
                                P["from"]
                            >,
                            JoinClauseString<P>
                        >,
                        "WHERE",
                        P["where"]
                    >,
                    "GROUP BY",
                    P["groupBy"]
                >,
                "HAVING",
                P["having"]
            >,
            "ORDER BY",
            P["orderBy"]
        >,
        P["limit"]
    >,
    P["offset"]
>;

/**
 * Legacy deeply-nested implementation kept for reference.
 * @deprecated Use AssembleBuilderSql instead
 */
// type AssembleBuilderSql_Legacy<
//     P extends BuilderSqlTag<
//         any,
//         any,
//         any,
//         any,
//         any,
//         any,
//         any,
//         any,
//         any,
//         any,
//         any
//     >,
// > =
//     // SELECT clause
//     ([ SelectClauseString<P> ] extends [ string ]
//         ? `SELECT ${SelectClauseString<P>}`
//         : "SELECT *") extends infer Sel extends string
//         // FROM clause
//         ? ([ P["from"] ] extends [ string ] ? `${Sel} FROM ${P["from"]}`
//             : Sel) extends infer SelFrom extends string
//             // JOINs
//             ? ([ JoinClauseString<P> ] extends [ string ]
//                 ? `${SelFrom} ${JoinClauseString<P>}`
//                 : SelFrom) extends infer SelFromJoin extends string
//                 // WHERE
//                 ? ([ P["where"] ] extends [ string ]
//                     ? `${SelFromJoin} WHERE ${P["where"]}`
//                     : SelFromJoin) extends infer SelWhere extends string
//                     // GROUP BY
//                     ? ([ P["groupBy"] ] extends [ string ]
//                         ? `${SelWhere} GROUP BY ${P["groupBy"]}`
//                         : SelWhere) extends infer SelGroup extends string
//                         // HAVING
//                         ? ([ P["having"] ] extends [ string ]
//                             ? `${SelGroup} HAVING ${P["having"]}`
//                             : SelGroup) extends infer SelHaving extends string
//                             // ORDER BY
//                             ? ([ P["orderBy"] ] extends [ string ]
//                                 ? `${SelHaving} ORDER BY ${P["orderBy"]}`
//                                 : SelHaving) extends
//                                 infer SelOrder extends string
//                                 // LIMIT
//                                 ? ([ P["limit"] ] extends [ number ]
//                                     ? `${SelOrder} LIMIT ${P["limit"]}`
//                                     : SelOrder) extends
//                                     infer SelLimit extends string
//                                     ? [ P["offset"] ] extends [ number ]
//                                         ? `${SelLimit} OFFSET ${P["offset"]}`
//                                     : SelLimit
//                                 : never
//                             : never
//                         : never
//                     : never
//                 : never
//             : never
//         : never
//         : never;

// ============================================================================
// Valid* wrappers (db.ts-style) for pseudo queries
// ============================================================================

/**
 * Internal helper: base expression part of a column string (before first
 * whitespace). This intentionally ignores aliases and most expressions –
 * it's a lightweight approximation for validation only.
 */
export type ColumnBaseExpr<S extends string> = S extends
    `${infer Base} ${string}` ? Base
    : S;

/**
 * Internal helper: validate a single simple column against the current
 * builder state. This handles only:
 * - unqualified columns: "id"
 * - table-qualified: "users.id"
 * - schema + table + column: "public.users.id"
 *
 * More complex expressions are treated as valid to keep the validator shallow.
 */
export type SimpleColumnValid<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> =
    // If we don't have a simple FROM context, skip validation.
    State["fromTable"] extends infer From extends TableNameOf<Schema>
        ? State["contextSQL"] extends infer C extends string
            ? C extends `${string}JOIN${string}` ? true
            : _SimpleColumnValidWithFrom<Schema, From, ColumnBaseExpr<Col>>
        : true
        : true;

export type _SimpleColumnValidWithFrom<
    Schema extends DatabaseSchema,
    From extends TableNameOf<Schema>,
    Expr extends string,
> =
    // Expressions with explicit casts (id::text, func(...)::type) – skip
    Expr extends `${string}::${string}` ? true
        // schema.table.column – validate directly against schema
        : Expr extends
            `${infer SchemaName}.${infer TableName}.${infer ColumnName}`
            ? SchemaName extends keyof Schema["schemas"]
                ? TableName extends keyof Schema["schemas"][SchemaName]
                    ? ColumnName extends
                        keyof Schema["schemas"][SchemaName][TableName] ? true
                    : `[SQL Error] Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`
                : `[SQL Error] Table '${TableName}' not found in schema '${SchemaName}'`
            : `[SQL Error] Schema '${SchemaName}' not found`
        // table.column – only validate when table matches current FROM table
        : Expr extends `${infer TableName}.${infer ColumnName}`
            ? TableName extends From
                ? ColumnName extends keyof SchemaTables<Schema>[From] ? true
                : `[SQL Error] Column '${ColumnName}' not found in '${From}'`
            : true
        // unqualified column – validate against current FROM table
        : Expr extends string
            ? Expr extends keyof SchemaTables<Schema>[From] ? true
            : `[SQL Error] Column '${Expr}' not found in '${From}'`
        : true;

/**
 * Wrap a single column expression so that invalid columns produce a
 * descriptive string literal type that will not be assignable to the
 * original column string, surfacing an error at the call site.
 */
export type ValidColumn<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> = SimpleColumnValid<Schema, State, Col> extends true ? Col
    : SimpleColumnValid<Schema, State, Col> & string;

/**
 * Wrap a column spec (string or readonly string[]) with ValidColumn.
 */
export type ValidColumns<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    ColSpec extends string | readonly string[],
> = ColSpec extends readonly string[] ? {
        [K in keyof ColSpec]: ColSpec[K] extends string
            ? ValidColumn<Schema, State, ColSpec[K]>
            : ColSpec[K];
    }
    : ColSpec extends string ? ValidColumn<Schema, State, ColSpec>
    : ColSpec;

export type WithFromForSchema<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Src,
> = Src extends string
    ? ParseTableRef<Src> extends infer Ref
        ? Ref extends { table: infer T extends string; }
            ? T extends TableNameOf<Schema> ? BuilderStateTag<
                    T,
                    State["row"],
                    `FROM ${Src}`
                >
            : BuilderStateTag<
                State["fromTable"],
                State["row"],
                `FROM ${Src}`
            >
        : BuilderStateTag<
            State["fromTable"],
            State["row"],
            `FROM ${Src}`
        >
    : BuilderStateTag<
        State["fromTable"],
        State["row"],
        `FROM ${Src}`
    >
    // FROM (subquery) - the subquery SQL is not visible at the type level
    // (only `string` from toString), so we conservatively leave contextSQL
    // as-is. Column typing for subqueries is future work for a heavier
    // builder state.
    : Src extends SelectQueryBuilder<
        Schema,
        infer SubState extends BuilderStateTag<any, any, any>,
        any
    > ? BuilderStateTag<
            SubState["fromTable"],
            State["row"],
            State["contextSQL"]
        >
    : State;

export type WithJoinContext<
    State extends BuilderStateTag<any, any, any>,
    JoinSql extends string,
> = BuilderStateTag<
    State["fromTable"],
    State["row"],
    State["contextSQL"] extends string ? `${State["contextSQL"]} ${JoinSql}`
        : JoinSql
>;

// Conditional (.when) support – lightweight, row-only

export type OptionalizeNewKeys<
    BeforeRow,
    AfterRow,
> = {
    [K in keyof AfterRow]-?: K extends keyof BeforeRow ? AfterRow[K]
        : AfterRow[K] | undefined;
};

export type MergeConditionalState<
    Before extends BuilderStateTag<any, any, any>,
    After extends BuilderStateTag<any, any, any>,
> = BuilderStateTag<
    Before["fromTable"] | After["fromTable"],
    Flatten<Before["row"] & OptionalizeNewKeys<Before["row"], After["row"]>>,
    Before["contextSQL"] | After["contextSQL"]
>;
