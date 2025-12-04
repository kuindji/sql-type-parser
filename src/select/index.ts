/**
 * SELECT query parser
 * 
 * This module provides everything needed to parse SELECT queries:
 * 
 * - ParseSelectSQL - parses a SELECT query string into an AST
 * - MatchSelectQuery - matches parsed AST against a schema
 * - QueryResult - convenience type for parsing and matching in one step
 * - ValidateSQL - validates a query against a schema
 * - ValidateSelectSQL - comprehensive validation with options
 */

// Re-export parser types
export type { ParseSelectSQL } from "./parser.js"

// Re-export AST types
export type {
  // Query wrapper types
  SQLSelectQuery,

  // Column types
  ColumnRef,
  LiteralExpr,
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

// Re-export matcher types
export type {
  MatchSelectQuery,
  MatchError,
  QueryResult,
  ValidateQuery,
  ValidateSQL,
  DatabaseSchema,
} from "./matcher.js"

// Re-export validator types
export type {
  ValidateSelectSQL,
  ValidateSelectOptions,
} from "./validator.js"

