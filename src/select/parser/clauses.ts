/**
 * Type-level SQL SELECT clause parsers
 *
 * This module handles parsing of WHERE, GROUP BY, HAVING,
 * ORDER BY, LIMIT, and OFFSET clauses.
 */

import type {
    ColumnRefType,
    JoinClause,
    OrderByItem,
    ParsedCondition,
    ValidatableColumnRef,
    WhereExpr,
} from "../../common/ast.js";

import type {
    ExtractUntil,
    NextToken,
    OrderByTerminators,
    SplitByComma,
    WhereTerminators,
} from "../../common/tokenizer.js";

import type {
    ParseError,
    Trim,
} from "../../common/utils.js";

import type {
    ExtractColumnFromToken,
    ParseColumnRefType,
    ScanTokensForColumnRefs,
} from "./columns.js";

import type { ParseJoins } from "./joins.js";

// ============================================================================
// WHERE Clause Parser
// ============================================================================

/**
 * Parse WHERE clause
 * Extracts column references for validation without fully parsing the expression structure.
 */
export type ParseWhereClause<T extends string> = Trim<T> extends ""
    ? { where: undefined; rest: ""; }
    : NextToken<T> extends ["WHERE", infer Rest extends string]
        ? ExtractUntil<Rest, WhereTerminators> extends [
            infer WherePart extends string,
            infer Remaining extends string,
        ] ? {
                where: ParsedCondition<
                    ScanTokensForColumnRefs<Trim<WherePart>, []>
                >;
                rest: Remaining;
            }
        : {
            where: ParsedCondition<ScanTokensForColumnRefs<Trim<Rest>, []>>;
            rest: "";
        }
    : { where: undefined; rest: T; };

// ============================================================================
// GROUP BY Parser
// ============================================================================

/**
 * Parse GROUP BY clause
 */
type ParseGroupBy<T extends string> = Trim<T> extends ""
    ? { groupBy: undefined; rest: ""; }
    : NextToken<T> extends ["GROUP", infer Rest extends string]
        ? NextToken<Rest> extends ["BY", infer AfterBy extends string]
            ? ExtractUntil<
                AfterBy,
                "HAVING" | "ORDER" | "LIMIT" | "OFFSET"
            > extends [
                infer GroupPart extends string,
                infer Remaining extends string,
            ] ? { groupBy: ParseGroupByList<GroupPart>; rest: Remaining; }
            : { groupBy: ParseGroupByList<AfterBy>; rest: ""; }
        : ParseError<"Expected BY after GROUP">
    : { groupBy: undefined; rest: T; };

/**
 * Parse GROUP BY column list
 */
type ParseGroupByList<T extends string> = SplitByComma<Trim<T>> extends
    infer Parts extends string[] ? ParseGroupByColumns<Parts>
    : [];

/**
 * Parse list of GROUP BY columns
 */
type ParseGroupByColumns<T extends string[]> = T extends [
    infer First extends string,
    ...infer Rest extends string[],
] ? [ParseColumnRefType<First>, ...ParseGroupByColumns<Rest>]
    : [];

// ============================================================================
// HAVING Parser
// ============================================================================

/**
 * Parse HAVING clause
 * Extracts column references for validation
 */
type ParseHaving<T extends string> = Trim<T> extends ""
    ? { having: undefined; rest: ""; }
    : NextToken<T> extends ["HAVING", infer Rest extends string]
        ? ExtractUntil<Rest, "ORDER" | "LIMIT" | "OFFSET"> extends [
            infer HavingPart extends string,
            infer Remaining extends string,
        ] ? {
                having: ParsedCondition<
                    ScanTokensForColumnRefs<Trim<HavingPart>, []>
                >;
                rest: Remaining;
            }
        : {
            having: ParsedCondition<ScanTokensForColumnRefs<Trim<Rest>, []>>;
            rest: "";
        }
    : { having: undefined; rest: T; };

// ============================================================================
// ORDER BY Parser
// ============================================================================

/**
 * Parse ORDER BY clause
 */
type ParseOrderBy<T extends string> = Trim<T> extends ""
    ? { orderBy: undefined; rest: ""; }
    : NextToken<T> extends ["ORDER", infer Rest extends string]
        ? NextToken<Rest> extends ["BY", infer AfterBy extends string]
            ? ExtractUntil<AfterBy, OrderByTerminators> extends [
                infer OrderPart extends string,
                infer Remaining extends string,
            ] ? { orderBy: ParseOrderByList<OrderPart>; rest: Remaining; }
            : { orderBy: ParseOrderByList<AfterBy>; rest: ""; }
        : ParseError<"Expected BY after ORDER">
    : { orderBy: undefined; rest: T; };

/**
 * Parse ORDER BY column list
 */
type ParseOrderByList<T extends string> = SplitByComma<Trim<T>> extends
    infer Parts extends string[] ? ParseOrderByItems<Parts>
    : [];

/**
 * Parse list of ORDER BY items
 */
export type ParseOrderByItems<T extends string[]> = T extends [
    infer First extends string,
    ...infer Rest extends string[],
] ? [ParseOrderByItem<First>, ...ParseOrderByItems<Rest>]
    : [];

/**
 * Parse a single ORDER BY item
 * Handles: col, col ASC, col DESC, col NULLS FIRST, col DESC NULLS LAST, etc.
 */
