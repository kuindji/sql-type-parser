/**
 * Union clause matching types
 *
 * Handles UNION, INTERSECT, and EXCEPT operations between SELECT queries.
 */

import type {
    SelectClause,
    UnionClause,
    UnionClauseAny,
    UnionOperatorType,
} from "../ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type { MatchError } from "../../common/utils.js";

import type { MatchSelectClause } from "./main.js";

// ============================================================================
// Union Matching
// ============================================================================

/**
 * Match a union clause and return the combined result type
 * For UNION: result is the union of both sides (same shape, TypeScript union of values)
 * For INTERSECT: result is the intersection (same shape)
 * For EXCEPT: result is the left side's shape
 */
export type MatchUnionClause<
    Union extends UnionClauseAny,
    Schema extends DatabaseSchema,
> = Union extends UnionClause<infer Left, infer Op, infer Right>
    ? MatchSelectClause<Left, Schema> extends infer LeftResult
        ? LeftResult extends MatchError<string> ? LeftResult
        : Right extends UnionClauseAny
            ? MatchUnionClause<Right, Schema> extends infer RightResult
                ? RightResult extends MatchError<string> ? RightResult
                : CombineUnionResults<LeftResult, RightResult, Op>
            : never
        : Right extends SelectClause
            ? MatchSelectClause<Right, Schema> extends infer RightResult
                ? RightResult extends MatchError<string> ? RightResult
                : CombineUnionResults<LeftResult, RightResult, Op>
            : never
        : MatchError<"Invalid right side of union">
    : never
    : MatchError<"Invalid union clause">;

/**
 * Combine results from two sides of a union operation
 * The result columns must have matching names - we return the left side's structure
 * with types that could come from either side
 */
export type CombineUnionResults<
    Left,
    Right,
    Op extends UnionOperatorType,
> = Op extends "UNION" | "UNION ALL" ? UnionResultType<Left, Right>
    : Op extends "INTERSECT" | "INTERSECT ALL"
        ? IntersectResultType<Left, Right>
    : Op extends "EXCEPT" | "EXCEPT ALL" ? Left // EXCEPT returns left side's rows, so use left's type
    : Left;

/**
 * For UNION: create a type that could be from either side
 * If both sides have the same column name, the result is the union of their types
 */
export type UnionResultType<Left, Right> = {
    [K in keyof Left]: K extends keyof Right ? Left[K] | Right[K]
        : Left[K];
};

/**
 * For INTERSECT: create a type that exists in both sides
 * If both sides have the same column name, the result is their common type
 */
export type IntersectResultType<Left, Right> = {
    [K in keyof Left]: K extends keyof Right
        ? Left[K] & Right[K] extends never ? Left[K] | Right[K] // If no intersection, allow either
        : Left[K] & Right[K]
        : Left[K];
};
