/**
 * @kuindji/sql-type-parser
 * 
 * Type-level SQL Parser
 *
 * This module provides a type-level parser that transforms SQL query
 * string literals into their corresponding AST types at compile time.
 * 
 * Architecture:
 * ------------
 * The parser is organized into modules by query type:
 * - common/    - Shared utilities (tokenizer, AST nodes, utils)
 * - select/    - SELECT query parser and matcher
 * - insert/    - INSERT query parser and matcher (planned)
 * - update/    - UPDATE query parser and matcher (planned)
 * - delete/    - DELETE query parser and matcher (planned)
 * 
 * Each query type has its own execution tree in the type system
 * to avoid TypeScript performance issues.
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

// ============================================================================
// Main Parser (Router)
// ============================================================================

// Re-export the main router entry point
export type { 
  ParseSQL,
  DetectQueryType,
  ParseSelectSQL,
  IsSelectQuery,
  IsInsertQuery,
  IsUpdateQuery,
  IsDeleteQuery,
  AnySQLQuery,
  SQLInsertQuery,
  SQLUpdateQuery,
  SQLDeleteQuery,
} from "./router.js"

// ============================================================================
// Common Types (shared across all query types)
// ============================================================================

// Re-export common utility types
export type {
  // Tokenizer
  NormalizeSQL,
  NextToken,
  ExtractUntil,
  SplitByComma,
  FromTerminators,
  WhereTerminators,
  OrderByTerminators,
  StartsWith,

  // Utils
  Trim,
  RemoveQuotes,
  Flatten,
  ParseError,
  IsParseError,
  MatchError,
  IsMatchError,
  Increment,
  Decrement,

  // Schema types
  DatabaseSchema,
  TableDefinition,
  SchemaDefinition,
  RelationType,
  ColumnReference,
  Relation,
  Relations,
  GetDefaultSchema,
  GetTableNames,
  GetColumnNames,
  GetColumnType,
  HasRelations,
  GetRelationNames,
  GetRelation,
  FindRelationsFrom,
  FindRelationsTo,

  // Common AST types
  QueryType,
  UnboundColumnRef,
  TableColumnRef,
  ValidatableColumnRef,
  TableWildcard,
  SimpleColumnRefType,
  ComplexExpr,
  ColumnRefType,
  TableRef,
  SubquerySelectClause,
  DerivedTableRef,
  CTEDefinition,
  TableSource,
  ComparisonOp,
  LogicalOp,
  LiteralValue,
  BinaryExpr,
  UnparsedExpr,
  LogicalExprAny,
  WhereExpr,
  LogicalExpr,
  JoinType,
  JoinClause,
  SortDirection,
  OrderByItem,
  AggregateFunc,
  AggregateExpr,
  MapSQLTypeToTS,
} from "./common/index.js"

// ============================================================================
// SELECT Query Types
// ============================================================================

// Re-export SELECT-specific types
export type {
  // Query wrapper types
  SQLSelectQuery,
  SQLQuery,  // Legacy alias

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

  // Matcher types (lightweight type extraction)
  MatchSelectQuery,
  QueryResult,
  ValidateQuery,

  // Validator types (comprehensive validation)
  ValidateSelectSQL,
  ValidateSQL,  // Legacy alias for ValidateSelectSQL
} from "./select/index.js"

// ============================================================================
// Parameter Types
// ============================================================================

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

// ============================================================================
// Database Integration Types
// ============================================================================

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

// ============================================================================
// Legacy Compatibility Exports
// ============================================================================

// These exports maintain backward compatibility with the old flat structure.
// Users can import from the root or from specific modules.

// Legacy: Re-export MatchQuery as alias for MatchSelectQuery
export type { MatchSelectQuery as MatchQuery } from "./select/index.js"
