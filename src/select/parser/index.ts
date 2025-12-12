/**
 * Type-level SQL SELECT parser - Main Entry Point
 *
 * This module provides the main entry point for parsing SELECT queries.
 * It handles all recursive parsing (subqueries, CTEs, derived tables)
 * and delegates non-recursive helpers to sub-modules.
 */

import type {
    ColumnRef,
    ExistsExpr,
    ExtendedColumnRefType,
    SelectClause,
    SelectItem,
    SQLSelectQuery,
    SubqueryExpr,
    UnionClause,
    UnionClauseAny,
    UnionOperatorType,
} from "../ast.js";

import type {
    ColumnRefType,
    ComplexExpr,
    CTEDefinition,
    DerivedTableRef,
    JoinClause,
    OrderByItem,
    TableSource,
    ValidatableColumnRef,
    WhereExpr,
} from "../../common/ast.js";

import type {
    ExtractUntil,
    FromTerminators,
    NextToken,
    NormalizeSQL,
} from "../../common/tokenizer.js";

import type {
    ParseError,
    RemoveQuotes,
    Trim,
} from "../../common/utils.js";

// Import from sub-modules
import type {
    ParseColumns as ParseColumnsBase,
    ExtractUntilClosingParen,
    ExtractParenthesizedContent,
    ExtractSubqueryCastType,
    ExtractAliasFromRemainder,
    ScanTokensForColumnRefs,
} from "./columns/index.js";
import type {
    ParseTableRef,
    ParseDerivedTableAlias,
} from "./from.js";
import type { ParseOptionalClausesWithRest } from "./clauses.js";
import type { ParseUnionOperator } from "./union.js";

// ============================================================================
// Re-exports for public API
// ============================================================================

// Column parsing exports
export type {
    ParseColumnList,
    ParseSingleColumn,
    ParseColumnRefType,
    ExtractColumnName,
    IsComplexExpression,
    ScanTokensForColumnRefs,
    IsSimpleIdentifier,
    ExtractUntilClosingParen,
    StripTypeCast,
} from "./columns/index.js";

// Override ParseColumns to handle subqueries properly
export type ParseColumns<T extends string> = ParseColumnsBase<T>;

// FROM clause exports
export type { ParseTableRef } from "./from.js";

// JOIN clause exports
export type { ParseSingleJoin, ExtractJoinType, ParseJoins } from "./joins.js";

// Other clause exports
export type {
    ParseWhereClause,
    ParseOrderByItem,
    ParseOrderByItems,
    ParseOptionalClauses,
    ParseOptionalClausesWithRest,
} from "./clauses.js";

// Union exports
export type { ParseUnionOperator } from "./union.js";

// CTE exports
export type { ExtractCTEQuery } from "./cte.js";

// Export our own ParseCTEList that uses the real parser
export type { ParseCTEList };

// Export ParseFromClause that handles derived tables properly
export type { ParseFromClause };

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse a SQL SELECT query string into an AST
 */
export type ParseSelectSQL<T extends string> = ParseQueryOrUnion<
    NormalizeSQL<T>
>;

/**
 * Parse a query that may contain UNION/INTERSECT/EXCEPT operators
 */
type ParseQueryOrUnion<T extends string> = ParseSelectQueryWithRest<T> extends
    infer Result ? Result extends {
        query: infer Q extends SelectClause;
        rest: infer Rest extends string;
    } ? CheckForUnion<Q, Rest>
    : Result extends SQLSelectQuery<infer Q> ? Result
    : Result
    : never;

/**
 * Parse a normalized SELECT query and return both the query and remaining string
 */
type ParseSelectQueryWithRest<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
] ? First extends "WITH" ? ParseWithAndSelectWithRest<Rest>
    : First extends "SELECT" ? ParseSelectBodyWithCTEsAndRest<Rest, undefined>
    : ParseError<`Expected SELECT or WITH, got: ${First}`>
    : ParseError<"Empty query">;

/**
 * Legacy entry point for backward compatibility with subquery parsing
 */
export type ParseSelectQuery<T extends string> = ParseSelectQueryWithRest<T> extends
    infer Result ? Result extends {
        query: infer Q extends SelectClause;
        rest: infer Rest extends string;
    } ? CheckForUnion<Q, Rest>
    : Result
    : never;

// ============================================================================
// CTE (WITH Clause) Parser - Full Implementation
// ============================================================================

/**
 * Parse WITH clause followed by SELECT, returning both query and rest
 */
type ParseWithAndSelectWithRest<T extends string> = ParseCTEList<T> extends
    infer CTEResult ? CTEResult extends {
        ctes: infer CTEs extends CTEDefinition[];
        rest: infer AfterCTEs extends string;
    }
        ? NextToken<AfterCTEs> extends
            ["SELECT", infer SelectRest extends string]
            ? ParseSelectBodyWithCTEsAndRest<SelectRest, CTEs>
        : ParseError<"Expected SELECT after WITH clause">
    : CTEResult
    : never;

