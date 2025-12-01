/**
 * Common utilities and types shared across all SQL query type parsers
 * 
 * This module re-exports all common types and utilities that are used
 * by SELECT, INSERT, UPDATE, DELETE parsers and matchers.
 */

// Re-export tokenizer utilities
export type {
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
  UnionOperator,
} from "./tokenizer.js"

// Re-export utility types
export type {
  Trim,
  RemoveQuotes,
  Join,
  ToUpperCase,
  Increment,
  Decrement,
  Flatten,
  ParseError,
  IsParseError,
  MatchError,
  IsMatchError,
  // Dynamic query support
  IsStringLiteral,
  DynamicQuery,
  IsDynamicQuery,
  DynamicQueryResult,
} from "./utils.js"

// Re-export schema types
export type {
  // Core schema types
  DatabaseSchema,
  TableDefinition,
  SchemaDefinition,

  // Relation types
  RelationType,
  ColumnReference,
  Relation,
  Relations,

  // Schema utility types
  GetDefaultSchema,
  GetTableNames,
  GetColumnNames,
  GetColumnType,
  HasRelations,
  GetRelationNames,
  GetRelation,
  FindRelationsFrom,
  FindRelationsTo,
} from "./schema.js"

// Re-export common AST types
export type {
  // Query type discriminator
  QueryType,

  // Column references
  UnboundColumnRef,
  TableColumnRef,
  ValidatableColumnRef,
  TableWildcard,
  SimpleColumnRefType,
  ComplexExpr,
  ColumnRefType,

  // Table references
  TableRef,
  SubquerySelectClause,
  DerivedTableRef,
  CTEDefinition,
  TableSource,

  // Expressions
  ComparisonOp,
  LogicalOp,
  LiteralValue,
  BinaryExpr,
  UnparsedExpr,
  ParsedCondition,
  LogicalExprAny,
  WhereExpr,
  LogicalExpr,

  // Join clauses
  JoinType,
  JoinClause,

  // Order by
  SortDirection,
  OrderByItem,

  // Aggregations
  AggregateFunc,
  AggregateExpr,

  // Type mapping
  MapSQLTypeToTS,
} from "./ast.js"

