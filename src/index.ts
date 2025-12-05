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
    AnySQLQuery,
    DetectQueryType,
    IsDeleteQuery,
    IsInsertQuery,
    IsSelectQuery,
    IsUpdateQuery,
    ParseDeleteSQL,
    ParseInsertSQL,
    ParseSelectSQL,
    ParseSQL,
    ParseUpdateSQL,
} from "./router.js";

// ============================================================================
// Common Types (shared across all query types)
// ============================================================================

// Re-export common utility types
export type {
    AggregateExpr,
    AggregateFunc,
    BinaryExpr,
    ColumnReference,
    ColumnRefType,
    ComparisonOp,
    ComplexExpr,
    CountClose,
    CountOpen,
    CTEDefinition,
    // Schema types
    DatabaseSchema,
    Decrement,
    DerivedTableRef,
    DynamicQuery,
    DynamicQueryResult,
    ExtractUntil,
    FindRelationsFrom,
    FindRelationsTo,
    Flatten,
    FromTerminators,
    GetColumnNames,
    GetColumnType,
    GetDefaultSchema,
    GetRelation,
    GetRelationNames,
    GetTableNames,
    HasRelations,
    HasTemplateHoles,
    Increment,
    IsDynamicQuery,
    IsMatchError,
    IsParseError,
    // Dynamic query support
    IsStringLiteral,
    JoinClause,
    JoinType,
    LiteralValue,
    LogicalExpr,
    LogicalExprAny,
    LogicalOp,
    MapSQLTypeToTS,
    MatchError,
    NextToken,
    // Tokenizer
    NormalizeSQL,
    OrderByItem,
    OrderByTerminators,
    ParensBalanced,
    ParsedCondition,
    ParseError,
    // Common AST types
    QueryType,
    Relation,
    Relations,
    RelationType,
    RemoveQuotes,
    SchemaDefinition,
    SimpleColumnRefType,
    SortDirection,
    SplitByComma,
    StartsWith,
    SubquerySelectClause,
    TableColumnRef,
    TableDefinition,
    TableRef,
    TableSource,
    TableWildcard,
    // Utils
    Trim,
    UnboundColumnRef,
    UnparsedExpr,
    ValidatableColumnRef,
    WhereExpr,
    WhereTerminators,
} from "./common/index.js";

// ============================================================================
// SELECT Query Types
// ============================================================================

// Re-export SELECT-specific types
export type {
    // Column types
    ColumnRef,
    ExistsExpr,
    ExtendedColumnRefType,
    IntervalExpr,
    LiteralExpr,
    // Matcher types
    MatchSelectQuery,
    QueryResult,
    // Select types
    SelectClause,
    SelectColumns,
    SelectItem,
    // SQL constants
    SQLConstantExpr,
    SQLConstantName,
    // Query wrapper types
    SQLSelectQuery,
    SubqueryExpr,
    // Union types
    UnionClause,
    UnionClauseAny,
    UnionOperatorType,
    ValidateQuery,
    ValidateSelectOptions,
    // Validator types
    ValidateSelectSQL,
    ValidateSQL,
} from "./select/index.js";

// ============================================================================
// INSERT Query Types
// ============================================================================

// Re-export INSERT-specific types
export type {
    ConflictAction,
    ConflictTarget,
    ConflictUpdateSet,
    GetInsertTableColumns,
    // Main clause
    InsertClause,
    // Column types
    InsertColumnList,
    InsertColumnRef,
    InsertInput,
    InsertResult,
    InsertSelectClause,
    InsertSource,
    // Value types
    InsertValue,
    InsertValueRow,
    InsertValuesClause,
    IsValidInsert,
    // Matcher types
    MatchInsertQuery,
    // ON CONFLICT types
    OnConflictClause,
    // RETURNING clause
    ReturningClause,
    // Query wrapper types
    SQLInsertQuery,
    ValidateInsertOptions,
    ValidateInsertResult,
    // Validator types
    ValidateInsertSQL,
} from "./insert/index.js";

// ============================================================================
// UPDATE Query Types
// ============================================================================

// Re-export UPDATE-specific types
export type {
    GetUpdateTableColumns,
    IsValidUpdate,
    // Matcher types
    MatchUpdateQuery,
    QualifiedColumnRef,
    QualifiedWildcard,
    ReturningItem,
    ReturningQualifier,
    SetAssignment,
    // SET clause types
    SetClause,
    SetValue,
    // Query wrapper types
    SQLUpdateQuery,
    // Main clause
    UpdateClause,
    // FROM clause
    UpdateFromClause,
    UpdateResult,
    // RETURNING clause (PostgreSQL 17+ OLD/NEW support)
    UpdateReturningClause,
    ValidateUpdateOptions,
    ValidateUpdateResult,
    // Validator types
    ValidateUpdateSQL,
} from "./update/index.js";

// ============================================================================
// DELETE Query Types
// ============================================================================

// Re-export DELETE-specific types
export type {
    // Main clause
    DeleteClause,
    DeleteResult,
    // RETURNING clause
    DeleteReturningClause,
    GetDeleteTableColumns,
    IsValidDelete,
    // Matcher types
    MatchDeleteQuery,
    // Query wrapper types
    SQLDeleteQuery,
    // USING clause
    UsingClause,
    ValidateDeleteOptions,
    ValidateDeleteResult,
    // Validator types
    ValidateDeleteSQL,
} from "./delete/index.js";

// ============================================================================
// Runtime API helpers
// ============================================================================

export { createSelectFn } from "./db.js";
export type {
    IsValidSelect,
    SelectResult,
    SelectResultArray,
    ValidQuery,
} from "./db.js";