/**
 * Parse a comma-separated list of CTEs
 */
type ParseCTEList<
    T extends string,
    Acc extends CTEDefinition[] = [],
> = ParseSingleCTE<T> extends infer CTEResult ? CTEResult extends {
        cte: infer CTE extends CTEDefinition;
        rest: infer Rest extends string;
    }
        ? NextToken<Rest> extends [",", infer AfterComma extends string]
            ? ParseCTEList<AfterComma, [...Acc, CTE]>
        : { ctes: [...Acc, CTE]; rest: Rest; }
    : CTEResult extends ParseError<string> ? CTEResult
    : ParseError<"Invalid CTE syntax">
    : never;

/**
 * Parse a single CTE: name AS ( SELECT ... )
 */
type ParseSingleCTE<T extends string> = NextToken<T> extends [
    infer Name extends string,
    infer AfterName extends string,
]
    ? NextToken<AfterName> extends ["AS", infer AfterAS extends string]
        ? NextToken<AfterAS> extends ["(", infer AfterParen extends string]
            ? ExtractCTEQueryContent<AfterParen> extends
                [infer QueryStr extends string, infer Rest extends string]
                ? ParseSelectQuery<QueryStr> extends
                    SQLSelectQuery<infer Query extends SelectClause> ? {
                        cte: CTEDefinition<RemoveQuotes<Name>, Query>;
                        rest: Rest;
                    }
                : ParseError<"Failed to parse CTE query">
            : ParseError<"Invalid CTE query syntax">
        : ParseError<"Expected ( after AS in CTE">
    : ParseError<"Expected AS after CTE name">
    : ParseError<"Expected CTE name">;

/**
 * Extract the CTE query from parentheses and return rest
 */
type ExtractCTEQueryContent<T extends string> =
    ExtractUntilClosingParen<T, 1, ""> extends [
        infer Query extends string,
        infer Rest extends string,
    ] ? [Trim<Query>, Trim<Rest>]
        : never;

// ============================================================================
// Union Parser
// ============================================================================

/**
 * Check if there's a union operator and parse accordingly
 */
type CheckForUnion<
    Left extends SelectClause,
    Rest extends string,
> = Trim<Rest> extends "" ? SQLSelectQuery<Left>
    : ParseUnionOperator<Rest> extends
        [infer Op extends UnionOperatorType, infer AfterOp extends string]
        ? ParseSelectQueryWithRest<AfterOp> extends infer RightResult
            ? RightResult extends {
                query: infer RightQ extends SelectClause;
                rest: infer AfterRight extends string;
            } ? CheckForMoreUnions<Left, Op, RightQ, AfterRight>
            : RightResult extends SQLSelectQuery<infer RightQ>
                ? RightQ extends SelectClause
                    ? SQLSelectQuery<UnionClause<Left, Op, RightQ>>
                : RightQ extends UnionClauseAny
                    ? SQLSelectQuery<UnionClause<Left, Op, RightQ>>
                : ParseError<"Invalid right side of union">
            : RightResult
        : never
    : SQLSelectQuery<Left>;

/**
 * Handle more unions on the right side
 */
type CheckForMoreUnions<
    Left extends SelectClause,
    Op extends UnionOperatorType,
    Right extends SelectClause,
    Rest extends string,
> = Trim<Rest> extends "" ? SQLSelectQuery<UnionClause<Left, Op, Right>>
    : ParseUnionOperator<Rest> extends [
        infer NextOp extends UnionOperatorType,
        infer AfterNextOp extends string,
    ]
        ? ParseSelectQueryWithRest<AfterNextOp> extends infer NextRightResult
            ? NextRightResult extends {
                query: infer NextRightQ extends SelectClause;
                rest: infer AfterNextRight extends string;
            }
                ? CheckForMoreUnions<Left, Op, Right, Rest> extends
                    SQLSelectQuery<infer LeftUnion>
                    ? LeftUnion extends UnionClauseAny ? CheckForMoreUnions<
                            Right,
                            NextOp,
                            NextRightQ,
                            AfterNextRight
                        > extends SQLSelectQuery<infer RightUnion>
                            ? SQLSelectQuery<UnionClause<Left, Op, RightUnion>>
                        : ParseError<"Failed to parse chained union">
                    : ParseError<"Invalid union chain">
                : ParseError<"Failed to parse union chain">
            : NextRightResult
        : never
    : SQLSelectQuery<UnionClause<Left, Op, Right>>;

// ============================================================================
// FROM Clause Parser - Full Implementation with Derived Tables
// ============================================================================

/**
 * Parse FROM clause and return table + remaining query
 * Handles both regular tables and derived tables (subqueries)
 */
