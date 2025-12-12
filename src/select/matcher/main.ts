/**
 * Main matcher entry points
 *
 * Top-level types for matching parsed SELECT queries against schemas.
 */

import type {
    SelectClause,
    SQLSelectQuery,
    UnionClauseAny,
} from "../ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type {
    DynamicQuery,
    DynamicQueryResult,
    MatchError,
} from "../../common/utils.js";

import type { MatchColumns } from "./columns.js";
import type { BuildTableContextWithCTEs } from "./context.js";
import type { MatchUnionClause } from "./union.js";

// ============================================================================
// Main Matcher
// ============================================================================

/**
 * Match a parsed SQL SELECT query against a schema to get the result type
 *
 * For dynamic queries (DynamicQuery marker), returns DynamicQueryResult
 * which allows any property access without type errors.
 */
export type MatchSelectQuery<
    Query,
    Schema extends DatabaseSchema,
> = Query extends DynamicQuery ? DynamicQueryResult
    : Query extends SQLSelectQuery<infer QueryContent>
        ? QueryContent extends UnionClauseAny
            ? MatchUnionClause<QueryContent, Schema>
        : QueryContent extends SelectClause
            ? MatchSelectClause<QueryContent, Schema>
        : MatchError<"Invalid query content type">
    : MatchError<"Invalid query type">;

/**
 * Match a SELECT clause against the schema
 */
export type MatchSelectClause<
    Select,
    Schema extends DatabaseSchema,
> = Select extends SelectClause<
    infer Columns,
    infer From,
    infer Joins,
    infer _Where,
    infer _GroupBy,
    infer _Having,
    infer _OrderBy,
    infer _Limit,
    infer _Offset,
    infer _Distinct,
    infer CTEs
>
    ? BuildTableContextWithCTEs<From, Joins, CTEs, Schema> extends infer Context
        ? Context extends MatchError<string> ? Context
        : MatchColumns<Columns, Context, Schema>
    : never
    : MatchError<"Invalid SELECT clause">;
