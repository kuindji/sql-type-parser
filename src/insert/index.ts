/**
 * INSERT Query Module
 *
 * This module provides type-level parsing, validation, and schema matching
 * for SQL INSERT queries.
 *
 * @example
 * ```typescript
 * import type { ParseInsertSQL, InsertResult, ValidateInsertSQL } from './insert'
 *
 * // Parse INSERT query
 * type AST = ParseInsertSQL<"INSERT INTO users (id, name) VALUES (1, 'John')">
 *
 * // Get result type (for RETURNING clause)
 * type Result = InsertResult<"INSERT INTO users (id) VALUES (1) RETURNING *", Schema>
 *
 * // Validate query
 * type Valid = ValidateInsertSQL<"INSERT INTO users (id) VALUES (1)", Schema>
 * ```
 */

// ============================================================================
// Parser Exports
// ============================================================================

export type { ParseInsertSQL } from "./parser.js"

// ============================================================================
// AST Type Exports
// ============================================================================

export type {
  // Query wrapper
  SQLInsertQuery,
  // Main clause
  InsertClause,
  // Column types
  InsertColumnList,
  InsertColumnRef,
  // Value types
  InsertValue,
  InsertValueRow,
  InsertValuesClause,
  InsertSelectClause,
  InsertSource,
  // RETURNING clause
  ReturningClause,
  // ON CONFLICT types
  OnConflictClause,
  ConflictTarget,
  ConflictAction,
  ConflictUpdateSet,
} from "./ast.js"

// ============================================================================
// Matcher Exports
// ============================================================================

export type {
  MatchInsertQuery,
  InsertResult,
  InsertInput,
  ValidateInsertResult,
} from "./matcher.js"

// ============================================================================
// Validator Exports
// ============================================================================

export type {
  ValidateInsertSQL,
  ValidateInsertOptions,
  IsValidInsert,
  GetInsertTableColumns,
} from "./validator.js"

