/**
 * Scalar subquery expression parsing
 */

import type {
    ColumnRef,
    SelectClause,
    SQLSelectQuery,
    SubqueryExpr,
} from "../../ast.js";
import type { ComplexExpr } from "../../../common/ast.js";
import type { ParseError, RemoveQuotes, Trim } from "../../../common/utils.js";
import type {
    ExtractParenthesizedContent,
    ExtractSubqueryCastType,
} from "./utils.js";

// Import ParseSelectQuery for subquery parsing
// TypeScript can handle circular type-only imports
import type { ParseSelectQuery } from "../index.js";

// ============================================================================
// Subquery Expression Parsing
// ============================================================================

/**
 * Check if the expression is a scalar subquery (starts with parenthesized SELECT)
 */
export type IsSubqueryExpression<T extends string> = Trim<T> extends
    `( SELECT ${string}` ? true : false;

/**
 * Parse a scalar subquery column expression
 * Extracts the inner SELECT, parses it, and creates a SubqueryExpr
 */
export type ParseSubqueryColumn<T extends string> = T extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseSubqueryExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseSubqueryExpr<T>, "subquery">;

/**
 * Parse a subquery expression, extracting the SELECT from parentheses
 */
type ParseSubqueryExpr<T extends string> =
    ExtractParenthesizedContent<Trim<T>> extends
        [infer Inner extends string, infer Remainder extends string]
        ? ParseSelectQuery<Inner> extends
            SQLSelectQuery<infer Query extends SelectClause>
            ? SubqueryExpr<Query, ExtractSubqueryCastType<Remainder>>
        : ParseSelectQuery<Inner> extends ParseError<infer E>
            ? ComplexExpr<[], undefined> // Fallback to unknown on parse error
        : ComplexExpr<[], undefined>
        : ComplexExpr<[], undefined>;