export type ParseOrderByItem<T extends string> =
    // Pattern: col DESC NULLS FIRST/LAST
    Trim<T> extends `${infer Col} DESC NULLS FIRST`
        ? OrderByItem<ParseOrderByColumnRef<Col>, "DESC">
        : Trim<T> extends `${infer Col} DESC NULLS LAST`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "DESC">
        // Pattern: col ASC NULLS FIRST/LAST
        : Trim<T> extends `${infer Col} ASC NULLS FIRST`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
        : Trim<T> extends `${infer Col} ASC NULLS LAST`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
        // Pattern: col NULLS FIRST/LAST (defaults to ASC)
        : Trim<T> extends `${infer Col} NULLS FIRST`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
        : Trim<T> extends `${infer Col} NULLS LAST`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
        // Pattern: col DESC (no NULLS)
        : Trim<T> extends `${infer Col} DESC`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "DESC">
        // Pattern: col ASC (no NULLS)
        : Trim<T> extends `${infer Col} ASC`
            ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
        // Pattern: just col (defaults to ASC)
        : OrderByItem<ParseOrderByColumnRef<Trim<T>>, "ASC">;

/**
 * Parse column reference for ORDER BY, handling JSON accessors
 */
type ParseOrderByColumnRef<T extends string> =
    // First try to extract from JSON expression using the token-based extractor
    ExtractColumnFromToken<Trim<T>> extends
        infer Result extends ValidatableColumnRef ? Result
        : ParseColumnRefType<T>; // Fallback to regular parsing for non-JSON columns

// ============================================================================
// LIMIT/OFFSET Parser
// ============================================================================

/**
 * Parse LIMIT and OFFSET clauses
 */
type ParseLimitOffset<T extends string> = ParseLimitOffsetWithRest<T> extends
    infer Result ? Result extends { rest: string; } ? Omit<Result, "rest">
    : Result
    : never;

/**
 * Parse LIMIT and OFFSET clauses, returning remaining rest
 */
type ParseLimitOffsetWithRest<T extends string> = ParseLimit<T> extends {
    limit: infer Limit;
    rest: infer AfterLimit extends string;
}
    ? ParseOffset<AfterLimit> extends
        { offset: infer Offset; rest: infer AfterOffset extends string; }
        ? { limit: Limit; offset: Offset; rest: AfterOffset; }
    : { limit: Limit; offset: undefined; rest: AfterLimit; }
    : ParseOffset<T> extends
        { offset: infer Offset; rest: infer AfterOffset extends string; }
        ? ParseLimit<AfterOffset> extends
            { limit: infer Limit; rest: infer AfterLimit extends string; }
            ? { limit: Limit; offset: Offset; rest: AfterLimit; }
        : { limit: undefined; offset: Offset; rest: AfterOffset; }
    : { limit: undefined; offset: undefined; rest: T; };

/**
 * Parse LIMIT clause
 */
type ParseLimit<T extends string> = Trim<T> extends ""
    ? { limit: undefined; rest: ""; }
    : NextToken<T> extends ["LIMIT", infer Rest extends string]
        ? NextToken<Rest> extends
            [infer Num extends string, infer Remaining extends string]
            ? { limit: ParseNumber<Num>; rest: Remaining; }
        : { limit: undefined; rest: T; }
    : { limit: undefined; rest: T; };

/**
 * Parse OFFSET clause
 */
type ParseOffset<T extends string> = Trim<T> extends ""
    ? { offset: undefined; rest: ""; }
    : NextToken<T> extends ["OFFSET", infer Rest extends string]
        ? NextToken<Rest> extends
            [infer Num extends string, infer Remaining extends string]
            ? { offset: ParseNumber<Num>; rest: Remaining; }
        : { offset: undefined; rest: T; }
    : { offset: undefined; rest: T; };

/**
 * Parse a string as a number
 */
type ParseNumber<T extends string> = T extends `${infer N extends number}` ? N
    : undefined;

// ============================================================================
// Optional Clauses Combined Parser
// ============================================================================

/**
 * Parse all optional clauses (JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET)
 */
export type ParseOptionalClauses<T extends string> =
    ParseOptionalClausesWithRest<T> extends infer Result
        ? Result extends { rest: string; } ? Omit<Result, "rest">
        : Result
        : never;

/**
 * Parse all optional clauses with remaining rest
 */
export type ParseOptionalClausesWithRest<T extends string> = ParseJoins<T> extends
    infer JoinResult
    ? JoinResult extends
        { joins: infer Joins; rest: infer AfterJoins extends string; }
        ? ParseWhereClause<AfterJoins> extends infer WhereResult
            ? WhereResult extends
                { where: infer Where; rest: infer AfterWhere extends string; }
                ? ParseGroupBy<AfterWhere> extends infer GroupByResult
                    ? GroupByResult extends {
                        groupBy: infer GroupBy;
                        rest: infer AfterGroupBy extends string;
                    }
                        ? ParseHaving<AfterGroupBy> extends infer HavingResult
                            ? HavingResult extends {
                                having: infer Having;
                                rest: infer AfterHaving extends string;
                            }
                                ? ParseOrderBy<AfterHaving> extends
                                    infer OrderByResult
                                    ? OrderByResult extends {
                                        orderBy: infer OrderBy;
                                        rest: infer AfterOrderBy extends string;
                                    } ? ParseLimitOffsetWithRest<
                                            AfterOrderBy
                                        > extends infer LimitResult
                                            ? LimitResult extends {
                                                limit: infer Limit;
                                                offset: infer Offset;
                                                rest: infer AfterLimitOffset
                                                    extends string;
                                            } ? {
                                                    joins: Joins;
                                                    where: Where;
                                                    groupBy: GroupBy;
                                                    having: Having;
                                                    orderBy: OrderBy;
                                                    limit: Limit;
                                                    offset: Offset;
                                                    rest: AfterLimitOffset;
                                                }
                                            : never
                                        : never
                                    : never
                                : never
                            : never
                        : never
                    : never
                : never
            : never
        : never
    : never
    : never;
