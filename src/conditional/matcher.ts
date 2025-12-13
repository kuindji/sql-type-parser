/**
 * Conditional SQL Matcher
 *
 * Integrates conditional SQL processing with the existing schema matcher.
 * Handles optionality for columns in conditional blocks.
 */

import type { DatabaseSchema } from "../common/schema.js";
import type { Flatten, MatchError } from "../common/utils.js";
import type { QueryResult } from "../select/matcher/index.js";
import type {
    AllConditionsFalse,
    AllConditionsTrue,
    ProcessConditionalSQL,
} from "./types.js";

// ============================================================================
// Core Result Type Computation
// ============================================================================

/**
 * Compute the result type for a conditional SQL query.
 *
 * Strategy:
 * 1. Process SQL with all conditions TRUE → get "full" column set
 * 2. Process SQL with all conditions FALSE → get "base" column set
 * 3. Columns in full but not in base → mark as `| undefined`
 * 4. LEFT/FULL JOIN columns get `| null` (from base QueryResult)
 *
 * For conditional LEFT JOINs, columns get both: `T | null | undefined`
 */
export type ConditionalQueryResult<
    Template extends string,
    Conditions extends Record<string, unknown>,
    Schema extends DatabaseSchema,
> =
    // Get the SQL with all conditions true (full column set)
    ProcessConditionalSQL<
        Template,
        AllConditionsTrue<Conditions>
    > extends infer FullSQL extends string
        // Get the SQL with all conditions false (base column set)
        ? ProcessConditionalSQL<
            Template,
            AllConditionsFalse<Conditions>
        > extends infer BaseSQL extends string
            // Match both against schema
            ? QueryResult<FullSQL, Schema> extends infer FullResult
                ? FullResult extends MatchError<string> ? FullResult
                : QueryResult<BaseSQL, Schema> extends infer BaseResult
                    ? BaseResult extends MatchError<string>
                        // Base SQL might be invalid (e.g., no SELECT columns) - use full result
                        ? FullResult
                    : MergeConditionalResults<FullResult, BaseResult>
                : FullResult
            : MatchError<"Failed to match full SQL">
        : MatchError<"Failed to process base SQL">
        : MatchError<"Failed to process full SQL">;

/**
 * Merge full and base results, marking conditional columns as optional.
 *
 * - Columns in both full and base: keep as-is
 * - Columns only in full: add `| undefined`
 */
export type MergeConditionalResults<Full, Base> = Flatten<
    // Columns that exist in base (always present)
    & {
        [K in keyof Full as K extends keyof Base ? K : never]: Full[K];
    }
    // Columns only in full (conditional, add undefined)
    & {
        [K in keyof Full as K extends keyof Base ? never : K]:
            | Full[K]
            | undefined;
    }
>;

// ============================================================================
// Processed SQL Type
// ============================================================================

/**
 * The processed SQL string type based on actual conditions.
 */
export type ProcessedSQL<
    Template extends string,
    Conditions extends Record<string, unknown>,
> = ProcessConditionalSQL<Template, Conditions>;

// ============================================================================
// Validation Type
// ============================================================================

/**
 * Validate a conditional SQL query.
 *
 * Validates the "full" version (all conditions true) to ensure
 * all possible columns and tables are valid.
 */
export type ValidateConditionalSQL<
    Template extends string,
    Conditions extends Record<string, unknown>,
    Schema extends DatabaseSchema,
> = ProcessConditionalSQL<
    Template,
    AllConditionsTrue<Conditions>
> extends infer FullSQL extends string
    ? QueryResult<FullSQL, Schema> extends MatchError<infer Msg> ? Msg
    : true
    : "Failed to process SQL";

// ============================================================================
// Join Optionality Helpers
// ============================================================================

/**
 * Detect if a conditional block contains a LEFT JOIN.
 * Used to mark those columns as `| null | undefined`.
 */
type HasConditionalLeftJoin<Template extends string> = Template extends
    `${string}/*if:${string}*/${infer Content}/*endif*/${infer Rest}`
    ? Content extends `${string}LEFT JOIN${string}` ? true
    : Content extends `${string}left join${string}` ? true
    : HasConditionalLeftJoin<Rest>
    : false;

/**
 * Extract table alias from a JOIN clause.
 */
type ExtractJoinAlias<JoinClause extends string> = JoinClause extends
    `${string}JOIN ${string} ${infer Alias} ON${string}` ? Alias
    : JoinClause extends `${string}JOIN ${infer Table} ON${string}` ? Table
    : never;

