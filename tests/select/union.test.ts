/**
 * Union Query Tests
 *
 * Tests for UNION, UNION ALL, INTERSECT, INTERSECT ALL, EXCEPT, EXCEPT ALL queries.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    UnionClause,
    UnionClauseAny,
    ColumnRef,
    UnboundColumnRef,
    TableColumnRef,
    TableRef,
    QueryResult,
    DatabaseSchema,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsParseError, AssertNotMatchError } from "../helpers.js"

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
    schemas: {
        public: {
            users: { id: number; name: string; email: string; status: string }
            admins: { id: number; name: string; email: string; level: number }
            orders: { id: number; user_id: number; total: number }
            products: { id: number; name: string; price: number }
        }
    }
    defaultSchema: "public"
}

// ============================================================================
// Basic UNION Tests
// ============================================================================

// Test: Simple UNION
type P_Union = ParseSQL<"SELECT id, name FROM users UNION SELECT id, name FROM admins">
type _U1 = RequireTrue<AssertExtends<P_Union, SQLSelectQuery<UnionClauseAny>>>

// Test: UNION query has correct structure
type P_Union_Check = P_Union extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "UNION", SelectClause>
    ? true
    : false
    : false
type _U2 = RequireTrue<P_Union_Check>

// Test: UNION ALL
type P_UnionAll = ParseSQL<"SELECT id, name FROM users UNION ALL SELECT id, name FROM admins">
type P_UnionAll_Check = P_UnionAll extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "UNION ALL", SelectClause>
    ? true
    : false
    : false
type _U3 = RequireTrue<P_UnionAll_Check>

// ============================================================================
// INTERSECT Tests
// ============================================================================

// Test: INTERSECT
type P_Intersect = ParseSQL<"SELECT id, name FROM users INTERSECT SELECT id, name FROM admins">
type P_Intersect_Check = P_Intersect extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "INTERSECT", SelectClause>
    ? true
    : false
    : false
type _U4 = RequireTrue<P_Intersect_Check>

// Test: INTERSECT ALL
type P_IntersectAll = ParseSQL<"SELECT id, name FROM users INTERSECT ALL SELECT id, name FROM admins">
type P_IntersectAll_Check = P_IntersectAll extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "INTERSECT ALL", SelectClause>
    ? true
    : false
    : false
type _U5 = RequireTrue<P_IntersectAll_Check>

// ============================================================================
// EXCEPT Tests
// ============================================================================

// Test: EXCEPT
type P_Except = ParseSQL<"SELECT id, name FROM users EXCEPT SELECT id, name FROM admins">
type P_Except_Check = P_Except extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "EXCEPT", SelectClause>
    ? true
    : false
    : false
type _U6 = RequireTrue<P_Except_Check>

// Test: EXCEPT ALL
type P_ExceptAll = ParseSQL<"SELECT id, name FROM users EXCEPT ALL SELECT id, name FROM admins">
type P_ExceptAll_Check = P_ExceptAll extends SQLSelectQuery<infer Q>
    ? Q extends UnionClause<SelectClause, "EXCEPT ALL", SelectClause>
    ? true
    : false
    : false
type _U7 = RequireTrue<P_ExceptAll_Check>

// ============================================================================
// Complex UNION Tests
// ============================================================================

// Test: UNION with WHERE clause on both sides
type P_UnionWhere = ParseSQL<`
    SELECT id, name FROM users WHERE status = 'active'
    UNION
    SELECT id, name FROM admins WHERE level > 1
`>
type _U8 = RequireTrue<AssertExtends<P_UnionWhere, SQLSelectQuery<UnionClauseAny>>>

// Test: UNION with ORDER BY on first query (typically needs parentheses in real SQL)
type P_UnionOrdered = ParseSQL<`
    SELECT id, name FROM users ORDER BY name
    UNION
    SELECT id, name FROM admins
`>
type _U9 = RequireTrue<AssertExtends<P_UnionOrdered, SQLSelectQuery<UnionClauseAny>>>

// Test: UNION with LIMIT
type P_UnionLimit = ParseSQL<`
    SELECT id, name FROM users LIMIT 10
    UNION
    SELECT id, name FROM admins
`>
type _U10 = RequireTrue<AssertExtends<P_UnionLimit, SQLSelectQuery<UnionClauseAny>>>

// Test: UNION with aliased columns
type P_UnionAliased = ParseSQL<`
    SELECT id AS user_id, name AS user_name FROM users
    UNION
    SELECT id AS user_id, name AS user_name FROM admins
`>
type _U11 = RequireTrue<AssertExtends<P_UnionAliased, SQLSelectQuery<UnionClauseAny>>>

// ============================================================================
// UNION with JOINs
// ============================================================================

// Test: UNION with JOIN on first query
type P_UnionJoin = ParseSQL<`
    SELECT u.id, u.name FROM users AS u LEFT JOIN orders AS o ON u.id = o.user_id
    UNION
    SELECT id, name FROM admins
`>
type _U12 = RequireTrue<AssertExtends<P_UnionJoin, SQLSelectQuery<UnionClauseAny>>>

// ============================================================================
// Matcher Tests - UNION Result Types
// ============================================================================

// Test: UNION result type combines both query types
type R_Union = QueryResult<"SELECT id, name FROM users UNION SELECT id, name FROM admins", TestSchema>
type R_Union_Check = R_Union extends { id: number; name: string } ? true : false
type _M1 = RequireTrue<R_Union_Check>
type _M1a = RequireTrue<AssertNotMatchError<R_Union>>

// Test: UNION ALL result type
type R_UnionAll = QueryResult<"SELECT id, name FROM users UNION ALL SELECT id, name FROM admins", TestSchema>
type R_UnionAll_Check = R_UnionAll extends { id: number; name: string } ? true : false
type _M2 = RequireTrue<R_UnionAll_Check>

// Test: INTERSECT result type
type R_Intersect = QueryResult<"SELECT id, name FROM users INTERSECT SELECT id, name FROM admins", TestSchema>
type R_Intersect_Check = R_Intersect extends { id: number; name: string } ? true : false
type _M3 = RequireTrue<R_Intersect_Check>

// Test: EXCEPT result type (same as left side)
type R_Except = QueryResult<"SELECT id, name FROM users EXCEPT SELECT id, name FROM admins", TestSchema>
type R_Except_Check = R_Except extends { id: number; name: string } ? true : false
type _M4 = RequireTrue<R_Except_Check>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: lowercase union
type P_LowerUnion = ParseSQL<"select id from users union select id from admins">
type _C1 = RequireTrue<AssertExtends<P_LowerUnion, SQLSelectQuery<UnionClauseAny>>>

// Test: mixed case
type P_MixedUnion = ParseSQL<"SELECT id FROM users Union All SELECT id FROM admins">
type _C2 = RequireTrue<AssertExtends<P_MixedUnion, SQLSelectQuery<UnionClauseAny>>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra whitespace around UNION
type P_WhitespaceUnion = ParseSQL<`
    SELECT id FROM users
    
    UNION
    
    SELECT id FROM admins
`>
type _W1 = RequireTrue<AssertExtends<P_WhitespaceUnion, SQLSelectQuery<UnionClauseAny>>>

// ============================================================================
// Non-UNION Query Still Works
// ============================================================================

// Test: Regular SELECT still works
type P_Regular = ParseSQL<"SELECT id, name FROM users">
type P_Regular_Check = P_Regular extends SQLSelectQuery<infer Q>
    ? Q extends SelectClause
    ? true
    : false
    : false
type _N1 = RequireTrue<P_Regular_Check>

// Test: Regular SELECT with WHERE still works
type P_RegularWhere = ParseSQL<"SELECT id FROM users WHERE status = 'active'">
type _N2 = RequireTrue<AssertExtends<P_RegularWhere, SQLSelectQuery<SelectClause>>>

// Test: Regular SELECT with all clauses still works
type P_RegularFull = ParseSQL<`
    SELECT u.id, u.name
    FROM users AS u
    LEFT JOIN orders AS o ON u.id = o.user_id
    WHERE u.status = 'active'
    ORDER BY u.name
    LIMIT 10
    OFFSET 5
`>
type _N3 = RequireTrue<AssertExtends<P_RegularFull, SQLSelectQuery<SelectClause>>>

// ============================================================================
// Export for verification
// ============================================================================

export type UnionTestsPass = true

