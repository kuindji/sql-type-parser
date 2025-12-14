/**
 * Common utilities and types shared across all SQL query type parsers
 *
 * This module re-exports all common types and utilities that are used
 * by SELECT, INSERT, UPDATE, DELETE parsers and matchers.
 */

// Re-export tokenizer utilities
export type {
    CountClose,
    CountOpen,
    ExtractUntil,
    FromTerminators,
    NextToken,
    NormalizeSQL,
    OrderByTerminators,
    ParensBalanced,
    SplitByComma,
    StartsWith,
    UnionOperator,
    WhereTerminators,
} from "./tokenizer.js";

// Re-export utility types
export type {
    Decrement,
    DynamicQuery,
    DynamicQueryResult,
    Flatten,
    HasTemplateHoles,
    Increment,
    IsDynamicQuery,
    IsMatchError,
    IsParseError,
    // Dynamic query support
    IsStringLiteral,
    // Union type detection
    IsStringUnion,
    IsUnion,
    IsUnionQueryError,
    Join,
    MatchError,
    ParseError,
    RemoveQuotes,
    ToUpperCase,
    Trim,
    UnionQueryError,
} from "./utils.js";

// Re-export common builder utilities
export {
    appendParamsRuntime,
    buildParamString,
    ConditionTreeBuilder,
    createConditionTree,
    whenRuntime,
} from "./builder.js";

export type { ParamString, QueryParamInput, QueryParamValue } from "./builder.js";

// Re-export schema types
export type {
    ColumnReference,
    // Core schema types
    DatabaseSchema,
    FindRelationsFrom,
    FindRelationsTo,
    GetColumnNames,
    GetColumnType,
    // Schema utility types
    GetDefaultSchema,
    GetRelation,
    GetRelationNames,
    GetTableNames,
    HasRelations,
    Relation,
    Relations,
    // Relation types
    RelationType,
    SchemaDefinition,
    TableDefinition,
} from "./schema.js";

// Re-export common AST types
export type {
    AggregateExpr,
    // Aggregations
    AggregateFunc,
    BinaryExpr,
    ColumnRefType,
    // Expressions
    ComparisonOp,
    ComplexExpr,
    CTEDefinition,
    DerivedTableRef,
    JoinClause,
    // Join clauses
    JoinType,
    LiteralValue,
    LogicalExpr,
    LogicalExprAny,
    LogicalOp,
    // Type mapping
    MapSQLTypeToTS,
    OrderByItem,
    ParsedCondition,
    // Query type discriminator
    QueryType,
    SimpleColumnRefType,
    // Order by
    SortDirection,
    SubquerySelectClause,
    TableColumnRef,
    // Table references
    TableRef,
    TableSource,
    TableWildcard,
    // Column references
    UnboundColumnRef,
    UnparsedExpr,
    ValidatableColumnRef,
    WhereExpr,
} from "./ast.js";
