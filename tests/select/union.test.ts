/**
 * UNION Type Tests
 *
 * Tests for UNION/INTERSECT/EXCEPT parsing functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    UnionClause,
    UnionClauseAny,
} from "../../src/index.js"
import type { AssertExtends, RequireTrue } from "../helpers.js"

// ============================================================================
// Basic UNION Tests
// ============================================================================

// Test: Simple UNION
type U_Simple = ParseSQL<"SELECT id FROM users UNION SELECT id FROM admins">
type _U1 = RequireTrue<AssertExtends<U_Simple, SQLSelectQuery>>

// Test: UNION has correct structure
type U_Simple_Check = U_Simple extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "UNION", SelectClause>
        ? true
        : false
    : false
type _U2 = RequireTrue<U_Simple_Check>

// Test: UNION ALL
type U_All = ParseSQL<"SELECT id FROM users UNION ALL SELECT id FROM admins">
type U_All_Check = U_All extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "UNION ALL", SelectClause>
        ? true
        : false
    : false
type _U3 = RequireTrue<U_All_Check>

// ============================================================================
// INTERSECT Tests
// ============================================================================

// Test: INTERSECT
type I_Simple = ParseSQL<"SELECT id FROM users INTERSECT SELECT id FROM active_users">
type I_Simple_Check = I_Simple extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "INTERSECT", SelectClause>
        ? true
        : false
    : false
type _I1 = RequireTrue<I_Simple_Check>

// Test: INTERSECT ALL
type I_All = ParseSQL<"SELECT id FROM users INTERSECT ALL SELECT id FROM active_users">
type I_All_Check = I_All extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "INTERSECT ALL", SelectClause>
        ? true
        : false
    : false
type _I2 = RequireTrue<I_All_Check>

// ============================================================================
// EXCEPT Tests
// ============================================================================

// Test: EXCEPT
type E_Simple = ParseSQL<"SELECT id FROM users EXCEPT SELECT id FROM inactive_users">
type E_Simple_Check = E_Simple extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "EXCEPT", SelectClause>
        ? true
        : false
    : false
type _E1 = RequireTrue<E_Simple_Check>

// Test: EXCEPT ALL
type E_All = ParseSQL<"SELECT id FROM users EXCEPT ALL SELECT id FROM inactive_users">
type E_All_Check = E_All extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "EXCEPT ALL", SelectClause>
        ? true
        : false
    : false
type _E2 = RequireTrue<E_All_Check>

// ============================================================================
// Complex UNION Tests
// ============================================================================

// Test: UNION with WHERE clauses
type U_Where = ParseSQL<`
  SELECT id FROM users WHERE active = TRUE
  UNION
  SELECT id FROM admins WHERE role = 'super'
`>
type _U4 = RequireTrue<AssertExtends<U_Where, SQLSelectQuery>>

// Test: UNION with ORDER BY on final result
type U_OrderBy = ParseSQL<`
  SELECT id, name FROM users
  UNION
  SELECT id, name FROM admins
  ORDER BY name ASC
`>
type _U5 = RequireTrue<AssertExtends<U_OrderBy, SQLSelectQuery>>

// Test: UNION with LIMIT
type U_Limit = ParseSQL<`
  SELECT id FROM users
  UNION
  SELECT id FROM admins
  LIMIT 10
`>
type _U6 = RequireTrue<AssertExtends<U_Limit, SQLSelectQuery>>

// ============================================================================
// Export for verification
// ============================================================================

export type UnionTestsPass = true

