/**
 * SQL Tag Update Types
 *
 * Type-level utilities for updating BuilderSqlTag fields.
 */

import type { ConditionTreeBuilder } from "../../../common/builder.js";
import type { QueryParamValue } from "../../../common/builder.js";
import type { DatabaseSchema } from "../../../common/schema.js";
import type { IsUnion } from "../../../common/utils.js";
import type { BuilderFullRow } from "../return-type.js";
import type {
    ClauseListOrUndefined,
    ColsToString,
    ContextSqlFromTag,
    NormalizeClauseList,
    RemoveClausePart,
    UpsertClausePart,
} from "./clause-list.js";
import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
    BuilderSqlTag,
    BuilderStateTag,
    IsUnionSqlError,
    UnionSqlError,
} from "./state-tags.js";

// ============================================================================
// Optimized BuilderSqlTag Update Helper
// ============================================================================

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

// ============================================================================
// SELECT Clause Updates
// ============================================================================

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

// ============================================================================
// FROM Clause Updates
// ============================================================================

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

// ============================================================================
// JOIN Clause Updates
// ============================================================================

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

// ============================================================================
// WHERE Clause Updates
// ============================================================================

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
    where: [Sql["where"]] extends [string]
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

// ============================================================================
// GROUP BY Clause Updates
// ============================================================================

/**
 * Internal: Append a GROUP BY fragment (combined with commas) to the SQL tag.
 * Use WithGroupBySql which includes union detection.
 */
export type WithGroupBySqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    groupBy: [Sql["groupBy"]] extends [string]
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

// ============================================================================
// HAVING Clause Updates
// ============================================================================

/**
 * Internal: Append a HAVING fragment (combined with AND) to the SQL tag.
 * Use WithHavingSql which includes union detection.
 */
export type WithHavingSqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cond,
> = UpdateSqlTag<Sql, {
    having: [Sql["having"]] extends [string]
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

// ============================================================================
// ORDER BY Clause Updates
// ============================================================================

/**
 * Internal: Append an ORDER BY fragment (combined with commas) to the SQL tag.
 * Use WithOrderBySql which includes union detection.
 */
export type WithOrderBySqlInternal<
    Sql extends AnyBuilderSqlTag,
    Cols extends string | readonly string[],
    Id extends string | undefined,
> = UpdateSqlTag<Sql, {
    orderBy: [Sql["orderBy"]] extends [string]
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

// ============================================================================
// LIMIT/OFFSET Clause Updates
// ============================================================================

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

// ============================================================================
// Named Parameters Update
// ============================================================================

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

// ============================================================================
// State from SQL Tag
// ============================================================================

export type StateFromSql<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Sql extends AnyBuilderSqlTag,
> = BuilderStateTag<
    State["fromTable"],
    BuilderFullRow<Schema, Sql>,
    ContextSqlFromTag<Sql>
>;

// ============================================================================
// Conditional Update Helpers
// ============================================================================

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

// ============================================================================
// Conditional State Merging
// ============================================================================

import type { Flatten } from "../../../common/utils.js";

export type OptionalizeNewKeys<
    BeforeRow,
    AfterRow,
> = {
    [K in keyof AfterRow]-?: K extends keyof BeforeRow ? AfterRow[K]
        : AfterRow[K] | undefined;
};

export type MergeConditionalState<
    Before extends AnyBuilderStateTag,
    After extends AnyBuilderStateTag,
> = BuilderStateTag<
    Before["fromTable"] | After["fromTable"],
    Flatten<Before["row"] & OptionalizeNewKeys<Before["row"], After["row"]>>,
    Before["contextSQL"] | After["contextSQL"]
>;
