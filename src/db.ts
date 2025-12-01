/**
 * Database Integration Utilities
 *
 * Provides factory functions to create type-safe query wrappers.
 * Users write their query ONCE and get full type inference.
 *
 * @example
 * ```typescript
 * import { createSelectFn } from '@kuindji/sql-type-parser'
 *
 * const select = createSelectFn<MySchema>((sql, params) =>
 *   pool.query(sql, params).then(r => r.rows)
 * )
 *
 * // Query written once, result fully typed
 * const users = await select("SELECT id, name FROM users WHERE id = $1", [1])
 * // users: Array<{ id: number; name: string }>
 *
 * // Invalid queries show compile error
 * const bad = await select("SELECT bad FROM users") // Error!
 * ```
 */

import type { DatabaseSchema, QueryResult } from "./select/matcher.js"
import type { ValidateSelectSQL } from "./select/validator.js"
import type { MaxParamNumber } from "./params.js"


// ============================================================================
// Core Types
// ============================================================================

/**
 * Validates a query at compile time.
 * If valid, returns the query string type.
 * If invalid, returns an error message type that will be shown in IDE tooltips.
 * 
 * Uses the comprehensive validator (ValidateSelectSQL) which performs
 * all validation checks. This is separate from QueryResult which only
 * extracts the result type.
 */
export type ValidQuery<
    Q extends string,
    Schema extends DatabaseSchema,
> = ValidateSelectSQL<Q, Schema> extends infer V
    ? V extends true
      ? Q
      : `[SQL Error] ${V & string}`
    : never

/**
 * Result type for a SELECT query (flattened for better IDE display)
 */
export type SelectResult<
    SQL extends string,
    Schema extends DatabaseSchema,
> = Prettify<QueryResult<SQL, Schema>>

/**
 * Array of result rows (flattened for better IDE display)
 */
export type SelectResultArray<
    SQL extends string,
    Schema extends DatabaseSchema,
> = Prettify<QueryResult<SQL, Schema>>[]

/**
 * Force TypeScript to expand a type for better IDE display
 * This makes hover tooltips show the actual shape instead of type aliases
 */
type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}


// ============================================================================
// Query Handler Types
// ============================================================================

/**
 * A function that executes SQL and returns rows
 * This is what users provide - their actual database call
 */
export type QueryHandler = (query: string, params?: unknown[]) => unknown;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a type-safe select function for your schema.
 * This is a primitive example for you to use as a starting point.
 *
 * The returned function:
 * - Validates the query at compile time (invalid queries won't compile)
 * - Infers the result type from the query
 *
 * @example
 * ```typescript
 * import { createSelectFn } from '@kuindji/sql-type-parser'
 *
 * type Schema = {
 *   defaultSchema: "public",
 *   schemas: {
 *     public: {
 *       users: { id: number; name: string; email: string }
 *     }
 *   }
 * }
 *
 * // Create the typed select function
 * const select = createSelectFn<Schema>((sql, params) =>
 *   db.query(sql, params)  // Your actual database call
 * )
 *
 * // Use it 
 * const users = await select("SELECT id, name FROM users WHERE active = $1", [true])
 * // users: Array<{ id: number; name: string }>
 *
 * // Invalid queries cause compile errors
 * const bad = await select("SELECT unknown FROM users")
 * // Error: Argument of type '"SELECT unknown FROM users"' is not assignable...
 * ```
 */
export function createSelectFn<Schema extends DatabaseSchema>(handler: QueryHandler) {
    return function select<Q extends string>(
        query: ValidQuery<Q, Schema>,
        params?: unknown[]
    ) {
        type Result = Prettify<QueryResult<Q, Schema>>;
        return handler(query, params) as Promise<Result[]>;
    }
}



// ============================================================================
// Utility Types
// ============================================================================

/**
 * Check if a query is valid
 * Uses the comprehensive validator (ValidateSelectSQL)
 */
export type IsValidSelect<
    SQL extends string,
    Schema extends DatabaseSchema,
> = ValidateSelectSQL<SQL, Schema> extends true ? true : false

/**
 * Check if a query has parameters
 */
export type HasParameters<SQL extends string> = MaxParamNumber<SQL> extends 0
    ? false
    : true

/**
 * Get the expected number of parameters
 */
export type ExpectedParamCount<SQL extends string> = MaxParamNumber<SQL>
