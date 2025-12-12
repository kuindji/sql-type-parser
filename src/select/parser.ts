/**
 * Type-level SQL SELECT parser
 *
 * This module re-exports all parser types from the parser/ directory.
 * The parser has been split into smaller modules for better maintainability.
 *
 * @see ./parser/index.ts - Main entry point
 * @see ./parser/columns.ts - Column parsing
 * @see ./parser/from.ts - FROM clause parsing
 * @see ./parser/joins.ts - JOIN clause parsing
 * @see ./parser/clauses.ts - WHERE, GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET
 * @see ./parser/union.ts - UNION/INTERSECT/EXCEPT parsing
 * @see ./parser/cte.ts - CTE (WITH clause) parsing
 */

// Re-export everything from the parser module
export type {
    // Main entry point
    ParseSelectSQL,
    ParseSelectQuery,

    // Column parsing
    ParseColumns,
    ParseColumnList,
    ParseSingleColumn,
    ParseColumnRefType,
    ExtractColumnName,
    IsComplexExpression,
    ScanTokensForColumnRefs,
    IsSimpleIdentifier,
    ExtractUntilClosingParen,
    StripTypeCast,

    // FROM clause
    ParseTableRef,
    ParseFromClause,

    // JOIN clause
    ParseSingleJoin,
    ExtractJoinType,
    ParseJoins,

    // Other clauses
    ParseWhereClause,
    ParseOrderByItem,
    ParseOrderByItems,
    ParseOptionalClauses,
    ParseOptionalClausesWithRest,

    // Union
    ParseUnionOperator,

    // CTE
    ParseCTEList,
    ExtractCTEQuery,
} from "./parser/index.js";
