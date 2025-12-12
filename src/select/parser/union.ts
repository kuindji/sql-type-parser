/**
 * Type-level SQL SELECT UNION/INTERSECT/EXCEPT parser
 *
 * This module handles parsing of set operations (UNION, INTERSECT, EXCEPT)
 * between SELECT queries.
 */

import type {
    SelectClause,
    SQLSelectQuery,
    UnionClause,
    UnionClauseAny,
    UnionOperatorType,
} from "../ast.js";

import type { NextToken } from "../../common/tokenizer.js";

import type { ParseError, Trim } from "../../common/utils.js";

// Forward declaration - actual implementation provided by main parser
export type ParseSelectQueryWithRest<T extends string> = {
    query: SelectClause;
    rest: string;
} | SQLSelectQuery<SelectClause> | ParseError<string>;

// ============================================================================
// Union Parser
// ============================================================================

/**
 * Check if there's a union operator and parse accordingly
 */
export type CheckForUnion<
    Left extends SelectClause,
    Rest extends string,
    ParseSelectQueryWithRestFn extends (t: string) => any = any,
> = Trim<Rest> extends "" ? SQLSelectQuery<Left>
    : ParseUnionOperator<Rest> extends
        [infer Op extends UnionOperatorType, infer AfterOp extends string]
        ? ParseSelectQueryWithRestFn extends (t: infer T extends string) => infer R
            ? CheckForUnionImpl<Left, Op, AfterOp>
        : CheckForUnionImpl<Left, Op, AfterOp>
    : SQLSelectQuery<Left>;

/**
 * Implementation of union checking with simplified recursive handling
 */
type CheckForUnionImpl<
    Left extends SelectClause,
    Op extends UnionOperatorType,
    AfterOp extends string,
> = {
    __unionPending: true;
    left: Left;
    operator: Op;
    rest: AfterOp;
};

/**
 * Handle more unions on the right side
 */
export type CheckForMoreUnions<
    Left extends SelectClause,
    Op extends UnionOperatorType,
    Right extends SelectClause,
    Rest extends string,
> = Trim<Rest> extends "" ? SQLSelectQuery<UnionClause<Left, Op, Right>>
    : ParseUnionOperator<Rest> extends [
        infer NextOp extends UnionOperatorType,
        infer AfterNextOp extends string,
    ] ? {
            __moreUnionsPending: true;
            left: Left;
            operator: Op;
            right: Right;
            nextOperator: NextOp;
            rest: AfterNextOp;
        }
    : SQLSelectQuery<UnionClause<Left, Op, Right>>;

/**
 * Parse a union operator and return [operator, remaining string]
 */
export type ParseUnionOperator<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
]
    ? First extends "UNION"
        ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
            ? ["UNION ALL", AfterAll]
        : ["UNION", Rest]
    : First extends "INTERSECT"
        ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
            ? ["INTERSECT ALL", AfterAll]
        : ["INTERSECT", Rest]
    : First extends "EXCEPT"
        ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
            ? ["EXCEPT ALL", AfterAll]
        : ["EXCEPT", Rest]
    : never
    : never;
