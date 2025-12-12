/**
 * Query result convenience types
 *
 * High-level types for parsing and matching SQL in one step,
 * plus validation utilities for checking query results.
 */

import type { DatabaseSchema } from "../../common/schema.js";
import type {
    DynamicQueryResult,
    IsMatchError,
    IsStringLiteral,
    IsStringUnion,
    UnionQueryError,
} from "../../common/utils.js";

import type { MatchSelectQuery } from "./main.js";

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Parse SQL and match against schema in one step
 *
 * This is the lightweight type extraction path - focused on determining
 * the result type of a query. It reports errors for columns it can't resolve,
 * but does not perform deep validation (JOIN conditions, WHERE clauses, etc.)
 *
 * For dynamic queries (non-literal strings or those containing template interpolations),
 * returns DynamicQueryResult which allows any property access.
 *
 * For union types (e.g., queries containing `"GBP" | "USD"` in template literals),
 * returns UnionQueryError to prevent exponential type computation.
 *
 * For comprehensive validation, use ValidateSQL from ./validator.js
 */
export type QueryResult<
    SQL extends string,
    Schema extends DatabaseSchema,
> = IsStringUnion<SQL> extends true ? UnionQueryError
    : IsStringLiteral<SQL> extends false ? DynamicQueryResult
    : MatchSelectQuery<import("../parser.js").ParseSelectSQL<SQL>, Schema>;

// ============================================================================
// Query Result Error Checking
// ============================================================================

/**
 * Extract error message from a MatchError (if it is one)
 */
type ExtractError<T> = T extends
    { readonly __error: true; readonly message: infer M; } ? M
    : never;

/**
 * Check if a type could potentially be or contain a MatchError
 */
type CouldContainError<T> = T extends { readonly __error: true; } ? true
    : false;

/**
 * Find the first error in a QueryResult object
 * Checks direct properties only - MatchErrors appear at the first level
 */
type FindFirstError<T> = IsMatchError<T> extends true ? ExtractError<T>
    : T extends object
        ? CollectErrors<T> extends infer Errors
            ? [ Errors ] extends [ never ] ? never
            : Errors
        : never
    : never;

/**
 * Collect errors from direct properties of an object
 */
type CollectErrors<T> = {
    [K in keyof T]: IsMatchError<T[K]> extends true ? ExtractError<T[K]>
        : CouldContainError<T[K]> extends true ? FindFirstError<T[K]>
        : never;
}[keyof T];

/**
 * Check if a QueryResult has errors
 * Returns true if no errors, or the error message if there are errors
 *
 * Note: This only checks errors from column resolution.
 * For comprehensive validation, use ValidateSQL from ./validator.js
 */
export type ValidateQuery<Result> = FindFirstError<Result> extends never ? true
    : FindFirstError<Result>;

// ============================================================================
// Legacy Validation (delegates to validator)
// ============================================================================

/**
 * Validate a SQL query against a schema.
 *
 * By default this performs full validation (all clauses). Callers that need a
 * lighter validation path (for example, builder fragment checks) can pass
 * `Options` with `validateAllFields: false` to skip deep WHERE/JOIN/HAVING
 * clause validation while still validating SELECT columns and table/alias
 * resolution.
 *
 * This delegates to the dedicated validator implementation.
 *
 * @see ValidateSelectSQL in ./validator.js for the implementation
 */
export type ValidateSQL<
    SQL extends string,
    Schema extends DatabaseSchema,
    Options = undefined,
> = [ Options ] extends [ undefined ]
    ? import("../validator/index.js").ValidateSelectSQL<SQL, Schema>
    : import("../validator/index.js").ValidateSelectSQL<
        SQL,
        Schema,
        Options & import("../validator/index.js").ValidateSelectOptions
    >;
