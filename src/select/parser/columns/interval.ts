/**
 * INTERVAL expression parsing
 */

import type {
    ColumnRef,
    ExtendedColumnRefType,
    IntervalExpr,
} from "../../ast.js";
import type { NextToken } from "../../../common/tokenizer.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";

// ============================================================================
// INTERVAL Expression Parsing
// ============================================================================

/**
 * Check if the expression is a PostgreSQL INTERVAL expression
 * Patterns: INTERVAL 'value', INTERVAL 'value' unit, INTERVAL 'value' unit TO unit
 */
export type IsIntervalExpression<T extends string> = Trim<T> extends
    `INTERVAL '${string}'${string}` ? true
    : Trim<T> extends `INTERVAL '${string}'` ? true
    : false;

/**
 * Parse an INTERVAL column expression
 * Creates an IntervalExpr with the interval value
 */
export type ParseIntervalColumn<T extends string> =
    ExtractIntervalWithAlias<Trim<T>> extends [
        infer IntervalResult extends ExtendedColumnRefType,
        infer Alias extends string,
    ] ? ColumnRef<IntervalResult, Alias>
        : ColumnRef<IntervalExpr<string>, "interval">;

/**
 * Extract INTERVAL expression and optional alias
 * Returns [IntervalExpr, alias]
 */
type ExtractIntervalWithAlias<T extends string> =
    // Pattern: INTERVAL 'value' ... AS alias (with potential units before AS)
    T extends `INTERVAL '${infer Value}' ${infer Rest}`
        ? ExtractIntervalAliasFromRest<Rest> extends infer Alias extends string
            ? [IntervalExpr<Value>, Alias]
        : [IntervalExpr<Value>, "interval"]
        // Pattern: INTERVAL 'value' (no unit, no alias)
        : T extends `INTERVAL '${infer Value}'`
            ? [IntervalExpr<Value>, "interval"]
        : [IntervalExpr<string>, "interval"];

/**
 * Extract alias from remainder after INTERVAL value
 * Handles: "DAY", "DAY AS alias", "DAY TO MONTH", "DAY TO MONTH AS alias", "AS alias"
 */
type ExtractIntervalAliasFromRest<T extends string> =
    // Direct alias: AS alias
    Trim<T> extends `AS ${infer AliasRest}`
        ? NextToken<Trim<AliasRest>> extends
            [infer Alias extends string, infer _Rest extends string]
            ? RemoveQuotes<Alias>
        : "interval"
        // Unit followed by AS alias: UNIT AS alias or UNIT TO UNIT AS alias
        : Trim<T> extends `${string} AS ${infer AliasRest}`
            ? NextToken<Trim<AliasRest>> extends
                [infer Alias extends string, infer _Rest extends string]
                ? RemoveQuotes<Alias>
            : "interval"
        // No alias, just unit(s)
        : "interval";