type ParseFromClause<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
]
    ? First extends "FROM"
        ? NextToken<Rest> extends ["(", infer AfterParen extends string]
            ? ParseDerivedTable<AfterParen>
        : ExtractUntil<Rest, FromTerminators> extends [
            infer TablePart extends string,
            infer Remaining extends string,
        ] ? { from: ParseTableRef<TablePart>; rest: Remaining; }
        : { from: ParseTableRef<Rest>; rest: ""; }
    : ParseError<`Expected FROM, got: ${First}`>
    : ParseError<"Missing FROM clause">;

/**
 * Parse a derived table (subquery in FROM clause)
 * Pattern: ( SELECT ... ) AS alias
 */
type ParseDerivedTable<T extends string> =
    ExtractUntilClosingParen<T, 1, ""> extends
        [infer QueryStr extends string, infer AfterParen extends string]
        ? ParseSelectQuery<Trim<QueryStr>> extends
            SQLSelectQuery<infer Query extends SelectClause>
            ? ParseDerivedTableAlias<Trim<AfterParen>> extends {
                alias: infer Alias extends string;
                rest: infer Rest extends string;
            } ? { from: DerivedTableRef<Query, Alias>; rest: Rest; }
            : ParseError<"Derived table requires an alias">
        : ParseError<"Failed to parse derived table query">
        : ParseError<"Invalid derived table syntax">;

// ============================================================================
// SELECT Body Parser
// ============================================================================

/**
 * Parse the body of a SELECT statement (legacy - no CTEs)
 */
type ParseSelectBody<T extends string> = ParseSelectBodyWithCTEs<T, undefined>;

/**
 * Parse the body of a SELECT statement with optional CTEs
 */
type ParseSelectBodyWithCTEs<
    T extends string,
    CTEs extends CTEDefinition[] | undefined,
> = ParseSelectBodyWithCTEsAndRest<T, CTEs> extends infer Result
    ? Result extends { query: infer Q extends SelectClause; rest: string; }
        ? SQLSelectQuery<Q>
    : Result
    : never;

/**
 * Parse the body of a SELECT statement with optional CTEs, returning both query and rest
 */
type ParseSelectBodyWithCTEsAndRest<
    T extends string,
    CTEs extends CTEDefinition[] | undefined,
> = CheckDistinct<T> extends [
    infer IsDistinct extends boolean,
    infer AfterDistinct extends string,
] ? ExtractUntil<AfterDistinct, "FROM"> extends [
        infer ColumnsPart extends string,
        infer FromPart extends string,
    ]
        ? ParseColumnsWithSubqueries<ColumnsPart> extends infer Columns
            ? Columns extends ParseError<string> ? Columns
            : ParseFromClause<FromPart> extends infer FromResult
                ? FromResult extends ParseError<string> ? FromResult
                : FromResult extends {
                    from: infer From extends TableSource;
                    rest: infer Rest extends string;
                } ? BuildSelectClauseWithCTEsAndRest<
                        Columns,
                        From,
                        Rest,
                        IsDistinct,
                        CTEs
                    >
                : ParseError<"Failed to parse FROM clause">
            : never
        : never
    : ParseError<"Missing FROM clause">
    : never;

/**
 * Parse columns with proper subquery handling
 * Uses the basic column parser but adds subquery/EXISTS support
 */
type ParseColumnsWithSubqueries<T extends string> = ParseColumnsBase<T>;

/**
 * Check for DISTINCT keyword
 */
type CheckDistinct<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
] ? First extends "DISTINCT" ? [true, Rest]
    : [false, T]
    : [false, T];

// ============================================================================
// Build Select Clause with Optional Parts
// ============================================================================

/**
 * Build the complete SELECT clause with optional CTEs, returning both query and rest
 */
type BuildSelectClauseWithCTEsAndRest<
    Columns,
    From extends TableSource,
    Rest extends string,
    Distinct extends boolean,
    CTEs extends CTEDefinition[] | undefined,
> = ParseOptionalClausesWithRest<Rest> extends infer OptionalResult
    ? OptionalResult extends ParseError<string> ? OptionalResult
    : OptionalResult extends {
        joins: infer Joins;
        where: infer Where;
        groupBy: infer GroupBy;
        having: infer Having;
        orderBy: infer OrderBy;
        limit: infer Limit;
        offset: infer Offset;
        rest: infer Remaining extends string;
    } ? {
            query: SelectClause<
                Columns extends "*" ? "*"
                    : Columns extends SelectItem[] ? Columns
                    : never,
                From,
                Joins extends JoinClause[] ? Joins : undefined,
                Where extends WhereExpr ? Where : undefined,
                GroupBy extends ColumnRefType[] ? GroupBy : undefined,
                Having extends WhereExpr ? Having : undefined,
                OrderBy extends OrderByItem[] ? OrderBy : undefined,
                Limit extends number ? Limit : undefined,
                Offset extends number ? Offset : undefined,
                Distinct,
                CTEs
            >;
            rest: Remaining;
        }
    : never
    : never;
