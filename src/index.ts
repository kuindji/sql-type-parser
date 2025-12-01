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
 * - insert/    - INSERT query parser and matcher
 * - update/    - UPDATE query parser and matcher
 * - delete/    - DELETE query parser and matcher
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
  ParseInsertSQL,
  ParseUpdateSQL,
  ParseDeleteSQL,
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

  // Dynamic query support
  IsStringLiteral,
  DynamicQuery,
  IsDynamicQuery,
  DynamicQueryResult,

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
  ParsedCondition,
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
  ValidateSelectOptions,
  ValidateSQL,
} from "./select/index.js"

// ============================================================================
// INSERT Query Types
// ============================================================================

// Re-export INSERT-specific types
export type {
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

  // Matcher types (lightweight type extraction)
  MatchInsertQuery,
  InsertResult,
  InsertInput,
  ValidateInsertResult,

  // Validator types (comprehensive validation)
  ValidateInsertSQL,
  ValidateInsertOptions,
  IsValidInsert,
  GetInsertTableColumns,
} from "./insert/index.js"

// ============================================================================
// UPDATE Query Types
// ============================================================================

// Re-export UPDATE-specific types
export type {
  // Update clause types
  UpdateClause,
  SetClause,
  SetAssignment,
  SetValue,
  UpdateFromClause,

  // RETURNING clause (PostgreSQL 17+ OLD/NEW support)
  ReturningClause as UpdateReturningClause,
  ReturningQualifier,
  QualifiedColumnRef,
  QualifiedWildcard,
  ReturningItem,

  // Matcher types (lightweight type extraction)
  MatchUpdateQuery,
  UpdateResult,
  ValidateUpdateResult,

  // Validator types (comprehensive validation)
  ValidateUpdateSQL,
  ValidateUpdateOptions,
  IsValidUpdate,
  GetUpdateTableColumns,
} from "./update/index.js"

// ============================================================================
// DELETE Query Types
// ============================================================================

// Re-export DELETE-specific types
export type {
  // Delete clause types
  DeleteClause,
  UsingClause,

  // RETURNING clause (re-exported, same structure as INSERT)
  ReturningClause as DeleteReturningClause,

  // Matcher types (lightweight type extraction)
  MatchDeleteQuery,
  DeleteResult,
  ValidateDeleteResult,

  // Validator types (comprehensive validation)
  ValidateDeleteSQL,
  ValidateDeleteOptions,
  IsValidDelete,
  GetDeleteTableColumns,
} from "./delete/index.js"

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
