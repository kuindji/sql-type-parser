/**
 * Clause List Manipulation Types
 *
 * Type-level utilities for managing SQL clause fragments with ID-based
 * insertion, replacement, and removal.
 */

import type { AnyBuilderSqlTag, ClauseList, SqlClausePart } from "./state-tags.js";
import type { ToStringArray } from "./string-utils.js";

// ============================================================================
// String Joining
// ============================================================================

/**
 * Join an array of string literal parts with a separator.
 * Optimized with tail-call accumulator pattern.
 */
type JoinWith<
    Parts extends string[],
    Sep extends string,
    Acc extends string = "",
> = Parts extends [infer First extends string, ...infer Rest extends string[]]
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

// ============================================================================
// Clause List Utilities
// ============================================================================

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

// ============================================================================
// Clause List Manipulation
// ============================================================================

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
    : UpsertClausePart<Rest, Id, Sql, Seen, readonly [...Acc, First]>
    : Seen extends true ? Acc
    : readonly [...Acc, { readonly id: Id; readonly sql: Sql; }];

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
        First["id"] extends Id ? Acc : readonly [...Acc, First]
    >
    : Acc;

// ============================================================================
// Clause Value Conversion
// ============================================================================

export type ClauseValueToString<Value, Sep extends string> = Value extends
    string ? Value
    : Value extends ClauseList ? ClauseListStringOrUndefined<Value, Sep>
    : undefined;

export type SelectClauseString<
    Sql extends AnyBuilderSqlTag,
> = ClauseValueToString<Sql["select"], ", ">;

export type JoinClauseString<
    Sql extends AnyBuilderSqlTag,
> = ClauseValueToString<Sql["joins"], " ">;

// ============================================================================
// Context SQL Assembly
// ============================================================================

export type ContextSqlFromTag<
    Sql extends AnyBuilderSqlTag,
> = Sql["from"] extends infer From extends string
    ? JoinClauseString<Sql> extends infer Joins extends string
        ? Joins extends "" ? `FROM ${From}` : `FROM ${From} ${Joins}`
    : `FROM ${From}`
    : JoinClauseString<Sql> extends infer Joins extends string ? Joins
    : undefined;
