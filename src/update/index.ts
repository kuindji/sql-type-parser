/**
 * UPDATE Query Module
 *
 * This module provides type-level parsing, validation, and schema matching
 * for SQL UPDATE queries.
 *
 * @example
 * ```typescript
 * import type { ParseUpdateSQL, UpdateResult, ValidateUpdateSQL } from './update'
 *
 * // Parse UPDATE query
 * type AST = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1">
 *
 * // Get result type (for RETURNING clause)
 * type Result = UpdateResult<"UPDATE users SET name = 'John' RETURNING *", Schema>
 *
 * // Validate query
 * type Valid = ValidateUpdateSQL<"UPDATE users SET name = 'John'", Schema>
 * ```
 */

// ============================================================================
// Parser Exports
// ============================================================================

export type { ParseUpdateSQL } from "./parser.js"

// ============================================================================
// AST Type Exports
// ============================================================================

export type {
  // Query wrapper
  SQLUpdateQuery,
  // Main clause
  UpdateClause,
  // SET clause types
  SetClause,
  SetAssignment,
  SetValue,
  // FROM clause
  UpdateFromClause,
  // RETURNING clause (PostgreSQL 17+ OLD/NEW support)
  UpdateReturningClause,
  ReturningItem,
  QualifiedColumnRef,
  QualifiedWildcard,
  ReturningQualifier,
} from "./ast.js"

// ============================================================================
// Matcher Exports
// ============================================================================

export type { MatchUpdateQuery, UpdateResult, ValidateUpdateResult } from "./matcher.js"

// ============================================================================
// Validator Exports
// ============================================================================

export type {
  ValidateUpdateSQL,
  ValidateUpdateOptions,
  IsValidUpdate,
  GetUpdateTableColumns,
} from "./validator.js"

