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
export type {
    ExtractColumnName,
    ExtractJoinType,
    IsComplexExpression,
    IsSimpleIdentifier,
    ParseColumnList,
    ParseColumnRefType,
    ParseOrderByItem,
    ParseOrderByItems,
    ParseSelectSQL,
    ParseSingleColumn,
    ParseSingleJoin,
    ParseTableRef,
    ParseWhereClause,
    ScanTokensForColumnRefs,
} from "./parser.js";

// Re-export AST types
export type {
    // Column types
    ColumnRef,
    ExistsExpr,
    ExtendedColumnRefType,
    IntervalExpr,
    LiteralExpr,
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
} from "./ast.js";

// Re-export matcher types
export type {
    DatabaseSchema,
    MatchError,
    MatchSelectClause,
    MatchSelectQuery,
    QueryResult,
    ValidateQuery,
    ValidateSQL,
} from "./matcher/index.js";

// Re-export validator types
export type {
    ValidateSelectClause,
    ValidateSelectOptions,
    ValidateSelectSQL,
} from "./validator/index.js";

// Re-export builder types and runtime helpers (experimental)
export type { UntypedSelectBuilder } from "./builder-types/builder.js";

export type {
    BuilderReturnType,
    BuilderSQL,
} from "./builder-types/return-type.js";
export type {
    EmptyState as SelectEmptyState,
    ErrorState as SelectErrorState,
    SelectBuilderAnyState,
    SelectBuilderState,
} from "./builder-types/state.js";
export type { ValidateBuilder } from "./builder-types/validation.js";

export { assembleSelectSQL } from "./builder-runtime/assemble-select-sql.js";
export {
    createSelectQuery,
    createUntypedQuery,
    createUntypedSelectQuery,
} from "./builder.js";
