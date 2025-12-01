/**
 * UPDATE query parser, matcher, and validator
 * 
 * This module provides everything needed to parse, match, and validate UPDATE queries:
 * 
 * Type Extraction (lightweight):
 * - ParseUpdateSQL - parses an UPDATE query string into an AST
 * - MatchUpdateQuery - matches an UPDATE AST against a schema
 * - UpdateResult - convenience type that does both in one step
 * 
 * Validation (comprehensive):
 * - ValidateUpdateSQL - validates an UPDATE query with all checks
 */

// Re-export parser types
export type { ParseUpdateSQL } from "./parser.js"

// Re-export AST types
export type {
  // Query wrapper types
  SQLUpdateQuery,

  // Update clause types
  UpdateClause,
  SetClause,
  SetAssignment,
  SetValue,
  UpdateFromClause,

  // RETURNING clause (PostgreSQL 17+ OLD/NEW support)
  ReturningClause,
  ReturningQualifier,
  QualifiedColumnRef,
  QualifiedWildcard,
  ReturningItem,
} from "./ast.js"

// Re-export matcher types (lightweight type extraction)
export type {
  // Main matcher
  MatchUpdateQuery,

  // Error types
  MatchError,

  // Convenience types
  UpdateResult,
  ValidateUpdateResult,
} from "./matcher.js"

// Re-export schema types from common (for backwards compatibility)
export type { DatabaseSchema } from "../common/schema.js"

// Re-export validator types (comprehensive validation)
export type {
  ValidateUpdateSQL,
  ValidateUpdateOptions,
  IsValidUpdate,
  GetUpdateTableColumns,
} from "./validator.js"

