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

import {
    appendParamsRuntime,
    ConditionTreeBuilder,
    whenRuntime,
} from "../common/builder.js";

import type { ParamString, QueryParamValue } from "../common/builder.js";

import type {
    ColumnRefType,
    CTEDefinition,
    JoinClause,
    MapSQLTypeToTS,
    OrderByItem,
    TableSource,
    WhereExpr,
} from "../common/ast.js";

import type {
    Decrement,
    Flatten,
    MatchError,
    RemoveQuotes,
    Trim,
} from "../common/utils.js";

import type {
    ColumnRef,
    SelectClause,
    SelectItem,
    UnionClause,
    UnionOperatorType,
} from "./ast.js";

import type { DatabaseSchema } from "../common/schema.js";
import type { QueryResult, ValidateQuery, ValidateSQL } from "./matcher.js";
import type { ParseColumnList, ParseTableRef } from "./parser.js";

// ============================================================================
// Lightweight Builder State Tag (Phase 7)
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
}

/**
 * Initial empty SQL tag: no clauses present.
 */
export type EmptySqlState = BuilderSqlTag;

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

type DefaultSchemaName<Schema extends DatabaseSchema> =
    Schema["defaultSchema"] extends infer D extends string ? D : never;

type SchemaTables<
    Schema extends DatabaseSchema,
> = Schema["schemas"][DefaultSchemaName<Schema>];

export type TableNameOf<
    Schema extends DatabaseSchema,
> = Extract<keyof SchemaTables<Schema>, string>;

// Column mapping helpers – implemented by delegating to QueryResult on a
// per-column synthetic query that uses the builder's contextSQL so that
// aliases, joins, expressions, and casts are handled by the existing
// parser + matcher.

type IsTuple<T extends readonly any[]> = number extends T["length"] ? false
    : true;

/**
 * Convert a union of types into an intersection (A | B -> A & B).
 * Used to merge column rows derived from non-tuple string arrays.
 */
type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;

type ToStringArray<T extends string | readonly string[]> =
    // Preserve tuple shapes to keep literal ordering for SQL reconstruction.
    T extends
        readonly [ infer First extends string, ...infer Rest extends string[] ]
        ? [ First, ...Rest ]
        : T extends readonly (infer S extends string)[] ? S[]
        : [ T ];

type ColumnQuery<
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> = State["contextSQL"] extends string ? `SELECT ${Col} ${State["contextSQL"]}`
    : never;

/**
 * Helper to detect literal string types (as opposed to plain `string`).
 */
type IsLiteralString<T> = T extends string ? string extends T ? false : true
    : false;

/** Detect `unknown` specifically (not just assignable to unknown). */
type IsUnknown<T> = unknown extends T ? [ T ] extends [ unknown ] ? true
    : false
    : false;

/** Strip simple PostgreSQL-style casts (`expr::type`). */
type StripCast<S extends string> = S extends `${infer Base}::${string}` ? Base
    : S;

/**
 * Remove surrounding double quotes from an identifier segment.
 * Keeps the inner content intact so case-sensitive names survive.
 */
type StripIdentifierQuotes<S extends string> = S extends `"${infer Inner}"`
    ? Inner
    : S;

type TrimStr<S extends string> = S extends ` ${infer T}` ? TrimStr<T>
    : S extends `${infer T} ` ? TrimStr<T>
    : S;

type FirstToken<S extends string> = TrimStr<S> extends `${infer Head} ${string}`
    ? Head
    : TrimStr<S>;

type StripAliasFromCast<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${string}` ? StripAliasFromCast<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${string}`
        ? StripAliasFromCast<TrimStr<Before>>
    : S;

type StripCastParams<S extends string> = S extends `${infer Base}(${string})`
    ? Base
    : S;

type NormalizeCastTarget<S extends string> = Lowercase<
    StripCastParams<FirstToken<StripAliasFromCast<TrimStr<S>>>>
>;

type CastTarget<Expr extends string> = Expr extends `${string}::${infer Cast}`
    ? NormalizeCastTarget<Cast>
    : Expr extends `CAST(${string} AS ${infer Cast})${string}`
        ? NormalizeCastTarget<Cast>
    : undefined;

type CastReturnType<Cast extends string> = MapSQLTypeToTS<Cast> extends infer M
    ? IsUnknown<M> extends true ? string
    : M
    : string;

type ExtractAlias<S extends string> = TrimStr<S> extends
    `${infer _Before} AS ${infer After}`
    ? ExtractAlias<TrimStr<After>> extends infer Alias extends string ? Alias
    : TrimStr<After>
    : TrimStr<S> extends `${infer _Before} as ${infer After}`
        ? ExtractAlias<TrimStr<After>> extends infer Alias extends string
            ? Alias
        : TrimStr<After>
    : undefined;

type ExprWithoutAlias<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${infer _After}` ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${infer _After}`
        ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S>;

type SplitAlias<S extends string> = [
    ExprWithoutAlias<S>,
    ExtractAlias<S>,
];

type StripAliasIdentifier<S extends string> = S extends
    `${infer _Expr} AS ${infer Alias}` ? TrimStr<Alias>
    : S;

/** Extract the final identifier part of a column expression (alias wins). */
type ExtractColumnIdentifier<S extends string> = SplitAlias<S> extends [
    infer Expr extends string,
    infer Alias extends string | undefined,
] ? Alias extends string ? StripIdentifierQuotes<Alias>
    : StripIdentifierQuotes<
        StripCast<Expr> extends `${string}.${infer Tail}` ? Tail
            : StripCast<Expr>
    >
    : StripIdentifierQuotes<StripCast<S>>;

/** Look up a column's TS type from the default schema tables. */
type ColumnTypeFromSchema<
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

type ColumnTypeFromTable<
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
type ResolveAliasToTable<
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
type ExtractAliasFromFrom<
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
type ExtractTableSpecBeforeKeyword<S extends string> = S extends
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
type ParseTableAlias<
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
type ExtractTableName<S extends string> = S extends
    `${infer _Schema}.${infer Table}` ? StripIdentifierQuotes<Table>
    : StripIdentifierQuotes<S>;

/**
 * Search JOINs in the context for alias.
 */
type ExtractAliasFromJoins<
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
type PrimaryTable<
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
type ResolveTableForQualifiedColumn<
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
type ColumnTypeForExpr<
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

type ExpressionType<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Expr extends string,
> = Expr extends `${string}::${infer Cast}`
    ? CastReturnType<NormalizeCastTarget<Cast>>
    : Expr extends `CAST(${string} AS ${infer Cast})${string}`
        ? CastReturnType<NormalizeCastTarget<Cast>>
    : Expr extends `COUNT${string}` ? number
    : Expr extends `(SELECT COUNT${string})` ? number
    : ColumnTypeForExpr<Schema, State, Expr> extends never ? unknown
    : ColumnTypeForExpr<Schema, State, Expr>;

