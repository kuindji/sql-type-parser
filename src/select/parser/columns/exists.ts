/**
 * EXISTS expression parsing
 */

import type {
    ColumnRef,
    ExistsExpr,
    ExtendedColumnRefType,
    SelectClause,
    SQLSelectQuery,
} from "../../ast.js";
import type { ComplexExpr } from "../../../common/ast.js";
import type { Trim } from "../../../common/utils.js";
import type {
    ExtractAliasFromRemainder,
    ExtractUntilClosingParen,
} from "./utils.js";

// Import ParseSelectQuery for subquery parsing
// TypeScript can handle circular type-only imports
import type { ParseSelectQuery } from "../index.js";

// ============================================================================
// EXISTS Expression Parsing
// ============================================================================

/**
 * Check if the expression is EXISTS or NOT EXISTS
 * Patterns: EXISTS ( SELECT ..., NOT EXISTS ( SELECT ...
 */
export type IsExistsExpression<T extends string> = Trim<T> extends
    `EXISTS ( SELECT ${string}` ? true
    : Trim<T> extends `NOT EXISTS ( SELECT ${string}` ? true
    : false;

/**
 * Parse an EXISTS/NOT EXISTS column expression
 * Creates an ExistsExpr with the inner subquery
 */
export type ParseExistsColumn<T extends string> =
    ExtractExistsWithAlias<Trim<T>> extends [
        infer ExistsResult extends ExtendedColumnRefType,
        infer Alias extends string,
    ] ? ColumnRef<ExistsResult, Alias>
        : ColumnRef<ComplexExpr<[], undefined>, "exists">;

/**
 * Extract EXISTS expression and optional alias
 * Returns [ExistsExpr | ComplexExpr, alias]
 */
type ExtractExistsWithAlias<T extends string> =
    // NOT EXISTS pattern with alias
    Trim<T> extends `NOT EXISTS ( ${infer Rest}`
        ? ExtractExistsInnerAndAlias<Rest, true>
        // EXISTS pattern with alias
        : Trim<T> extends `EXISTS ( ${infer Rest}`
            ? ExtractExistsInnerAndAlias<Rest, false>
        : [ComplexExpr<[], undefined>, "exists"];

/**
 * Extract the inner SELECT and alias from EXISTS expression
 * Input: Rest starts after "EXISTS ( " or "NOT EXISTS ( "
 */
type ExtractExistsInnerAndAlias<Rest extends string, Negated extends boolean> =
    ExtractUntilClosingParen<Rest, 1, ""> extends
        [infer Inner extends string, infer Remainder extends string]
        ? ParseExistsInnerQuery<Inner, Negated> extends infer Result
            ? ExtractAliasFromRemainder<Remainder> extends
                infer Alias extends string ? [Result, Alias]
            : [Result, "exists"]
        : [ComplexExpr<[], undefined>, "exists"]
        : [ComplexExpr<[], undefined>, "exists"];

/**
 * Parse the inner SELECT query for EXISTS
 */
type ParseExistsInnerQuery<Inner extends string, Negated extends boolean> =
    ParseSelectQuery<Inner> extends
        SQLSelectQuery<infer Query extends SelectClause>
        ? ExistsExpr<Query, Negated>
        : ComplexExpr<[], undefined>;
