/**
 * SELECT query parser, matcher, and validator
 * 
 * This module provides everything needed to parse, match, and validate SELECT queries:
 * 
 * Type Extraction (lightweight):
 * - ParseSelectSQL - parses a SELECT query string into an AST
 * - MatchSelectQuery - matches a SELECT AST against a schema
 * - QueryResult - convenience type that does both in one step
 * 
 * Validation (comprehensive):
 * - ValidateSelectSQL - validates a SELECT query with all checks
 * - ValidateSQL - alias for ValidateSelectSQL (for backwards compatibility)
 * 
 * The separation between QueryResult and ValidateSelectSQL allows for:
 * - Fast type extraction without unnecessary deep validation
 * - Comprehensive validation that can include JOIN/WHERE field checks
 */

// Re-export parser types
export type { ParseSelectSQL } from "./parser.js"

// Re-export AST types
export type {
  // Query wrapper types
  SQLSelectQuery,

  // Column types
  ColumnRef,
  SubqueryExpr,
  ExtendedColumnRefType,

  // Select types
  SelectClause,
  SelectItem,
  SelectColumns,

  // Union types
  UnionClause,
  UnionClauseAny,
  UnionOperatorType,
} from "./ast.js"

// Re-export matcher types (lightweight type extraction)
export type {
  // Main matcher
  MatchSelectQuery,

  // Error types
  MatchError,

  // Convenience types
  QueryResult,
  ValidateQuery,

  // Legacy validation (delegates to validator)
  ValidateSQL,
} from "./matcher.js"

// Re-export schema types from common (for backwards compatibility)
export type { DatabaseSchema } from "../common/schema.js"

// Re-export validator types (comprehensive validation)
export type {
  ValidateSelectSQL,
  ValidateSelectOptions,
} from "./validator.js"