type ColumnRow<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> = SplitAlias<Col> extends [
    infer Expr extends string,
    infer Alias extends string | undefined,
] ? {
        [K in Alias extends string ? Alias : ExtractColumnIdentifier<Expr>]:
            ExpressionType<Schema, State, Expr>;
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
type ColumnsArrayToRow<
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
    : Flatten<Acc>;  // Single flatten at the end

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

type AddColumnsForSchema<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    ColSpec extends string | readonly string[],
> = BuilderStateTag<
    State["fromTable"],
    State["row"] & ColumnsToRow<Schema, State, ColSpec>,
    State["contextSQL"]
>;

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
type ColsToString<
    Cols extends string | readonly string[],
> = ToStringArray<Cols> extends infer Arr extends string[] ? JoinWith<Arr, ", ">
    : "";

// Clause fragment helpers with ID-aware lists to support removal.
export type SqlClausePart = { readonly id: string; readonly sql: string; };
type ClauseList = readonly SqlClausePart[];

type NormalizeClauseList<Value> = Value extends ClauseList ? Value
    : Value extends string ? readonly [
            { readonly id: "__legacy"; readonly sql: Value; },
        ]
    : readonly [];

type ClauseListOrUndefined<Parts extends ClauseList> = Parts["length"] extends 0
    ? undefined
    : Parts;

type ClauseListToString<
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

type ClauseListStringOrUndefined<
    Parts extends ClauseList,
    Sep extends string,
> = Parts["length"] extends 0 ? undefined : ClauseListToString<Parts, Sep>;

type UpsertClausePart<
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

type RemoveClausePart<
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

type ClauseValueToString<Value, Sep extends string> = Value extends string
    ? Value
    : Value extends ClauseList ? ClauseListStringOrUndefined<Value, Sep>
    : undefined;

type SelectClauseString<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = ClauseValueToString<Sql["select"], ", ">;

type JoinClauseString<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = ClauseValueToString<Sql["joins"], " ">;

type ContextSqlFromTag<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
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
    "offset" extends keyof Updates ? Updates["offset"] : Sql["offset"]
>;

/**
 * Add columns to the SELECT fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithSelectSql<
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
 * Set or replace the FROM fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 *
 * For subqueries we conservatively fall back to `string`, which will prevent
 * full SQL literal reconstruction but keeps types sound.
 */
type WithFromSql<
    Sql extends AnyBuilderSqlTag,
    Src,
> = UpdateSqlTag<Sql, {
    from: Src extends string ? Src : string;
}>;

/**
 * Append a JOIN fragment to the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithJoinSql<
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
 * Remove a SELECT fragment by ID.
 * Optimized to use UpdateSqlTag helper.
 */
type WithoutSelectSql<
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
type WithoutJoinSql<
    Sql extends AnyBuilderSqlTag,
    Id extends string,
> = UpdateSqlTag<Sql, {
    joins: ClauseListOrUndefined<
        RemoveClausePart<NormalizeClauseList<Sql["joins"]>, Id>
    >;
}>;

type StateFromSql<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = BuilderStateTag<
    State["fromTable"],
    BuilderFullRow<Schema, Sql>,
    ContextSqlFromTag<Sql>
>;

/**
 * Normalize a WHERE / HAVING condition to a string fragment.
 */
type ConditionToSql<Cond> = Cond extends
    ConditionTreeBuilder<any, infer Expr extends string> ? Expr
    : Cond extends string ? Cond
    : string;

/**
 * Append a WHERE fragment (combined with AND) to the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithWhereSql<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = UpdateSqlTag<Sql, {
    where: [ Sql["where"] ] extends [ string ]
        ? `${Sql["where"]} AND ${ConditionToSql<Cond>}`
        : ConditionToSql<Cond>;
}>;

/**
 * Append a GROUP BY fragment (combined with commas) to the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithGroupBySql<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    groupBy: [ Sql["groupBy"] ] extends [ string ]
        ? `${Sql["groupBy"]}, ${ColsToString<Cols>}`
        : ColsToString<Cols>;
}>;

/**
 * Append a HAVING fragment (combined with AND) to the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithHavingSql<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = UpdateSqlTag<Sql, {
    having: [ Sql["having"] ] extends [ string ]
        ? `${Sql["having"]} AND ${ConditionToSql<Cond>}`
        : ConditionToSql<Cond>;
}>;

/**
 * Append an ORDER BY fragment (combined with commas) to the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithOrderBySql<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    orderBy: [ Sql["orderBy"] ] extends [ string ]
        ? `${Sql["orderBy"]}, ${ColsToString<Cols>}`
        : ColsToString<Cols>;
}>;

/**
 * Set or replace the LIMIT fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithLimitSql<
    Sql extends AnyBuilderSqlTag,
    Limit extends number,
> = UpdateSqlTag<Sql, { limit: Limit; }>;

/**
 * Set or replace the OFFSET fragment in the SQL tag.
 * Optimized to use UpdateSqlTag helper.
 */
type WithOffsetSql<
    Sql extends AnyBuilderSqlTag,
    Offset extends number,
> = UpdateSqlTag<Sql, { offset: Offset; }>;

/**
 * Append parameter values to the SQL tag metadata while keeping all other
 * clause fragments unchanged.
 * Optimized to use UpdateSqlTag helper.
 */
type WithParamsSql<
    Sql extends AnyBuilderSqlTag,
    Params extends readonly QueryParamValue[],
> = UpdateSqlTag<Sql, {
    params: readonly [ ...Sql["params"], ...Params ];
}>;

// ---------------------------------------------------------------------------
// Optimized SQL Assembly Helpers
// ---------------------------------------------------------------------------

/**
 * Append a clause to SQL if the value is a string, otherwise return unchanged.
 * This helper reduces nested conditionals in AssembleBuilderSql.
 */
type AppendClause<
    Base extends string,
    Keyword extends string,
    Value,
> = [ Value ] extends [ string ] ? `${Base} ${Keyword} ${Value}` : Base;

/**
 * Append a clause to SQL without a keyword (for JOINs which include their own keywords).
 */
type AppendClauseNoKeyword<
    Base extends string,
    Value,
> = [ Value ] extends [ string ] ? `${Base} ${Value}` : Base;

/**
 * Append LIMIT clause (uses number type).
 */
type AppendLimitClause<
    Base extends string,
    Value,
> = [ Value ] extends [ number ] ? `${Base} LIMIT ${Value}` : Base;

/**
 * Append OFFSET clause (uses number type).
 */
type AppendOffsetClause<
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
    P extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
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
type AssembleBuilderSql_Legacy<
    P extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> =
    // SELECT clause
    ([ SelectClauseString<P> ] extends [ string ]
        ? `SELECT ${SelectClauseString<P>}`
        : "SELECT *") extends infer Sel extends string
        // FROM clause
        ? ([ P["from"] ] extends [ string ] ? `${Sel} FROM ${P["from"]}`
            : Sel) extends infer SelFrom extends string
            // JOINs
            ? ([ JoinClauseString<P> ] extends [ string ]
                ? `${SelFrom} ${JoinClauseString<P>}`
                : SelFrom) extends infer SelFromJoin extends string
                // WHERE
                ? ([ P["where"] ] extends [ string ]
                    ? `${SelFromJoin} WHERE ${P["where"]}`
                    : SelFromJoin) extends infer SelWhere extends string
                    // GROUP BY
                    ? ([ P["groupBy"] ] extends [ string ]
                        ? `${SelWhere} GROUP BY ${P["groupBy"]}`
                        : SelWhere) extends infer SelGroup extends string
                        // HAVING
                        ? ([ P["having"] ] extends [ string ]
                            ? `${SelGroup} HAVING ${P["having"]}`
                            : SelGroup) extends infer SelHaving extends string
                            // ORDER BY
                            ? ([ P["orderBy"] ] extends [ string ]
                                ? `${SelHaving} ORDER BY ${P["orderBy"]}`
                                : SelHaving) extends
                                infer SelOrder extends string
                                // LIMIT
                                ? ([ P["limit"] ] extends [ number ]
                                    ? `${SelOrder} LIMIT ${P["limit"]}`
                                    : SelOrder) extends
                                    infer SelLimit extends string
                                    ? [ P["offset"] ] extends [ number ]
                                        ? `${SelLimit} OFFSET ${P["offset"]}`
                                    : SelLimit
                                : never
                            : never
                        : never
                    : never
                : never
            : never
        : never
        : never;

// ============================================================================
// Valid* wrappers (db.ts-style) for pseudo queries
// ============================================================================

/**
 * Internal helper: base expression part of a column string (before first
 * whitespace). This intentionally ignores aliases and most expressions –
 * it's a lightweight approximation for validation only.
 */
type ColumnBaseExpr<S extends string> = S extends `${infer Base} ${string}`
    ? Base
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
type SimpleColumnValid<
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

type _SimpleColumnValidWithFrom<
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
type ValidColumn<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Col extends string,
> = SimpleColumnValid<Schema, State, Col> extends true ? Col
    : SimpleColumnValid<Schema, State, Col> & string;

/**
 * Wrap a column spec (string or readonly string[]) with ValidColumn.
 */
type ValidColumns<
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

type WithFromForSchema<
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

type WithJoinContext<
    State extends BuilderStateTag<any, any, any>,
    JoinSql extends string,
> = BuilderStateTag<
    State["fromTable"],
    State["row"],
    State["contextSQL"] extends string ? `${State["contextSQL"]} ${JoinSql}`
        : JoinSql
>;

// Conditional (.when) support – lightweight, row-only

type OptionalizeNewKeys<
    BeforeRow,
    AfterRow,
> = {
    [K in keyof AfterRow]-?: K extends keyof BeforeRow ? AfterRow[K]
        : AfterRow[K] | undefined;
};

type MergeConditionalState<
    Before extends BuilderStateTag<any, any, any>,
    After extends BuilderStateTag<any, any, any>,
> = BuilderStateTag<
    Before["fromTable"] | After["fromTable"],
    Flatten<Before["row"] & OptionalizeNewKeys<Before["row"], After["row"]>>,
    Before["contextSQL"] | After["contextSQL"]
>;

type CallbackResultState<
    Schema extends DatabaseSchema,
    S extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
    CB,
> = CB extends (
    b: SelectQueryBuilder<Schema, S, Sql>,
    ...args: any[]
) => SelectQueryBuilder<
    Schema,
    infer AfterState extends BuilderStateTag<any, any, any>,
    any
> ? AfterState
    : S;

type CallbackResultSql<
    Schema extends DatabaseSchema,
    S extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
    CB,
> = CB extends (
    b: SelectQueryBuilder<Schema, S, Sql>,
    ...args: any[]
) => SelectQueryBuilder<
    Schema,
    any,
    infer AfterSql extends BuilderSqlTag<
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
    >
> ? AfterSql
    : Sql;

// ============================================================================
// Runtime SELECT Builder Skeleton
// ============================================================================

/**
 * Runtime representation of builder state mirrors SelectBuilderState but
 * can store raw string fragments for SQL assembly alongside AST fragments
 * tracked at the type level.
 */
export interface RuntimeSelectState extends SelectBuilderState {
    /**
     * Raw SELECT fragments by ID (used for SQL string assembly).
     * The type-level part continues to use SelectBuilderState["select"].
     */
    readonly selectSql: { readonly [id: string]: string[]; };
    /** Raw FROM fragment (if present) */
    readonly fromSql?: string;
    /** Raw JOIN fragments by ID (preserving order via joins array) */
    readonly joinSql: { readonly [id: string]: string; };
    /** Raw WHERE fragments by ID (can include ConditionTreeBuilder usage) */
    readonly whereSql: { readonly [id: string]: string; };
    /** Raw GROUP BY fragments by ID */
    readonly groupBySql: { readonly [id: string]: string; };
    /** Raw HAVING fragments by ID */
    readonly havingSql: { readonly [id: string]: string; };
    /** Raw ORDER BY fragments by ID */
    readonly orderBySql: { readonly [id: string]: string; };
    /** Raw CTE fragments by ID */
    readonly cteSql: { readonly [id: string]: string; };
    /** Raw UNION fragment (if any) */
    readonly unionSql?: string;
    /** Collected query parameter values (positional) */
    readonly params: ReadonlyArray<QueryParamValue>;
}

/**
 * Default empty runtime state corresponding to EmptyState.
 */
const EMPTY_RUNTIME_STATE: RuntimeSelectState = {
    select: {},
    from: undefined,
    joins: [],
    where: {},
    groupBy: {},
    having: {},
    orderBy: {},
    limit: undefined,
    offset: undefined,
    ctes: {},
    distinct: false,
    union: undefined,
    params: [],
    selectSql: {},
    fromSql: undefined,
    joinSql: {},
    whereSql: {},
    groupBySql: {},
    havingSql: {},
    orderBySql: {},
    cteSql: {},
    unionSql: undefined,
};

/**
 * Public SELECT builder interface.
 *
 * - `Schema` is the database schema used for type inference.
 * - `State` is a lightweight tag (`BuilderStateTag`) that tracks the
 *   primary FROM table and the currently inferred result row type.
 * - `Sql` is a lightweight tag (`BuilderSqlTag`) that tracks assembled SQL
 *   fragments for type-level reconstruction and validation.
 */
export interface SelectQueryBuilder<
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
        any
    > = EmptySqlState,
> {
    /**
     * Optional runtime-only accessor for debugging / tests.
     */
    readonly _state: RuntimeSelectState;

    /**
     * Add columns to the SELECT list.
     *
     * Type-level: updates SelectBuilderState.select using ParseColumnList.
     */
    select<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        AddColumnsForSchema<Schema, State, Cols>,
        WithSelectSql<Sql, Cols, Id>
    >;

    /**
     * Set the FROM source (table or subquery as raw SQL).
     *
     * Type-level: updates SelectBuilderState.from using ParseTableRef.
     */
    from<
        Src extends
            | string
            | SelectQueryBuilder<
                Schema,
                BuilderStateTag<any, any, any>,
                any
            >,
    >(
        source: Src,
    ): SelectQueryBuilder<
        Schema,
        WithFromForSchema<Schema, State, Src>,
        WithFromSql<Sql, Src>
    >;

    /**
     * Add a raw JOIN fragment.
     *
     * Phase 7 note: this currently affects only the runtime SQL string. The
     * lightweight type-level state tag does not track join structure; columns
     * from joined tables are inferred purely from their qualified names when
     * selected (for example, "orders.total").
     */
    join<
        JoinSql extends string,
        Id extends string | undefined = undefined,
    >(
        joinSql: JoinSql,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        WithJoinContext<State, JoinSql>,
        WithJoinSql<Sql, JoinSql, Id>
    >;

    /**
     * Remove SELECT fragments by ID (runtime) while updating type-level SQL.
     *
     * Type-level: on the top level, removes the referenced SELECT fragment; when
     * used inside `.when()`, MergeConditionalState preserves prior columns so
     * conditional removals are effectively no-ops.
     */
    removeSelect<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
        WithoutSelectSql<Sql, Id>
    >;

    /**
     * Remove JOIN fragments by ID (runtime) while updating type-level SQL and
     * context string for column inference.
     *
     * Type-level: same semantics as removeSelect regarding conditional usage.
     */
    removeJoin<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
        WithoutJoinSql<Sql, Id>
    >;

    /**
     * Add a WHERE condition (string or ConditionTreeBuilder).
     */
    where<
        Cond extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithWhereSql<Sql, Cond>>;

    /**
     * Add GROUP BY columns (string or array).
     */
    groupBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithGroupBySql<Sql, Cols, Id>>;

    /**
     * Add a HAVING condition (string or ConditionTreeBuilder).
     */
    having<
        Cond extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithHavingSql<Sql, Cond>>;

    /**
     * Add ORDER BY columns (string or array).
     */
    orderBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithOrderBySql<Sql, Cols, Id>>;

    /**
     * Set LIMIT value.
     */
    limit<const L extends number>(
        limit: L,
    ): SelectQueryBuilder<Schema, State, WithLimitSql<Sql, L>>;

    /**
     * Set OFFSET value.
     */
    offset<const O extends number>(
        offset: O,
    ): SelectQueryBuilder<Schema, State, WithOffsetSql<Sql, O>>;

    /**
     * Add positional parameters and receive their placeholder string.
     *
     * Parameters are accumulated on the builder and exposed via `getParams()`.
     */
    withParams<
        const Params extends readonly QueryParamValue[],
        CB extends (
            b: SelectQueryBuilder<
                Schema,
                State,
                WithParamsSql<Sql, Params>
            >,
            paramString: ParamString<Params, Sql["params"]["length"]>,
        ) => SelectQueryBuilder<Schema, any, any>,
    >(
        params: Params,
        callback: CB,
    ): SelectQueryBuilder<
        Schema,
        CallbackResultState<
            Schema,
            State,
            WithParamsSql<Sql, Params>,
            CB
        >,
        CallbackResultSql<Schema, State, WithParamsSql<Sql, Params>, CB>
    >;

    /**
     * Conditional execution helper; runtime behavior is shared via whenRuntime.
     *
     * Type-level: the callback is treated as always-executed. Columns and joins
     * added inside `.when()` are merged into State, with new columns marked as
     * optional (their types unioned with `undefined`).
     */
    when<
        CB extends (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, any, any>,
    >(
        condition: boolean,
        callback: CB,
    ): SelectQueryBuilder<
        Schema,
        MergeConditionalState<
            State,
            CallbackResultState<Schema, State, Sql, CB>
        >,
        CallbackResultSql<Schema, State, Sql, CB>
    >;

    /**
     * Apply a reusable builder function to this builder.
     *
     * Allows composing the builder with external functions that encapsulate
     * reusable logic (e.g. common filters, joins, or selections).
     */
    apply<
        NewState extends BuilderStateTag<any, any, any>,
        NewSql extends BuilderSqlTag<
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
    >(
        fn: (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, NewState, NewSql>,
    ): SelectQueryBuilder<Schema, NewState, NewSql>;

    /**
     * Generate the SQL string from the internal runtime state.
     * Branded return type exposes the inferred result type.
     */
    toBrandedString(): string & {
        __type: BuilderResultBrand<Schema, State, Sql>;
    };

    /** Retrieve accumulated positional query parameters. */
    getParams(): ReadonlyArray<QueryParamValue>;

    /**
     * Generate the SQL string from the internal runtime state without branding.
     */
    toString(): string;
}

/**
 * Internal concrete implementation. Methods always return a new instance
 * to preserve immutability and allow type-level State to progress.
 */
class SelectQueryBuilderImpl<
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
        any
    > = EmptySqlState,
> {
    readonly _state: RuntimeSelectState;

    constructor(state?: RuntimeSelectState) {
        this._state = state ?? EMPTY_RUNTIME_STATE;
    }

    // -----------------------------------------------------------------------
    // Immutable state cloning helper
    // -----------------------------------------------------------------------

    private clone(patch: Partial<RuntimeSelectState>): RuntimeSelectState {
        return {
            ...this._state,
            ...patch,
        };
    }

    // -----------------------------------------------------------------------
    // Core builder methods
    // -----------------------------------------------------------------------

    select<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        AddColumnsForSchema<Schema, State, Cols>,
        WithSelectSql<Sql, Cols, Id>
    > {
        const rawCols = Array.isArray(columns)
            ? (columns as readonly string[])
            : [ columns as string ];
        // Keep all provided columns for runtime SQL so array selects are fully
        // rendered; type-level typing continues to use AddColumnsForSchema.
        const cols = rawCols.length > 0 ? [ ...rawCols ] : [];
        const key = (id as string | undefined)
            ?? `select_${Object.keys(this._state.selectSql).length.toString()}`;

        const nextSelectSql: RuntimeSelectState["selectSql"] = {
            ...this._state.selectSql,
            [key]: cols,
        };

        const nextState = this.clone({ selectSql: nextSelectSql });
        return new SelectQueryBuilderImpl<
            Schema,
            AddColumnsForSchema<Schema, State, Cols>,
            WithSelectSql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            AddColumnsForSchema<Schema, State, Cols>,
            WithSelectSql<Sql, Cols, Id>
        >;
    }

    from<
        Src extends
            | string
            | SelectQueryBuilder<
                Schema,
                BuilderStateTag<any, any, any>,
                any
            >,
    >(
        source: Src,
    ): SelectQueryBuilder<
        Schema,
        WithFromForSchema<Schema, State, Src>,
        WithFromSql<Sql, Src>
    > {
        let fromSql: string | undefined;
        if (typeof source === "string") {
            fromSql = source;
        }
        else {
            // Runtime subquery: we only embed the SQL string; type-level
            // typing for subqueries is handled separately via QueryResult
            // when using string-based APIs.
            fromSql = `(${source.toString()})`;
        }
        const nextState = this.clone({ fromSql });
        return new SelectQueryBuilderImpl<
            Schema,
            WithFromForSchema<Schema, State, Src>,
            WithFromSql<Sql, Src>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            WithFromForSchema<Schema, State, Src>,
            WithFromSql<Sql, Src>
        >;
    }

    where<Cond extends string | ConditionTreeBuilder>(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithWhereSql<Sql, Cond>> {
        const key = id
            ?? `where_${Object.keys(this._state.whereSql).length.toString()}`;
        const sql = typeof condition === "string"
            ? condition
            : condition.toString();

        const nextWhereSql: RuntimeSelectState["whereSql"] = {
            ...this._state.whereSql,
            [key]: sql,
        };

        const nextState = this.clone({ whereSql: nextWhereSql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithWhereSql<Sql, Cond>
        >(nextState) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithWhereSql<Sql, Cond>
        >;
    }

    groupBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithGroupBySql<Sql, Cols, Id>> {
        const rawCols = Array.isArray(columns) ? [ ...columns ] : [ columns ];
        const key = id
            ?? `group_${Object.keys(this._state.groupBySql).length.toString()}`;

        const nextGroupBySql: RuntimeSelectState["groupBySql"] = {
            ...this._state.groupBySql,
            [key]: rawCols.join(", "),
        };

        const nextState = this.clone({ groupBySql: nextGroupBySql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithGroupBySql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithGroupBySql<Sql, Cols, Id>
        >;
    }

    having<Cond extends string | ConditionTreeBuilder>(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithHavingSql<Sql, Cond>> {
        const key = id
            ?? `having_${Object.keys(this._state.havingSql).length.toString()}`;
        const sql = typeof condition === "string"
            ? condition
            : condition.toString();

        const nextHavingSql: RuntimeSelectState["havingSql"] = {
            ...this._state.havingSql,
            [key]: sql,
        };

        const nextState = this.clone({ havingSql: nextHavingSql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithHavingSql<Sql, Cond>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithHavingSql<Sql, Cond>
        >;
    }

    orderBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithOrderBySql<Sql, Cols, Id>> {
        const rawCols = Array.isArray(columns) ? [ ...columns ] : [ columns ];
        const key = id
            ?? `order_${Object.keys(this._state.orderBySql).length.toString()}`;

        const nextOrderBySql: RuntimeSelectState["orderBySql"] = {
            ...this._state.orderBySql,
            [key]: rawCols.join(", "),
        };

        const nextState = this.clone({ orderBySql: nextOrderBySql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithOrderBySql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithOrderBySql<Sql, Cols, Id>
        >;
    }

    join<
        JoinSql extends string,
        Id extends string | undefined = undefined,
    >(
        joinSql: JoinSql,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        WithJoinContext<State, JoinSql>,
        WithJoinSql<Sql, JoinSql, Id>
    > {
        const key = id
            ?? `join_${this._state.joins.length.toString()}`;

        const nextJoinSql: RuntimeSelectState["joinSql"] = {
            ...this._state.joinSql,
            [key]: joinSql,
        };

        const existing = this._state.joins.find(j => j.id === key);
        const newEntry = existing ?? {
            id: key,
            ast: undefined as any,
            strictness: "INNER" as JoinStrictness,
            optional: false,
        };

        const filtered = this._state.joins.filter(j => j.id !== key);
        const nextJoins = [
            ...filtered,
            newEntry,
        ] as RuntimeSelectState["joins"];

        const nextState = this.clone({
            joinSql: nextJoinSql,
            joins: nextJoins,
        });

        return new SelectQueryBuilderImpl<
            Schema,
            WithJoinContext<State, JoinSql>,
            WithJoinSql<Sql, JoinSql, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            WithJoinContext<State, JoinSql>,
            WithJoinSql<Sql, JoinSql, Id>
        >;
    }

    removeSelect<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
        WithoutSelectSql<Sql, Id>
    > {
        const nextSelectSql = { ...this._state.selectSql };
        if (!(id in nextSelectSql)) {
            return this as unknown as SelectQueryBuilder<
                Schema,
                StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
                WithoutSelectSql<Sql, Id>
            >;
        }

        delete (nextSelectSql as any)[id];

        const nextState = this.clone({ selectSql: nextSelectSql });
        type NewSql = WithoutSelectSql<Sql, Id>;
        type NewState = StateFromSql<Schema, State, NewSql>;

        return new SelectQueryBuilderImpl<Schema, NewState, NewSql>(
            nextState,
        ) as unknown as SelectQueryBuilder<Schema, NewState, NewSql>;
    }

    removeJoin<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
        WithoutJoinSql<Sql, Id>
    > {
        const nextJoinSql = { ...this._state.joinSql };
        const hadSql = id in nextJoinSql;
        delete (nextJoinSql as any)[id];

        const nextJoins = this._state.joins.filter(j => j.id !== id);
        if (!hadSql && nextJoins.length === this._state.joins.length) {
            return this as unknown as SelectQueryBuilder<
                Schema,
                StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
                WithoutJoinSql<Sql, Id>
            >;
        }

        const nextState = this.clone({
            joinSql: nextJoinSql,
            joins: nextJoins,
        });
        type NewSql = WithoutJoinSql<Sql, Id>;
        type NewState = StateFromSql<Schema, State, NewSql>;

        return new SelectQueryBuilderImpl<Schema, NewState, NewSql>(
            nextState,
        ) as unknown as SelectQueryBuilder<Schema, NewState, NewSql>;
    }

    limit<const L extends number>(
        limit: L,
    ): SelectQueryBuilder<Schema, State, WithLimitSql<Sql, L>> {
        const nextState = this.clone({ limit });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithLimitSql<Sql, L>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithLimitSql<Sql, L>
        >;
    }

    offset<const O extends number>(
        offset: O,
    ): SelectQueryBuilder<Schema, State, WithOffsetSql<Sql, O>> {
        const nextState = this.clone({ offset });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithOffsetSql<Sql, O>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithOffsetSql<Sql, O>
        >;
    }

    withParams<
        const Params extends readonly QueryParamValue[],
        CB extends (
            b: SelectQueryBuilder<
                Schema,
                State,
                WithParamsSql<Sql, Params>
            >,
            paramString: ParamString<Params, Sql["params"]["length"]>,
        ) => SelectQueryBuilder<Schema, any, any>,
    >(
        params: Params,
        callback: CB,
    ): SelectQueryBuilder<
        Schema,
        CallbackResultState<
            Schema,
            State,
            WithParamsSql<Sql, Params>,
            CB
        >,
        CallbackResultSql<Schema, State, WithParamsSql<Sql, Params>, CB>
    > {
        const { params: nextParams, paramString } = appendParamsRuntime(
            this._state.params,
            params as readonly QueryParamValue[],
        );

        const nextState = this.clone({ params: nextParams });
        const builderWithParams = new SelectQueryBuilderImpl<
            Schema,
            State,
            WithParamsSql<Sql, Params>
        >(nextState) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithParamsSql<Sql, Params>
        >;

        const result = callback(
            builderWithParams,
            paramString as ParamString<Params, Sql["params"]["length"]>,
        ) as unknown as SelectQueryBuilderImpl<Schema, any, any>;

        const mergedParams = result._state.params.length >= nextParams.length
            ? result._state.params
            : nextParams;
        const mergedState: RuntimeSelectState = {
            ...result._state,
            params: mergedParams,
        };

        return new SelectQueryBuilderImpl<
            Schema,
            CallbackResultState<
                Schema,
                State,
                WithParamsSql<Sql, Params>,
                CB
            >,
            CallbackResultSql<Schema, State, WithParamsSql<Sql, Params>, CB>
        >(mergedState) as unknown as SelectQueryBuilder<
            Schema,
            CallbackResultState<
                Schema,
                State,
                WithParamsSql<Sql, Params>,
                CB
            >,
            CallbackResultSql<Schema, State, WithParamsSql<Sql, Params>, CB>
        >;
    }

    // -----------------------------------------------------------------------
    // Shared runtime .when()
    // -----------------------------------------------------------------------

    when<
        CB extends (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, any, any>,
    >(
        condition: boolean,
        callback: CB,
    ): SelectQueryBuilder<
        Schema,
        MergeConditionalState<
            State,
            CallbackResultState<Schema, State, Sql, CB>
        >,
        CallbackResultSql<Schema, State, Sql, CB>
    > {
        type NewState = MergeConditionalState<
            State,
            CallbackResultState<Schema, State, Sql, CB>
        >;
        type NewSql = CallbackResultSql<Schema, State, Sql, CB>;

        // Runtime: execute the callback only when the condition is true. When
        // it runs, keep the callback's full runtime state (including SELECT
        // fragments) so assembled SQL reflects the conditional changes. The
        // type-level state still marks new columns as optional.
        if (!condition) {
            return this as unknown as SelectQueryBuilder<
                Schema,
                NewState,
                NewSql
            >;
        }

        const result = callback(
            this as unknown as SelectQueryBuilder<Schema, State, Sql>,
        ) as unknown as SelectQueryBuilderImpl<Schema, any, any>;

        return new SelectQueryBuilderImpl<Schema, NewState, NewSql>(
            result._state,
        ) as unknown as SelectQueryBuilder<
            Schema,
            NewState,
            NewSql
        >;
    }

    apply<
        NewState extends BuilderStateTag<any, any, any>,
        NewSql extends BuilderSqlTag<
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
    >(
        fn: (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, NewState, NewSql>,
    ): SelectQueryBuilder<Schema, NewState, NewSql> {
        return fn(this as unknown as SelectQueryBuilder<Schema, State, Sql>);
    }

    getParams(): ReadonlyArray<QueryParamValue> {
        return this._state.params;
    }

    // -----------------------------------------------------------------------
    // SQL String Assembly
    // -----------------------------------------------------------------------

    toBrandedString(): string & {
        __type: BuilderResultBrand<Schema, State, Sql>;
    } {
        // Runtime: just assemble SQL string from fragments.
        const sql = assembleSelectSQL(this._state);
        return sql as string & {
            __type: BuilderResultBrand<Schema, State, Sql>;
        };
    }

    toString(): string {
        return assembleSelectSQL(this._state);
    }
}

/**
 * Entry point for creating a new SELECT builder.
 *
 * Schema is a generic-only parameter; there is no runtime schema value.
 */
export function createSelectQuery<
    Schema extends DatabaseSchema,
>(): SelectQueryBuilder<Schema, EmptyBuilderState, EmptySqlState> {
    return new SelectQueryBuilderImpl<
        Schema,
        BuilderStateTag<any, any, any>,
        EmptySqlState
    >(
        EMPTY_RUNTIME_STATE,
    ) as unknown as SelectQueryBuilder<
        Schema,
        EmptyBuilderState,
        EmptySqlState
    >;
}

// ============================================================================
// Untyped Select Builder (No Type-Level Computation)
// ============================================================================

/**
 * Untyped SELECT query builder interface.
 *
 * This interface mirrors `SelectQueryBuilder` but avoids all type-level
 * computation. Every method returns `UntypedSelectBuilder<Result>`, so
 * TypeScript doesn't spend cycles computing complex schema-driven types.
 *
 * Use this when:
 * - Your query has many complex SQL expressions that overwhelm TypeScript
 * - You know the result type upfront and don't need schema inference
 * - You want to compose with typed builder functions (it's assignable to
 *   `SelectQueryBuilder<any, any, any>`)
 *
 * The `Result` type parameter is your declared return type – it flows through
 * unchanged regardless of what columns/tables you add.
 */
export interface UntypedSelectBuilder<Result = unknown> {
    /** Runtime state accessor (same as typed builder). */
    readonly _state: RuntimeSelectState;

    /** Add columns to the SELECT list. */
    select(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Set the FROM source (table name or subquery SQL). */
    from(
        source: string | UntypedSelectBuilder<any>,
    ): UntypedSelectBuilder<Result>;

    /** Add a raw JOIN fragment. */
    join(joinSql: string, id?: string): UntypedSelectBuilder<Result>;

    /** Remove SELECT fragments by ID. */
    removeSelect(id: string): UntypedSelectBuilder<Result>;

    /** Remove JOIN fragments by ID. */
    removeJoin(id: string): UntypedSelectBuilder<Result>;

    /** Add a WHERE condition. */
    where(
        condition: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add GROUP BY columns. */
    groupBy(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add a HAVING condition. */
    having(
        condition: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add ORDER BY columns. */
    orderBy(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Set LIMIT value. */
    limit(limit: number): UntypedSelectBuilder<Result>;

    /** Set OFFSET value. */
    offset(offset: number): UntypedSelectBuilder<Result>;

    /**
     * Add positional parameters and receive their placeholder string.
     *
     * Note: The placeholder string is typed as `string` (not computed).
     */
    withParams<Params extends readonly QueryParamValue[]>(
        params: Params,
        callback: (
            b: UntypedSelectBuilder<Result>,
            paramString: string,
        ) => UntypedSelectBuilder<Result>,
    ): UntypedSelectBuilder<Result>;

    /**
     * Conditional execution helper.
     *
     * Unlike the typed builder, this doesn't merge conditional column types –
     * Result stays fixed.
     */
    when(
        condition: boolean,
        callback: (
            b: UntypedSelectBuilder<Result>,
        ) => UntypedSelectBuilder<Result>,
    ): UntypedSelectBuilder<Result>;

    /**
     * Apply a reusable builder function.
     */
    apply(
        fn: (b: UntypedSelectBuilder<Result>) => UntypedSelectBuilder<Result>,
    ): UntypedSelectBuilder<Result>;

    /** Generate the SQL string. */
    toBrandedString(): string & { __type: Result; };

    /** Retrieve accumulated positional query parameters. */
    getParams(): ReadonlyArray<QueryParamValue>;

    /** Generate the SQL string (unbranded). */
    toString(): string;
}

/**
 * Create an untyped SELECT query builder.
 *
 * @template Result - The expected result row type (you declare this upfront)
 *
 * @example
 * ```ts
 * interface OrderSummary {
 *     orderId: number;
 *     customerName: string;
 *     total: number;
 * }
 *
 * const query = createUntypedQuery<OrderSummary>()
 *     .from("orders o")
 *     .join("LEFT JOIN customers c ON c.id = o.customer_id")
 *     .select(["o.id AS orderId", "c.name AS customerName", "o.total"])
 *     .where("o.status = 'completed'");
 *
 * // query.toString() works as expected
 * // Type is UntypedSelectBuilder<OrderSummary>
 * ```
 */
export function createUntypedQuery<
    Result = unknown,
>(): UntypedSelectBuilder<Result> {
    // Reuse the same runtime implementation – just cast the type
    return new SelectQueryBuilderImpl<any, any, any>(
        EMPTY_RUNTIME_STATE,
    ) as unknown as UntypedSelectBuilder<Result>;
}

export const createUntypedSelectQuery = createUntypedQuery;

// ============================================================================
// SQL Assembly Utility (runtime-only)
// ============================================================================

/**
 * Assemble a SQL string from runtime builder state.
 *
 * This utility:
 * - Uses user-provided fragments as-is (no parsing or normalization).
 * - Inserts SQL keywords (SELECT, FROM, WHERE, etc.) in uppercase.
 * - Skips empty clauses entirely.
 * - Defaults to SELECT * when no select fragments are present.
 */
export function assembleSelectSQL(state: RuntimeSelectState): string {
    const parts: string[] = [];

    // WITH clause (CTEs)
    const cteIds = Object.keys(state.cteSql);
    if (cteIds.length > 0) {
        const withParts = cteIds.map(id => state.cteSql[id]).join(", ");
        parts.push(`WITH ${withParts}`);
    }

    // SELECT clause
    const selectIds = Object.keys(state.selectSql);
    if (selectIds.length === 0) {
        parts.push("SELECT *");
    }
    else {
        const selectFragments: string[] = [];
        for (const id of selectIds) {
            const cols = state.selectSql[id];
            if (cols && cols.length > 0) {
                selectFragments.push(cols.join(", "));
            }
        }
        const selectSql = selectFragments.length > 0
            ? selectFragments.join(", ")
            : "*";
        parts.push(
            state.distinct
                ? `SELECT DISTINCT ${selectSql}`
                : `SELECT ${selectSql}`,
        );
    }

    // FROM clause
    if (state.fromSql) {
        parts.push(`FROM ${state.fromSql}`);
    }

    // JOIN clauses – in the order of joins[]
    for (const join of state.joins) {
        const sql = state.joinSql[join.id];
        if (sql) {
            parts.push(sql);
        }
    }

    // WHERE clause
    const whereIds = Object.keys(state.whereSql);
    if (whereIds.length > 0) {
        const whereParts = whereIds
            .map(id => state.whereSql[id])
            .filter(Boolean);
        if (whereParts.length > 0) {
            parts.push(`WHERE ${whereParts.join(" AND ")}`);
        }
    }

    // GROUP BY
    const groupIds = Object.keys(state.groupBySql);
    if (groupIds.length > 0) {
        const groupParts = groupIds
            .map(id => state.groupBySql[id])
            .filter(Boolean);
        if (groupParts.length > 0) {
            parts.push(`GROUP BY ${groupParts.join(", ")}`);
        }
    }

    // HAVING
    const havingIds = Object.keys(state.havingSql);
    if (havingIds.length > 0) {
        const havingParts = havingIds
            .map(id => state.havingSql[id])
            .filter(Boolean);
        if (havingParts.length > 0) {
            parts.push(`HAVING ${havingParts.join(" AND ")}`);
        }
    }

    // ORDER BY
    const orderIds = Object.keys(state.orderBySql);
    if (orderIds.length > 0) {
        const orderParts = orderIds
            .map(id => state.orderBySql[id])
            .filter(Boolean);
        if (orderParts.length > 0) {
            parts.push(`ORDER BY ${orderParts.join(", ")}`);
        }
    }

    // LIMIT / OFFSET
    if (typeof state.limit === "number") {
        parts.push(`LIMIT ${state.limit}`);
    }
    if (typeof state.offset === "number") {
        parts.push(`OFFSET ${state.offset}`);
    }

    // UNION clause – appended as-is if provided
    if (state.unionSql) {
        parts.push(state.unionSql);
    }

    return parts.join(" ");
}

// ============================================================================
// Core State Types
// ============================================================================

/**
 * Empty initial state for the SELECT builder.
 *
 * Mirrors the specification in BUILDER_SPECIFICATION.md.
 */
export type EmptyState = {
    select: {};
    from: undefined;
    joins: [];
    where: {};
    groupBy: {};
    having: {};
    orderBy: {};
    limit: undefined;
    offset: undefined;
    ctes: {};
    distinct: false;
    union: undefined;
};

/**
 * Join strictness levels used for replacement validation.
 *
 * Derived from JoinType but flattened to the minimal hierarchy used
 * by the builder (INNER > LEFT = RIGHT > FULL > CROSS).
 */
export type JoinStrictness = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";

/**
 * Main builder state interface for SELECT queries.
 *
 * All fields are purely type-level; runtime representation is added later.
 */
export interface SelectBuilderState {
    /**
     * Map of user-provided IDs to select item arrays.
     * ID-based replacement overwrites the array at the given key.
     */
    readonly select: { readonly [id: string]: SelectItem[]; };

    /** FROM clause source (table or derived table) */
    readonly from: TableSource | undefined;

    /**
     * Ordered list of JOIN clauses with metadata for replacement rules.
     */
    readonly joins: ReadonlyArray<{
        readonly id: string;
        readonly ast: JoinClause;
        readonly strictness: JoinStrictness;
        readonly optional: boolean;
    }>;

    /** WHERE clause fragments, keyed by ID */
    readonly where: { readonly [id: string]: WhereExpr; };

    /** GROUP BY fragments, keyed by ID */
    readonly groupBy: { readonly [id: string]: ColumnRefType[]; };

    /** HAVING clause fragments, keyed by ID */
    readonly having: { readonly [id: string]: WhereExpr; };

    /** ORDER BY fragments, keyed by ID */
    readonly orderBy: { readonly [id: string]: OrderByItem[]; };

    /** LIMIT value */
    readonly limit: number | undefined;

    /** OFFSET value */
    readonly offset: number | undefined;

    /** CTE definitions, keyed by ID */
    readonly ctes: { readonly [id: string]: CTEDefinition; };

    /** DISTINCT flag */
    readonly distinct: boolean;

    /** Union clause with another query (if any) */
    readonly union: UnionClause | undefined;
}

/**
 * Error state used when validation fails at the builder level.
 *
 * Matches MatchError<string> from common/utils for consistency, and
 * preserves the previous valid state for tooling.
 */
export type ErrorState = MatchError<string> & {
    readonly previousState: SelectBuilderState;
};

/**
 * Convenience union for "any" builder state.
 */
export type SelectBuilderAnyState = SelectBuilderState | ErrorState;

// ============================================================================
// Type-Level Helpers for State Transitions
// ============================================================================

type ToColumnArray<T> = T extends readonly (infer S extends string)[] ? S[]
    : T extends string ? [ T ]
    : string[];

type ParsedSelectItems<
    T extends string | readonly string[],
> = ParseColumnList<ToColumnArray<T>> extends infer R
    ? R extends SelectItem[] ? R
    : SelectItem[]
    : SelectItem[];

type WithFrom<
    State extends SelectBuilderState,
    Src extends string,
> = Flatten<
    State & {
        readonly from: ParseTableRef<Src>;
    }
>;

type WithSelect<
    State extends SelectBuilderState,
    Items extends SelectItem[],
    Id extends string | undefined,
> = Flatten<
    State & {
        readonly select:
            & State["select"]
            & (
                Id extends string ? { readonly [K in Id]: Items; }
                    : { readonly [k: string]: Items; }
            );
    }
>;

type MarkOptional<Item> = Item & { readonly optional: true; };

type OptionalizeItems<Items extends SelectItem[]> = {
    [K in keyof Items]: Items[K] extends SelectItem ? MarkOptional<Items[K]>
        : never;
};

type OptionalizeNewSelects<
    Before extends SelectBuilderState,
    After extends SelectBuilderState,
> = Flatten<
    After & {
        readonly select: {
            [K in keyof After["select"]]: K extends keyof Before["select"]
                ? Before["select"][K]
                : After["select"][K] extends SelectItem[]
                    ? OptionalizeItems<After["select"][K]>
                : After["select"][K];
        };
    }
>;

/**
 * Result type of builder `.toBrandedString()` branding.
 *
 * We keep the lightweight row accumulated in `BuilderStateTag["row"]`, but
 * enrich it with any additional columns that appear in the assembled SQL
 * fragments (for example, columns selected only inside `.when()` blocks),
 * using the existing `QueryResult` matcher.
 */
export type BuilderResultType<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> =
    & Flatten<State["row"]>
    & {
        [
            K in Exclude<
                keyof BuilderFullRow<Schema, Sql>,
                keyof Flatten<State["row"]>
            >
        ]: BuilderFullRow<Schema, Sql>[K] | undefined;
    };

// ============================================================================
// Builder-level SQL & validation helpers
// ============================================================================

/**
 * Extract the assembled SQL string literal for a given builder type.
 */
export type BuilderSQL<B> = B extends SelectQueryBuilder<
    any,
    any,
    infer Sql extends BuilderSqlTag<
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
    >
> ? AssembleBuilderSql<Sql>
    : never;

/**
 * Extract the internal lightweight builder state tag from a builder type.
 */
export type BuilderStateOf<B> = B extends SelectQueryBuilder<
    any,
    infer S extends BuilderStateTag<any, any, any>,
    any
> ? S
    : never;

/**
 * Internal helper: normalize an assembled SQL string from a BuilderSqlTag
 * into a plain string type.
 */
type BuilderSqlString<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = AssembleBuilderSql<Sql> extends infer Q extends string ? Q
    : string;

/**
 * Internal helper: validate that all referenced tables in the assembled
 * SQL fragments exist in the schema. This is a shallow, table-only check
 * (no column or expression validation) to avoid hitting type recursion
 * limits while still surfacing obvious FROM/JOIN mistakes.
 */
type BuilderFromTableSpec<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = Sql["from"] extends infer F extends string
    ? F extends `${infer T} ${string}` ? T
    : F
    : never;

type BuilderJoinTablesSpec<
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = JoinClauseString<Sql> extends infer J extends string ? ExtractJoinTables<J>
    : never;

type ExtractJoinTables<S extends string> = S extends
    `${string}JOIN ${infer Rest}`
    ? Rest extends `${infer TableSpec} ${infer Tail}`
        ? TableSpec | ExtractJoinTables<Tail>
    : Rest
    : never;

type NormalizeTableSpec<
    TableSpec extends string,
> = Trim<TableSpec> extends `"${string}"`
    ? [ undefined, RemoveQuotes<TableSpec> ]
    : Trim<TableSpec> extends `\`${string}\``
        ? [ undefined, RemoveQuotes<TableSpec> ]
    : Trim<TableSpec> extends `'${string}'`
        ? [ undefined, RemoveQuotes<TableSpec> ]
    : Trim<TableSpec> extends `${infer Schema}.${infer Table}` ? [
            RemoveQuotes<Schema>,
            RemoveQuotes<Table>,
        ]
    : [ undefined, RemoveQuotes<TableSpec> ];

type BuilderCheckTable<
    Schema extends DatabaseSchema,
    TableSpec extends string,
> = IsLiteralString<TableSpec> extends false ? true
    : NormalizeTableSpec<TableSpec> extends [
        infer SchemaName extends string | undefined,
        infer TableName extends string,
    ]
        ? SchemaName extends string
            ? SchemaName extends keyof Schema["schemas"]
                ? TableName extends keyof Schema["schemas"][SchemaName] ? true
                : `Table '${TableName}' not found in schema '${SchemaName}'`
            : `Schema '${SchemaName}' not found`
        : TableName extends keyof SchemaTables<Schema> ? true
        : `Table '${TableName}' not found in default schema '${DefaultSchemaName<
            Schema
        >}'`
    : true;

type BuilderCheckTables<
    Schema extends DatabaseSchema,
    Specs extends string,
> = [ Specs ] extends [ never ] ? true
    : true extends {
        [K in Specs]: BuilderCheckTable<Schema, K> extends true ? true
            : never;
    }[Specs] ? true
    : {
        [K in Specs]: BuilderCheckTable<Schema, K> extends true ? never
            : BuilderCheckTable<Schema, K>;
    }[Specs];

type BuilderTablesValid<
    Schema extends DatabaseSchema,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = BuilderCheckTable<
    Schema,
    BuilderFromTableSpec<Sql>
> extends infer FromResult ? FromResult extends true ? BuilderCheckTables<
            Schema,
            BuilderJoinTablesSpec<Sql> & string
        >
    : FromResult
    : true;

/** Helper: base row from the lightweight state tag. */
type BuilderBaseRow<State extends BuilderStateTag<any, any, any>> = Flatten<
    State["row"]
>;

/** Split a comma-separated SELECT list into individual column expressions. */
type SplitSelectList<S extends string> = S extends
    `${infer First}, ${infer Rest}` ? [ First, ...SplitSelectList<Rest> ]
    : [ S ];

/** Map a SELECT list string into a row type using ColumnRow. */
type SelectListToRow<
    Schema extends DatabaseSchema,
    Sel extends string,
    ContextSQL extends string | undefined = undefined,
> = SplitSelectList<Sel> extends infer Cols extends readonly string[]
    ? ColumnsArrayToRow<Schema, BuilderStateTag<any, any, ContextSQL>, Cols>
    : {};

/** Helper: row inferred from the assembled SELECT fragment. */
type BuilderFullRow<
    Schema extends DatabaseSchema,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = SelectClauseString<Sql> extends infer Sel extends string
    ? SelectListToRow<Schema, Sel, ContextSqlFromTag<Sql>>
    : {};

type BuilderReturnForParts<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = BuilderTablesValid<Schema, Sql> extends true ? Flatten<State["row"]>
    : MatchError<BuilderTablesValid<Schema, Sql> & string>;

/**
 * Result type of the builder query string.
 */
export type BuilderReturnType<B> = B extends SelectQueryBuilder<
    infer Schema extends DatabaseSchema,
    infer State extends BuilderStateTag<any, any, any>,
    infer Sql extends BuilderSqlTag<
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
    >
> ? BuilderReturnForParts<Schema, State, Sql>
    : never;

/**
 * Internal helper: branded result type for `.toBrandedString()`.
 *
 * It reuses the lightweight row stored on the BuilderStateTag. Table-level
 * errors (FROM/JOIN) are surfaced as a MatchError on the branded `__type`.
 */
type BuilderResultBrand<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<any, any, any, any, any, any, any, any, any, any>,
> = BuilderReturnForParts<Schema, State, Sql>;

/**
 * Validate a builder by assembling its SQL string and running the existing
 * ValidateSQL helper over it. This runs once per builder (when the type is
 * referenced), not per method, to keep type instantiation depth manageable.
 */
export type ValidateBuilder<
    B,
> = B extends SelectQueryBuilder<
    infer Schema extends DatabaseSchema,
    any,
    infer Sql extends BuilderSqlTag<
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
    >
> ? BuilderTablesValid<Schema, Sql>
    : never;

// ============================================================================
// Join Strictness Replacement Rules
// ============================================================================

/**
 * Type-level predicate describing whether a join with OldStrictness
 * may be replaced by a join with NewStrictness.
 *
 * Follows the hierarchy:
 *   INNER > LEFT = RIGHT > FULL > CROSS
 *
 * - You may tighten (weaken-or-equal → stricter).
 * - You must not loosen (stricter → weaker).
 */
export type CanReplaceJoin<
    OldStrictness extends JoinStrictness,
    NewStrictness extends JoinStrictness,
> =
    // Strictest: INNER can only be replaced with INNER
    OldStrictness extends "INNER" ? NewStrictness extends "INNER" ? true : false
        // LEFT/RIGHT can be tightened to INNER or kept as LEFT/RIGHT
        : OldStrictness extends "LEFT" | "RIGHT"
            ? NewStrictness extends "INNER" | "LEFT" | "RIGHT" ? true : false
        // FULL can be tightened to LEFT/RIGHT/INNER or kept as FULL
        : OldStrictness extends "FULL" ? NewStrictness extends
                | "FULL"
                | "LEFT"
                | "RIGHT"
                | "INNER" ? true
            : false
        // CROSS (weakest) can be replaced with any strictness
        : OldStrictness extends "CROSS"
            ? NewStrictness extends JoinStrictness ? true : false
        : false;

/**
 * Utility for mapping a JoinType from the AST to JoinStrictness.
 *
 * This is only used at the type level; runtime mapping is added later
 * alongside the concrete builder implementation.
 */
export type JoinTypeToStrictness<
    T extends string,
> = T extends "INNER" ? "INNER"
    : T extends "LEFT" | "LEFT OUTER" ? "LEFT"
    : T extends "RIGHT" | "RIGHT OUTER" ? "RIGHT"
    : T extends "FULL" | "FULL OUTER" ? "FULL"
    : T extends "CROSS" ? "CROSS"
    : never;

// ============================================================================
// State-to-AST Conversion (Scaffolding)
// ============================================================================

/**
 * Extract all SELECT items from the state's select map and flatten them.
 *
 * Order is not preserved and is not semantically significant for
 * type-level behavior; the result is modelled as a SelectItem[].
 *
 * When no select fragments exist, callers should treat this as
 * "no explicit columns" and default to SELECT * at the SQL/string level.
 */
export type SelectItemsFromState<
    State extends SelectBuilderState,
> = State["select"][keyof State["select"]] extends infer V
    ? V extends SelectItem[] ? V[number][]
    : SelectItem[]
    : SelectItem[];

/**
 * Convert a builder state into a SelectClause AST.
 *
 * This is a structural projection only; it does not perform validation
 * or apply defaulting rules like "SELECT *" when no select() was called.
 *
 * - Columns: flattened select items (or "*" when explicitly requested
 *   by the caller via WithDefaultColumns).
 * - FROM / JOIN / WHERE / GROUP BY / HAVING / ORDER BY / LIMIT / OFFSET /
 *   DISTINCT / CTEs / UNION: mapped 1:1 from state fields.
 */
export type StateToSelectClause<
    State extends SelectBuilderState,
    Columns extends SelectItem[] | "*" = SelectItemsFromState<State>,
> = SelectClause<
    Columns,
    NonNullable<State["from"]>,
    State["joins"] extends ReadonlyArray<infer J>
        ? J extends { ast: infer A extends JoinClause; } ? A[] : undefined
        : undefined,
    // WHERE / HAVING are stored as maps keyed by ID; for validation and
    // type inference, they are typically combined with AND. For now we
    // expose the raw union-of-entries as WhereExpr | undefined; this is
    // sufficient scaffolding for later builder phases to refine.
    State["where"][keyof State["where"]] | undefined,
    State["groupBy"][keyof State["groupBy"]] extends infer GB
        ? GB extends ColumnRefType[] ? GB[number][]
        : ColumnRefType[] | undefined
        : ColumnRefType[] | undefined,
    State["having"][keyof State["having"]] | undefined,
    State["orderBy"][keyof State["orderBy"]] extends infer OB
        ? OB extends OrderByItem[] ? OB[number][]
        : OrderByItem[] | undefined
        : OrderByItem[] | undefined,
    State["limit"],
    State["offset"],
    State["distinct"],
    State["ctes"][keyof State["ctes"]] extends infer C
        ? C extends CTEDefinition ? C[]
        : CTEDefinition[] | undefined
        : CTEDefinition[] | undefined
>;

/**
 * Helper to wrap a SelectClause produced from state in a UnionClause
 * when the state's union field is present.
 *
 * This is a small convenience for later phases that need to pass a
 * SelectClause-or-UnionClause into validator/matcher logic.
 */
export type StateToSelectQueryClause<
    State extends SelectBuilderState,
    Columns extends SelectItem[] | "*" = SelectItemsFromState<State>,
> = State["union"] extends UnionClause<
    infer Left extends SelectClause,
    infer Op extends UnionOperatorType,
    infer Right
> ? UnionClause<Left, Op, Right>
    : StateToSelectClause<State, Columns>;
