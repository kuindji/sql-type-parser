/**
 * INSERT query parser, matcher, and validator
 * 
 * This module provides everything needed to parse, match, and validate INSERT queries:
 * 
 * Type Extraction (lightweight):
 * - ParseInsertSQL - parses an INSERT query string into an AST
 * - MatchInsertQuery - matches an INSERT AST against a schema
 * - InsertResult - convenience type that does both in one step
 * 
 * Validation (comprehensive):
 * - ValidateInsertSQL - validates an INSERT query with all checks
 * 
 * The separation between InsertResult and ValidateInsertSQL allows for:
 * - Fast type extraction without unnecessary deep validation
 * - Comprehensive validation for table/column existence checks
 */

// Re-export parser types
export type { ParseInsertSQL } from "./parser.js"

// Re-export AST types
export type {
  // Query wrapper types
  SQLInsertQuery,

  // Insert clause types
  InsertClause,
  InsertColumnList,
  InsertColumnRef,

  // Value types
  InsertValuesClause,
  InsertSelectClause,
  InsertValueRow,
  InsertValue,
  InsertSource,

  // RETURNING clause
  ReturningClause,

  // ON CONFLICT clause
  OnConflictClause,
  ConflictTarget,
  ConflictAction,
  ConflictUpdateSet,
} from "./ast.js"

// Re-export matcher types (lightweight type extraction)
export type {
  // Main matcher
  MatchInsertQuery,

  // Error types
  MatchError,

  // Convenience types
  InsertResult,
  InsertInput,
  ValidateInsertResult,
} from "./matcher.js"

// Re-export schema types from common (for backwards compatibility)
export type { DatabaseSchema } from "../common/schema.js"

// Re-export validator types (comprehensive validation)
export type {
  ValidateInsertSQL,
  ValidateInsertOptions,
  IsValidInsert,
  GetInsertTableColumns,
} from "./validator.js"

