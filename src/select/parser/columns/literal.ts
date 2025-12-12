/**
 * Literal expression parsing (numbers, strings, NULL, TRUE, FALSE)
 */

import type { ColumnRef, LiteralExpr } from "../../ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";

// ============================================================================
// Literal Expression Parsing
// ============================================================================

/**
 * Check if the expression is a literal value (number, string, null, boolean)
 * Examples: 1, 42, 'hello', 'world', NULL, TRUE, FALSE
 */
export type IsLiteralExpression<T extends string> =
    // Check with alias first
    Trim<T> extends `${infer Expr} AS ${string}` ? IsLiteralValue<Trim<Expr>>
        : IsLiteralValue<Trim<T>>;

/**
 * Check if the value is a literal
 */
export type IsLiteralValue<T extends string> =
    // Numeric literals
    T extends `${number}` ? true
        // Negative numeric literals
        : T extends `-${number}` ? true
        // String literals (single-quoted)
        : T extends `'${string}'` ? true
        // NULL literal
        : T extends "NULL" ? true
        // Boolean literals
        : T extends "TRUE" | "FALSE" ? true
        : false;

/**
 * Parse a literal column expression
 * Handles: 1 AS num, 'hello' AS str, NULL AS nothing, TRUE AS flag
 */
export type ParseLiteralColumn<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseLiteralExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseLiteralExpr<Trim<T>>, ExtractLiteralAlias<Trim<T>>>;

/**
 * Parse a literal expression into a LiteralExpr AST node
 */
export type ParseLiteralExpr<T extends string> =
    // NULL literal
    T extends "NULL" ? LiteralExpr<null>
        // Boolean TRUE
        : T extends "TRUE" ? LiteralExpr<true>
        // Boolean FALSE
        : T extends "FALSE" ? LiteralExpr<false>
        // String literal (single-quoted)
        : T extends `'${infer Str}'` ? LiteralExpr<Str>
        // Negative number literal
        : T extends `-${infer Num extends number}` ? LiteralExpr<
                `-${Num}` extends `${infer N extends number}` ? N : number
            >
        // Positive number literal
        : T extends `${infer Num extends number}` ? LiteralExpr<Num>
        : LiteralExpr<string | number | boolean | null>;

/**
 * Extract a default alias for a literal (returns a descriptive name)
 */
export type ExtractLiteralAlias<T extends string> = T extends "NULL" ? "null"
    : T extends "TRUE" | "FALSE" ? "bool"
    : T extends `'${string}'` ? "text"
    : T extends `${number}` | `-${number}` ? "int4"
    : "literal";
