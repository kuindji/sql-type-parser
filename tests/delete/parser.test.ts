/**
 * DELETE Parser Type Tests
 *
 * Tests for the ParseDeleteSQL type and related parsing functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    ParseDeleteSQL,
    SQLDeleteQuery,
    DeleteClause,
    UsingClause,
    TableRef,
    UnboundColumnRef,
    ParsedCondition,
    ParseError,
} from "../../src/index.js"
import type { ReturningClause } from "../../src/delete/ast.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsParseError } from "../helpers.js"

// ============================================================================
// Basic DELETE Tests
// ============================================================================

// Test: DELETE FROM table
type P_BasicDelete = ParseDeleteSQL<"DELETE FROM users">
type _P1 = RequireTrue<AssertExtends<P_BasicDelete, SQLDeleteQuery>>

// Test: DELETE with WHERE clause
type P_WithWhere = ParseDeleteSQL<"DELETE FROM users WHERE id = 1">
type _P2 = RequireTrue<AssertExtends<P_WithWhere, SQLDeleteQuery>>

// Test: Check table is parsed correctly
type P_BasicDelete_Check = P_BasicDelete extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<TableRef<"users", "users", undefined>, any, any, any>
        ? true
        : false
    : false
type _P3 = RequireTrue<P_BasicDelete_Check>

// Test: DELETE with schema.table
type P_SchemaTable = ParseDeleteSQL<"DELETE FROM public.users WHERE id = 1">
type P_SchemaTable_Check = P_SchemaTable extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<TableRef<"users", "users", "public">, any, any, any>
        ? true
        : false
    : false
type _P4 = RequireTrue<P_SchemaTable_Check>

// ============================================================================
// WHERE Clause Tests
// ============================================================================

// Test: WHERE clause is parsed
type P_Where = ParseDeleteSQL<"DELETE FROM users WHERE active = FALSE">
type P_Where_Check = P_Where extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, any, ParsedCondition, any>
        ? true
        : false
    : false
type _P5 = RequireTrue<P_Where_Check>

// Test: Without WHERE
type P_NoWhere = ParseDeleteSQL<"DELETE FROM users">
type P_NoWhere_Check = P_NoWhere extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, any, undefined, any>
        ? true
        : false
    : false
type _P6 = RequireTrue<P_NoWhere_Check>

// Test: Complex WHERE with AND/OR
type P_ComplexWhere = ParseDeleteSQL<"DELETE FROM users WHERE active = FALSE AND created_at < '2024-01-01'">
type _P7 = RequireTrue<AssertExtends<P_ComplexWhere, SQLDeleteQuery>>

// ============================================================================
// RETURNING Tests
// ============================================================================

// Test: RETURNING *
type P_ReturningStar = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING *">
type P_ReturningStar_Check = P_ReturningStar extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, any, any, ReturningClause<"*">>
        ? true
        : false
    : false
type _P8 = RequireTrue<P_ReturningStar_Check>

// Test: RETURNING specific columns
type P_ReturningCols = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING id , name">
type P_ReturningCols_Check = P_ReturningCols extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, any, any, ReturningClause<[UnboundColumnRef<"id">, UnboundColumnRef<"name">]>>
        ? true
        : false
    : false
type _P9 = RequireTrue<P_ReturningCols_Check>

// Test: Without RETURNING
type P_NoReturning = ParseDeleteSQL<"DELETE FROM users WHERE id = 1">
type P_NoReturning_Check = P_NoReturning extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, any, any, undefined>
        ? true
        : false
    : false
type _P10 = RequireTrue<P_NoReturning_Check>

// ============================================================================
// USING Clause Tests (PostgreSQL multi-table delete)
// ============================================================================

// Test: DELETE with USING
type P_Using = ParseDeleteSQL<"DELETE FROM orders USING users WHERE orders.user_id = users.id">
type P_Using_Check = P_Using extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<any, UsingClause, any, any>
        ? true
        : false
    : false
type _P11 = RequireTrue<P_Using_Check>

// Test: DELETE with multiple USING tables
type P_MultiUsing = ParseDeleteSQL<"DELETE FROM order_items USING orders , users WHERE order_items.order_id = orders.id AND orders.user_id = users.id">
type _P12 = RequireTrue<AssertExtends<P_MultiUsing, SQLDeleteQuery>>

// ============================================================================
// Combined Tests
// ============================================================================

// Test: Full DELETE with all clauses
type P_Full = ParseDeleteSQL<`
    DELETE FROM users
    WHERE active = FALSE
    RETURNING id , name , email
`>
type _P13 = RequireTrue<AssertExtends<P_Full, SQLDeleteQuery>>

// Test: DELETE via ParseSQL (router)
type P_ViaRouter = ParseSQL<"DELETE FROM users WHERE id = 1">
type _P14 = RequireTrue<AssertExtends<P_ViaRouter, SQLDeleteQuery>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Missing FROM
type P_NoFrom = ParseDeleteSQL<"DELETE users">
type _P15 = RequireTrue<AssertIsParseError<P_NoFrom>>

// Test: Empty query
type P_Empty = ParseDeleteSQL<"">
type _P16 = RequireTrue<AssertIsParseError<P_Empty>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are handled
type P_ExtraSpaces = ParseDeleteSQL<"DELETE    FROM    users    WHERE    id = 1">
type _P17 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLDeleteQuery>>

// Test: Newlines are handled
type P_Newlines = ParseDeleteSQL<`
DELETE FROM users
WHERE id = 1
RETURNING *
`>
type _P18 = RequireTrue<AssertExtends<P_Newlines, SQLDeleteQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseDeleteSQL<"delete from users where id = 1">
type _P19 = RequireTrue<AssertExtends<P_Lowercase, SQLDeleteQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseDeleteSQL<"Delete From users Where id = 1">
type _P20 = RequireTrue<AssertExtends<P_MixedCase, SQLDeleteQuery>>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted table name
type P_QuotedTable = ParseDeleteSQL<'DELETE FROM "UserAccounts" WHERE id = 1'>
type P_QuotedTable_Check = P_QuotedTable extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<TableRef<"UserAccounts", "UserAccounts", undefined>, any, any, any>
        ? true
        : false
    : false
type _P21 = RequireTrue<P_QuotedTable_Check>

// ============================================================================
// Table Alias Tests
// ============================================================================

// Test: DELETE with table alias
type P_TableAlias = ParseDeleteSQL<"DELETE FROM users AS u WHERE u.id = 1">
type P_TableAlias_Check = P_TableAlias extends SQLDeleteQuery<infer Q>
    ? Q extends DeleteClause<TableRef<"users", "u", undefined>, any, any, any>
        ? true
        : false
    : false
type _P22 = RequireTrue<P_TableAlias_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type DeleteParserTestsPass = true

