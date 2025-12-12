/**
 * Column classification and optimized dispatch
 */

import type { ColumnRef } from "../../ast.js";
import type { TableWildcard } from "../../../common/ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";
import type { IsComplexExpression } from "./complex.js";
import type { IsSQLConstantExpression } from "./sql-constant.js";
import type { ExtractColumnName, StripTypeCast } from "./utils.js";
import type { ParseColumnRefType } from "./reference.js";

// Import all the parsers
import type { ParseTableWildcard } from "./wildcard.js";
import type { ParseLiteralColumn } from "./literal.js";
import type { ParseSQLConstantColumn } from "./sql-constant.js";
import type { ParseIntervalColumn } from "./interval.js";
import type { ParseExistsColumn } from "./exists.js";
import type { ParseSubqueryColumn } from "./subquery.js";
import type { ParseCastColumn } from "./cast.js";
import type { ParseComplexColumn } from "./complex.js";

// ============================================================================
// Column Classification
// ============================================================================

/**
 * Classify a column expression by its first distinctive pattern.
 * This reduces the number of type guard evaluations from 12+ to ~3
 * by using first-character/pattern dispatch.
 *
 * IMPORTANT: Complex expressions check must happen before literal checks
 * because expressions like "1 + 1" start with a number but are complex.
 */
export type ClassifyColumnType<T extends string> =
    // Global wildcard
    T extends "*" ? "wildcard"
    // Table wildcard (t.* or schema.t.*)
    : T extends `${string}.*` | `${string}. *` ? "table_wildcard"
    // EXISTS/NOT EXISTS (check before complex since IsComplexExpression includes parens)
    : T extends `EXISTS ( ${string}` | `NOT EXISTS ( ${string}` ? "exists"
    // Scalar subquery (check before complex since IsComplexExpression includes parens)
    : T extends `( SELECT ${string}` ? "subquery"
    // CAST function (check before complex)
    : T extends `CAST ( ${string}` | `cast ( ${string}` ? "cast"
    // Complex expressions (JSON ops, concatenation, parens, functions, arithmetic)
    // Must be checked BEFORE literals because "1 + 1" starts with number
    : IsComplexExpression<T> extends true ? "complex"
    // SQL constants - check all patterns
    : IsSQLConstantExpression<T> extends true ? "sql_constant"
    // INTERVAL expressions - after complex check
    : T extends `INTERVAL ${string}` | `INTERVAL '${string}` ? "interval"
    // Numeric literals (including negative) - only if NOT complex
    : T extends `${number}${string}` | `-${number}${string}` ? "literal"
    // String literals
    : T extends `'${string}` ? "literal"
    // NULL, TRUE, FALSE
    : T extends `NULL${string}` | `TRUE${string}` | `FALSE${string}` ? "literal"
    // Default to simple column
    : "simple";

/**
 * Optimized column parser using first-character dispatch
 * Reduces type guard cascade from 12+ checks to classification + single dispatch
 */
export type ParseSimpleColumnOptimized<T extends string> =
    ClassifyColumnType<T> extends infer Type
        ? Type extends "wildcard" ? TableWildcard<"*", undefined>
        : Type extends "table_wildcard" ? ParseTableWildcard<T>
        : Type extends "literal" ? ParseLiteralColumn<T>
        : Type extends "sql_constant" ? ParseSQLConstantColumn<T>
        : Type extends "interval" ? ParseIntervalColumn<T>
        : Type extends "exists" ? ParseExistsColumn<T>
        : Type extends "subquery" ? ParseSubqueryColumn<T>
        : Type extends "cast" ? ParseCastColumn<T>
        : Type extends "complex" ? ParseComplexColumn<T>
        : ParseSimpleColumnRef<T>
        : never;

/**
 * Parse a simple column reference with optional alias (no special expressions)
 */
export type ParseSimpleColumnRef<T extends string> =
    T extends `${infer Col} AS ${infer Alias}` ? ColumnRef<
            ParseColumnRefType<StripTypeCast<Trim<Col>>>,
            RemoveQuotes<Alias>
        >
    : ColumnRef<
        ParseColumnRefType<StripTypeCast<T>>,
        ExtractColumnName<StripTypeCast<T>>
    >;
