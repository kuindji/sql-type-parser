/**
 * Complete Query Parser Tests
 *
 * Tests for parsing complex queries with mixed columns and all features.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    ColumnRef,
    TableRef,
    TableWildcard,
    JoinClause,
    OrderByItem,
    AggregateExpr,
    CTEDefinition,
    ParsedCondition,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Mixed Columns Test
// ============================================================================

// Test: Mix of regular columns, aggregates, and wildcards
type P_MixedCols = ParseSQL<`
  SELECT
    u.*,
    COUNT ( p.id ) AS post_count,
    MAX ( p.created_at ) AS last_post
  FROM users AS u
  LEFT JOIN posts AS p ON u.id = p.author_id
  GROUP BY u.id
`>
type P_MixedCols_Check = P_MixedCols extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [
            TableWildcard<"u", undefined>,
            AggregateExpr<"COUNT", any, "post_count">,
            AggregateExpr<"MAX", any, "last_post">,
        ]
    }
    ? true
    : false
    : false
type _P56 = RequireTrue<P_MixedCols_Check>

// ============================================================================
// Complete Query Tests
// ============================================================================

// Test: Full complex query
type P_Full = ParseSQL<`
  WITH recent_orders AS (
    SELECT user_id, SUM ( total ) AS total
    FROM orders
    WHERE created_at > '2024-01-01'
    GROUP BY user_id
  )
  SELECT DISTINCT
    u.id,
    u.name,
    u.email,
    ro.total
  FROM users AS u
  LEFT JOIN recent_orders AS ro ON u.id = ro.user_id
  WHERE u.status = 'active'
  ORDER BY ro.total DESC
  LIMIT 100
  OFFSET 0
`>
type P_Full_Check = P_Full extends SQLSelectQuery<infer Q>
    ? Q extends {
        distinct: true
        columns: [ColumnRef, ColumnRef, ColumnRef, ColumnRef]
        from: TableRef<"users", "u", undefined>
        joins: [JoinClause<"LEFT", TableRef, ParsedCondition>]
        where: ParsedCondition
        orderBy: [OrderByItem<any, "DESC">]
        limit: 100
        offset: 0
        ctes: [CTEDefinition<"recent_orders", SelectClause>]
    }
    ? true
    : false
    : false
type _P57 = RequireTrue<P_Full_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type CompleteParserTestsPass = true
