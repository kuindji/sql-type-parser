/**
 * Core Builder State Tag Types
 *
 * Lightweight, non-AST builder state tags used for result typing and SQL reconstruction.
 */

import type { QueryParamValue } from "../../../common/builder.js";
import type { UnionQueryError } from "../../../common/utils.js";

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

// Clause fragment helpers with ID-aware lists to support removal.
export type SqlClausePart = { readonly id: string; readonly sql: string; };
export type ClauseList = readonly SqlClausePart[];

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
 * Error state for when union types are detected in column specifications.
 * This prevents TypeScript from distributing over unions and causing
 * exponential type computation.
 */
export type UnionColumnsError = BuilderStateTag<
    undefined,
    UnionQueryError,
    undefined
>;

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
