/**
 * DELETE query parser, matcher, and validator
 * 
 * This module provides everything needed to parse, match, and validate DELETE queries:
 * 
 * Type Extraction (lightweight):
 * - ParseDeleteSQL - parses a DELETE query string into an AST
 * - MatchDeleteQuery - matches a DELETE AST against a schema
 * - DeleteResult - convenience type that does both in one step
 * 
 * Validation (comprehensive):
 * - ValidateDeleteSQL - validates a DELETE query with all checks
 */

// Re-export parser types
export type { ParseDeleteSQL } from "./parser.js"

// Re-export AST types
export type {
  // Query wrapper types
  SQLDeleteQuery,

  // Delete clause types
  DeleteClause,
  UsingClause,

  // RETURNING clause
  ReturningClause,
} from "./ast.js"

// Re-export matcher types (lightweight type extraction)
export type {
  // Main matcher
  MatchDeleteQuery,

  // Error types
  MatchError,

  // Convenience types
  DeleteResult,
  ValidateDeleteResult,
} from "./matcher.js"

// Re-export schema types from common (for backwards compatibility)
export type { DatabaseSchema } from "../common/schema.js"

// Re-export validator types (comprehensive validation)
export type {
  ValidateDeleteSQL,
  ValidateDeleteOptions,
  IsValidDelete,
  GetDeleteTableColumns,
} from "./validator.js"

