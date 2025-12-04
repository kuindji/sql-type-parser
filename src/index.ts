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
 * - select/    - SELECT query parser
 * 
 * Each query type has its own execution tree in the type system
 * to avoid TypeScript performance issues.
 *
 * @example
 * ```typescript
 * import type { ParseSQL, SQLSelectQuery } from '@kuindji/sql-type-parser'
 *
 * // Parse SQL to AST
 * type AST = ParseSQL<"SELECT id, name FROM users">
 * // Returns SQLSelectQuery<SelectClause<...>>
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
  CountOpen,
  CountClose,
  ParensBalanced,

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
  HasTemplateHoles,
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
  LiteralExpr,
  SubqueryExpr,
  ExistsExpr,
  IntervalExpr,
  ExtendedColumnRefType,

  // SQL constants
  SQLConstantExpr,
  SQLConstantName,

  // Select types
  SelectClause,
  SelectItem,
  SelectColumns,

  // Union types
  UnionClause,
  UnionClauseAny,
  UnionOperatorType,

  // Matcher types
  MatchSelectQuery,
  QueryResult,
  ValidateQuery,
  ValidateSQL,

  // Validator types
  ValidateSelectSQL,
  ValidateSelectOptions,
} from "./select/index.js"

// ============================================================================
// INSERT Query Types
// ============================================================================

// Re-export INSERT-specific types
export type {
  // Query wrapper types
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

  // Matcher types
  MatchInsertQuery,
  InsertResult,
  InsertInput,
  ValidateInsertResult,

  // Validator types
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
  // Query wrapper types
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

  // Matcher types
  MatchUpdateQuery,
  UpdateResult,
  ValidateUpdateResult,

  // Validator types
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
  // Query wrapper types
  SQLDeleteQuery,

  // Main clause
  DeleteClause,

  // USING clause
  UsingClause,

  // RETURNING clause
  DeleteReturningClause,

  // Matcher types
  MatchDeleteQuery,
  DeleteResult,
  ValidateDeleteResult,

  // Validator types
  ValidateDeleteSQL,
  ValidateDeleteOptions,
  IsValidDelete,
  GetDeleteTableColumns,
} from "./delete/index.js"

// ============================================================================
// Runtime API helpers
// ============================================================================

export { createSelectFn } from "./db.js"
export type {
  ValidQuery,
  SelectResult,
  SelectResultArray,
  IsValidSelect
} from "./db.js"