/**
 * Subquery Parser Tests
 *
 * Tests for parsing derived tables and scalar subqueries.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    ColumnRef,
    DerivedTableRef,
    SubqueryExpr,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Derived Table (Subquery in FROM) Tests
// ============================================================================

// Test: Derived table
type P_DerivedTable = ParseSQL<`
  SELECT sub.total
  FROM ( SELECT COUNT ( * ) AS total FROM users ) AS sub
`>
type P_DerivedTable_Check = P_DerivedTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: DerivedTableRef<SelectClause, "sub"> }
    ? true
    : false
    : false
type _P49 = RequireTrue<P_DerivedTable_Check>

// ============================================================================
// Scalar Subquery Tests
// ============================================================================

// Test: Scalar subquery in SELECT
type P_ScalarSubquery = ParseSQL<`
  SELECT
    id,
    ( SELECT COUNT ( * ) FROM orders WHERE user_id = users.id ) AS order_count
  FROM users
`>
type P_ScalarSubquery_Check = P_ScalarSubquery extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [ColumnRef, ColumnRef<SubqueryExpr<SelectClause, undefined>, "order_count">]
    }
    ? true
    : false
    : false
type _P52 = RequireTrue<P_ScalarSubquery_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type SubqueriesParserTestsPass = true
