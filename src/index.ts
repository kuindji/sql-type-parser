/**
 * @kuindji/sql-type-parser
 * 
 * Type-level SQL SELECT Parser
 *
 * This module provides a type-level parser that transforms SQL SELECT query
 * string literals into their corresponding AST types at compile time.
 *
 * @example
 * ```typescript
 * import type { ParseSQL, QueryResult, ValidateSQL } from '@kuindji/sql-type-parser'
 *
 * // Define your schema with schema support
 * type Schema = {
 *   defaultSchema: "public",
 *   schemas: {
 *     public: {
 *       users: { id: number; name: string; email: string }
 *       orders: { id: number; user_id: number; total: number }
 *     },
 *     audit: {
 *       logs: { id: number; user_id: number; action: string }
 *     }
 *   }
 * }
 *
 * // Get typed query results (uses default schema)
 * type Result = QueryResult<"SELECT id, name FROM users", Schema>
 * // Result: { id: number; name: string }
 *
 * // Query with explicit schema prefix
 * type AuditResult = QueryResult<"SELECT id, action FROM audit.logs", Schema>
 * // Result: { id: number; action: string }
 *
 * // Validate queries at compile time
 * type IsValid = ValidateSQL<"SELECT id FROM users", Schema>
 * // Result: true
 * ```
 * 
 * @packageDocumentation
 */

// Re-export the main parser
export type { ParseSQL } from "./parser.js"

// Re-export AST types for consumers
export type {
  // Query types
  SQLQuery,
  SelectClause,

  // Column types
  ColumnRef,
  ColumnRefType,
  SimpleColumnRefType,
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  ComplexExpr,
  SelectItem,
  SelectColumns,

  // Table types
  TableRef,

  // Expression types
  WhereExpr,
  BinaryExpr,
  LogicalExpr,
  LiteralValue,
  ComparisonOp,
  LogicalOp,

  // Join types
  JoinClause,
  JoinType,

  // Order types
  OrderByItem,
  SortDirection,

  // Aggregate types
  AggregateExpr,
  AggregateFunc,

  // Union types
  UnionClause,
  UnionClauseAny,
  UnionOperatorType,
} from "./ast.js"

// Re-export utility types
export type { ParseError, Flatten, RemoveQuotes } from "./utils.js"

// Re-export tokenizer utilities (useful for extending)
export type { NormalizeSQL, NextToken, ExtractUntil, SplitByComma } from "./tokenizer.js"

// Re-export matcher types
export type { MatchQuery, MatchError, DatabaseSchema, QueryResult, ValidateQuery, ValidateSQL } from "./matcher.js"

// Re-export parameter types
export type {
  // Parameter placeholders
  PositionalParam,
  NamedParam,
  ParamPlaceholder,
  ParamRef,

  // Parameter extraction
  ExtractParams,
  ParamCount,
  MaxParamNumber,

  // Parameter type inference
  ParamTypeMap,
  InferParamTypes,
  ParamTuple,
  TypedParamTuple,

  // Validation
  ValidateParamCount,
  ValidateParamTypes,

  // Utility
  QueryWithParams,
} from "./params.js"

// Re-export database integration types
export type {
  // Core validation type
  ValidQuery,

  // Query result types
  SelectResult,
  SelectResultArray,

  // Handler types
  QueryHandler,

  // Validation utilities
  IsValidSelect,

  // Parameter utilities
  HasParameters,
  ExpectedParamCount,
} from "./db.js"

// Re-export factory functions
export { createSelectFn } from "./db.js"

