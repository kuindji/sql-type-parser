/**
 * Validation Types
 *
 * Options and result types for SELECT query validation.
 */

import type { MatchError } from "../../common/utils.js";

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for controlling SELECT query validation depth
 *
 * @property validateAllFields - When true (default), validates field references
 *   in all clauses: SELECT, WHERE, JOIN ON, HAVING, GROUP BY, ORDER BY.
 *   When false, only validates SELECT clause columns.
 *
 * Use false when the query is too complex for TypeScript's type system
 * to handle full validation while still maintaining SELECT clause checking.
 */
export type ValidateSelectOptions = {
    /**
     * Whether to validate fields in all clauses (WHERE, JOIN ON, HAVING, etc.)
     * @default true
     */
    validateAllFields?: boolean;
};

/**
 * Default validation options - full validation enabled
 */
export type DefaultValidateOptions = { validateAllFields: true; };

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation error with context about what failed
 */
export type ValidationError<Message extends string> = MatchError<Message>;
