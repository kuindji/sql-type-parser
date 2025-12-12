/**
 * CAST expression parsing
 */

import type { ColumnRef } from "../../ast.js";
import type { ComplexExpr, ValidatableColumnRef } from "../../../common/ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";

// Forward declaration - actual implementation in complex.ts
// We import at runtime but the type is resolved at compile time
import type { ExtractAllColumnRefs } from "./complex.js";

// ============================================================================
// CAST Expression Parsing
// ============================================================================

/**
 * Check if the expression is a CAST function
 * CAST ( expr AS type ) - note: AS inside CAST is different from column alias AS
 */
export type IsCastExpression<T extends string> = Trim<T> extends
    `CAST ( ${string}` ? true
    : Trim<T> extends `cast ( ${string}` ? true
    : false;

/**
 * Parse a CAST expression column
 * Handles: CAST ( expr AS type ) AS alias
 */
export type ParseCastColumn<T extends string> =
    // Pattern: CAST ( expr AS type ) AS alias
    ExtractCastContent<Trim<T>> extends [
        infer CastExpr extends string,
        infer CastType extends string,
        infer Rest extends string,
    ]
        ? Trim<Rest> extends `AS ${infer Alias}`
            ? ColumnRef<ParseCastExpr<CastExpr, CastType>, RemoveQuotes<Alias>>
        : ColumnRef<
            ParseCastExpr<CastExpr, CastType>,
            ExtractCastAlias<CastExpr>
        >
        : ColumnRef<ComplexExpr<[], undefined>, "cast">;

/**
 * Parse the CAST expression into a ComplexExpr with the cast type
 */
type ParseCastExpr<Expr extends string, CastType extends string> = ComplexExpr<
    ExtractAllColumnRefs<Expr>,
    CastType,
    `CAST ( ${Expr} AS ${CastType} )`
>;

/**
 * Extract alias from CAST expression (use the expression name or "cast")
 */
type ExtractCastAlias<Expr extends string> = Trim<Expr> extends
    `${infer _}.${infer Col}` ? Col
    : Trim<Expr> extends "" ? "cast"
    : Trim<Expr>;

/**
 * Extract content from a CAST expression
 * Input: "CAST ( expr AS type ) rest" or "cast ( expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastContent<T extends string> =
    // Remove CAST keyword (case-insensitive after normalization)
    Trim<T> extends `CAST ( ${infer Content}` ? ExtractCastParts<Content>
        : Trim<T> extends `cast ( ${infer Content}` ? ExtractCastParts<Content>
        : never;

/**
 * Extract expression and type from inside CAST parentheses
 * Input: "expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastParts<T extends string> =
    // Find the AS keyword that separates expr from type
    T extends `${infer Expr} AS ${infer TypeAndRest}`
        ? ExtractCastType<TypeAndRest> extends
            [infer CastType extends string, infer Rest extends string]
            ? [Trim<Expr>, Trim<CastType>, Trim<Rest>]
        : never
        : never;

/**
 * Extract the type and remainder after the closing paren
 * Input: "text ) AS alias" or "varchar ( 255 ) ) rest"
 * Returns: [type, rest]
 */
type ExtractCastType<T extends string> =
    // Handle type with precision: varchar ( 255 ) )
    T extends `${infer Type} ( ${infer Precision} ) ) ${infer Rest}`
        ? [`${Trim<Type>}(${Trim<Precision>})`, Rest]
        : T extends `${infer Type} ( ${infer Precision} ) )`
            ? [`${Trim<Type>}(${Trim<Precision>})`, ""]
        // Simple type: text )
        : T extends `${infer Type} ) ${infer Rest}` ? [Trim<Type>, Rest]
        : T extends `${infer Type} )` ? [Trim<Type>, ""]
        : never;
