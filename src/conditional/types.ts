/**
 * Conditional SQL Types
 *
 * Type-level processing of SQL templates with conditional blocks.
 * Uses `/* if:condition * /.../* endif * /` syntax (without spaces in actual usage).
 *
 * Conditional blocks affect:
 * - The resulting SQL string (excluded when condition is false)
 * - Result type optionality (columns in conditional blocks get `| undefined`)
 * - LEFT JOIN nullability: columns from LEFT/FULL JOINed tables get `| null`
 *
 * For conditional LEFT JOINs, columns get both: `T | null | undefined`
 */

import type { Flatten } from "../common/utils.js";

// ============================================================================
// Condition Evaluation Types
// ============================================================================

/**
 * Get a nested value type from an object type using dot notation path.
 * @example GetPath<{ user: { isAdmin: true } }, "user.isAdmin"> // true
 */
export type GetPath<T, Path extends string> = Path extends
    `${infer Key}.${infer Rest}`
    ? Key extends keyof T ? GetPath<T[Key], Rest>
    : undefined
    : Path extends keyof T ? T[Path]
    : undefined;

/**
 * Check if a type is considered "truthy" at the type level.
 */
export type IsTruthy<T> =
    // Strictly falsy types
    [T] extends [false | 0 | "" | null | undefined] ? false
        : [T] extends [never] ? false
        // Check if T is exactly `boolean` (not `true` or `false` literal)
        : [T] extends [boolean]
            ? ([boolean] extends [T] ? boolean : true)
        // Check if T is exactly `string` (not a string literal)
        : [T] extends [string] ? ([string] extends [T] ? boolean : true)
        // Check if T is exactly `number` (not a number literal)
        : [T] extends [number] ? ([number] extends [T] ? boolean : true)
        // Otherwise truthy
        : true;

/**
 * Evaluate a condition string against a data type.
 * Supports negation with `!` prefix.
 */
export type EvalCondition<Cond extends string, Data> = Cond extends
    `!${infer Key}`
    ? IsTruthy<GetPath<Data, Key>> extends true ? false
    : IsTruthy<GetPath<Data, Key>> extends false ? true
    : boolean
    : IsTruthy<GetPath<Data, Cond>>;

// ============================================================================
// Conditional Block Processing Types
// ============================================================================

/**
 * Check if a string contains a specific pattern.
 */
type Contains<S extends string, Pattern extends string> = S extends
    `${string}${Pattern}${string}` ? true : false;

/**
 * Check if any condition in the data object has an indeterminate type.
 */
type HasIndeterminateCondition<
    Template extends string,
    Data extends Record<string, unknown>,
> = Template extends `${string}/*if:${infer Cond}*/${infer Rest}`
    ? EvalCondition<Cond, Data> extends boolean
        ? boolean extends EvalCondition<Cond, Data> ? true
        : HasIndeterminateCondition<Rest, Data>
    : HasIndeterminateCondition<Rest, Data>
    : false;

/**
 * Process the innermost conditional block.
 * This handles nested conditions by processing from inside out.
 */
type ProcessInnermost<
    Template extends string,
    Data extends Record<string, unknown>,
> = Template extends
    `${infer Before}/*if:${infer Cond}*/${infer Content}/*endif*/${infer After}`
    ? Contains<Content, "/*if:"> extends true
        // Content has nested /*if: - re-match to find the true innermost
        ? `${Before}/*if:${Cond}*/${ProcessInnermost<
            `${Content}/*endif*/${After}`,
            Data
        >}`
        // This is truly innermost - evaluate and replace
    : EvalCondition<Cond, Data> extends true ? `${Before}${Content}${After}`
    : EvalCondition<Cond, Data> extends false ? `${Before}${After}`
    : string
    : Template;

/**
 * Recursively process all conditional blocks until none remain.
 */
export type ProcessConditionalSQL<
    Template extends string,
    Data extends Record<string, unknown>,
    Depth extends number[] = [],
