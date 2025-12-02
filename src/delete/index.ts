/**
 * DELETE Query Module
 *
 * This module provides type-level parsing, validation, and schema matching
 * for SQL DELETE queries.
 *
 * @example
 * ```typescript
 * import type { ParseDeleteSQL, DeleteResult, ValidateDeleteSQL } from './delete'
 *
 * // Parse DELETE query
 * type AST = ParseDeleteSQL<"DELETE FROM users WHERE id = 1">
 *
 * // Get result type (for RETURNING clause)
 * type Result = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING *", Schema>
 *
 * // Validate query
 * type Valid = ValidateDeleteSQL<"DELETE FROM users WHERE id = 1", Schema>
 * ```
 */

// ============================================================================
// Parser Exports
// ============================================================================

export type { ParseDeleteSQL } from "./parser.js"

// ============================================================================
// AST Type Exports
// ============================================================================

export type {
  // Query wrapper
  SQLDeleteQuery,
  // Main clause
  DeleteClause,
  // USING clause
  UsingClause,
  // RETURNING clause
  DeleteReturningClause,
} from "./ast.js"

// ============================================================================
// Matcher Exports
// ============================================================================

export type { MatchDeleteQuery, DeleteResult, ValidateDeleteResult } from "./matcher.js"

// ============================================================================
// Validator Exports
// ============================================================================

export type {
  ValidateDeleteSQL,
  ValidateDeleteOptions,
  IsValidDelete,
  GetDeleteTableColumns,
} from "./validator.js"

