/**
 * SQL Assembly Types
 *
 * Type-level utilities for assembling SQL strings from BuilderSqlTag.
 */

import type { JoinClauseString, SelectClauseString } from "./clause-list.js";
import type { AnyBuilderSqlTag, BuilderSqlTag } from "./state-tags.js";

// ============================================================================
// Clause Append Helpers
// ============================================================================

/**
 * Append a clause to SQL if the value is a string, otherwise return unchanged.
 * This helper reduces nested conditionals in AssembleBuilderSql.
 */
export type AppendClause<
    Base extends string,
    Keyword extends string,
    Value,
> = [Value] extends [string] ? `${Base} ${Keyword} ${Value}` : Base;

/**
 * Append a clause to SQL without a keyword (for JOINs which include their own keywords).
 */
export type AppendClauseNoKeyword<
    Base extends string,
    Value,
> = [Value] extends [string] ? `${Base} ${Value}` : Base;

/**
 * Append LIMIT clause (uses number type).
 */
export type AppendLimitClause<
    Base extends string,
    Value,
> = [Value] extends [number] ? `${Base} LIMIT ${Value}` : Base;

/**
 * Append OFFSET clause (uses number type).
 */
export type AppendOffsetClause<
    Base extends string,
    Value,
> = [Value] extends [number] ? `${Base} OFFSET ${Value}` : Base;

// ============================================================================
// Main SQL Assembly
// ============================================================================

/**
 * Assemble a SQL string from a BuilderSqlTag. This mirrors the core ordering
 * of `assembleSelectSQL` for SELECT/FROM/JOIN/WHERE/GROUP BY/HAVING/ORDER BY
 * and LIMIT.
 *
 * Optimized to use helper types instead of 8+ levels of nested conditionals.
 */
export type AssembleBuilderSql<
    P extends AnyBuilderSqlTag,
> = AppendOffsetClause<
    AppendLimitClause<
        AppendClause<
            AppendClause<
                AppendClause<
                    AppendClause<
                        AppendClauseNoKeyword<
                            AppendClause<
                                [SelectClauseString<P>] extends [string]
                                    ? `SELECT ${SelectClauseString<P>}`
                                    : "SELECT *",
                                "FROM",
                                P["from"]
                            >,
                            JoinClauseString<P>
                        >,
                        "WHERE",
                        P["where"]
                    >,
                    "GROUP BY",
                    P["groupBy"]
                >,
                "HAVING",
                P["having"]
            >,
            "ORDER BY",
            P["orderBy"]
        >,
        P["limit"]
    >,
    P["offset"]
>;