> =
    // If any condition is indeterminate, fall back to string immediately
    HasIndeterminateCondition<Template, Data> extends true ? string
        // Recursion depth limit
        : Depth["length"] extends 20 ? Template
        // Check if there are any conditions left to process
        : Contains<Template, "/*if:"> extends true ? ProcessConditionalSQL<
                ProcessInnermost<Template, Data>,
                Data,
                [...Depth, 0]
            >
        : Template;

// ============================================================================
// All-True Condition Types (for optionality detection)
// ============================================================================

/**
 * Create a version of Data where all boolean-like values are true.
 * Used to compute the "maximum" result type (all conditional columns included).
 */
export type AllConditionsTrue<Data extends Record<string, unknown>> = {
    [K in keyof Data]: Data[K] extends Record<string, unknown>
        ? AllConditionsTrue<Data[K]>
        : true;
};

/**
 * Create a version of Data where all boolean-like values are false.
 * Used to compute the "minimum" result type (no conditional columns).
 */
export type AllConditionsFalse<Data extends Record<string, unknown>> = {
    [K in keyof Data]: Data[K] extends Record<string, unknown>
        ? AllConditionsFalse<Data[K]>
        : false;
};

// ============================================================================
// Conditional Marker Types
// ============================================================================

/**
 * Marker for columns that come from conditional SELECT clauses.
 * These should be typed as `T | undefined` in the result.
 */
export type ConditionalColumn<T> = T | undefined;

/**
 * Marker for columns from conditional LEFT JOINs.
 * These should be typed as `T | null | undefined` in the result.
 */
export type ConditionalLeftJoinColumn<T> = T | null | undefined;

// ============================================================================
// SQL Fragment Extraction Types
// ============================================================================

/**
 * Extract conditional block markers from SQL for optionality tracking.
 * Returns a structure describing which parts are conditional.
 */
export type ExtractConditionalInfo<Template extends string> =
    Template extends
        `${infer _Before}/*if:${infer Cond}*/${infer Content}/*endif*/${infer After}`
        ? {
            condition: Cond;
            content: Content;
            hasSelect: Contains<Content, "SELECT"> extends true ? true
                : Contains<Content, "select"> extends true ? true
                : Contains<Content, ",">;
            hasJoin: Contains<Content, "JOIN">;
            isLeftJoin: Contains<Content, "LEFT JOIN"> extends true ? true
                : Contains<Content, "left join">;
            rest: ExtractConditionalInfo<After>;
        }
        : null;

// ============================================================================
// Processed SQL Result Type
// ============================================================================

/**
 * The result type after processing conditional SQL.
 * Contains both the processed SQL string and metadata for type inference.
 */
export interface ConditionalSQLResult<
    ProcessedSQL extends string,
    FullSQL extends string,
    ConditionalColumns extends string[] = [],
> {
    /** The processed SQL string after applying conditions */
    readonly sql: ProcessedSQL;
    /** The full SQL (all conditions true) for type inference */
    readonly fullSql: FullSQL;
    /** Column names that are conditional (for | undefined) */
    readonly conditionalColumns: ConditionalColumns;
}

// ============================================================================
// Param Types
// ============================================================================

/**
 * Extract parameter names from a SQL string.
 * Parameters are in the format :paramName
 */
export type ExtractParamNames<
    SQL extends string,
    Acc extends string[] = [],
> = SQL extends `${string}:${infer Name}${infer Rest}`
    ? Name extends `${infer ParamName}${" " | "," | ")" | "\n" | "\t"}`
        ? ExtractParamNames<Rest, [...Acc, ParamName]>
    : ExtractParamNames<Rest, [...Acc, Name]>
    : Acc;

/**
 * Validate that all required params are provided.
 */
export type ValidateParams<
    SQL extends string,
    Params extends Record<string, unknown>,
> = ExtractParamNames<SQL> extends infer Names extends string[]
    ? Names[number] extends keyof Params ? true
    : `Missing parameter: ${Exclude<Names[number], keyof Params>}`
    : true;

