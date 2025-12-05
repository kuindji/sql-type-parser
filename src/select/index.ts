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
    ParseSelectSQL,
    ParseSingleColumn,
    ParseSingleJoin,
    ParseTableRef,
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
    MatchSelectQuery,
    QueryResult,
    ValidateQuery,
    ValidateSQL,
} from "./matcher.js";

// Re-export validator types
export type { ValidateSelectOptions, ValidateSelectSQL } from "./validator.js";
