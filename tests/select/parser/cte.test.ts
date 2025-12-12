/**
 * CTE (WITH clause) Parser Tests
 *
 * Tests for parsing Common Table Expressions.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    CTEDefinition,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// CTE (WITH clause) Tests
// ============================================================================

// Test: Simple CTE
type P_CTE = ParseSQL<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE active = TRUE
  )
  SELECT * FROM active_users
`>
type P_CTE_Check = P_CTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: [CTEDefinition<"active_users", SelectClause>] }
    ? true
    : false
    : false
type _P46 = RequireTrue<P_CTE_Check>

// Test: Multiple CTEs
type P_MultiCTE = ParseSQL<`
  WITH
    cte1 AS ( SELECT id FROM users ),
    cte2 AS ( SELECT id FROM orders )
  SELECT * FROM cte1 LEFT JOIN cte2 ON cte1.id = cte2.id
`>
type P_MultiCTE_Check = P_MultiCTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: [CTEDefinition<"cte1", SelectClause>, CTEDefinition<"cte2", SelectClause>] }
    ? true
    : false
    : false
type _P47 = RequireTrue<P_MultiCTE_Check>

// Test: Without CTE
type P_NoCTE = ParseSQL<"SELECT * FROM users">
type P_NoCTE_Check = P_NoCTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: undefined }
    ? true
    : false
    : false
type _P48 = RequireTrue<P_NoCTE_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type CTEParserTestsPass = true
