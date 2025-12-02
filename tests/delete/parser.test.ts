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
  DeleteReturningClause,
  TableRef,
  UnboundColumnRef,
  ParseError,
} from "../../src/index.js"
import type {
  AssertEqual,
  AssertExtends,
  RequireTrue,
  AssertIsParseError,
} from "../helpers.js"

// ============================================================================
// Basic DELETE Tests
// ============================================================================

// Test: Basic DELETE FROM
type P_Basic = ParseDeleteSQL<"DELETE FROM users">
type _P1 = RequireTrue<AssertExtends<P_Basic, SQLDeleteQuery>>

// Test: DELETE with WHERE clause
type P_Where = ParseDeleteSQL<"DELETE FROM users WHERE id = 1">
type _P2 = RequireTrue<AssertExtends<P_Where, SQLDeleteQuery>>

// Test: DELETE with complex WHERE
type P_ComplexWhere = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 AND active = FALSE">
type _P3 = RequireTrue<AssertExtends<P_ComplexWhere, SQLDeleteQuery>>

// Test: DELETE with schema.table
type P_SchemaTable = ParseDeleteSQL<"DELETE FROM public.users WHERE id = 1">
type P_SchemaTable_Check = P_SchemaTable extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<TableRef<"users", "users", "public">, any, any, any>
    ? true
    : false
  : false
type _P4 = RequireTrue<P_SchemaTable_Check>

// ============================================================================
// USING Clause Tests (PostgreSQL multi-table DELETE)
// ============================================================================

// Test: DELETE with USING clause
type P_Using = ParseDeleteSQL<"DELETE FROM users USING accounts WHERE users.account_id = accounts.id">
type P_Using_Check = P_Using extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<any, UsingClause<[TableRef]>, any, any>
    ? true
    : false
  : false
type _P5 = RequireTrue<P_Using_Check>

// Test: DELETE with multiple USING tables
type P_MultiUsing = ParseDeleteSQL<"DELETE FROM users USING accounts , roles WHERE users.account_id = accounts.id AND accounts.role_id = roles.id">
type P_MultiUsing_Check = P_MultiUsing extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<any, UsingClause<[TableRef, TableRef]>, any, any>
    ? true
    : false
  : false
type _P6 = RequireTrue<P_MultiUsing_Check>

// ============================================================================
// RETURNING Tests
// ============================================================================

// Test: RETURNING *
type P_ReturningStar = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING *">
type P_ReturningStar_Check = P_ReturningStar extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<any, any, any, DeleteReturningClause<"*">>
    ? true
    : false
  : false
type _P7 = RequireTrue<P_ReturningStar_Check>

// Test: RETURNING specific columns
type P_ReturningCols = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING id , name">
type P_ReturningCols_Check = P_ReturningCols extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<
      any,
      any,
      any,
      DeleteReturningClause<[UnboundColumnRef<"id">, UnboundColumnRef<"name">]>
    >
    ? true
    : false
  : false
type _P8 = RequireTrue<P_ReturningCols_Check>

// ============================================================================
// Combined Tests
// ============================================================================

// Test: Full DELETE with all clauses
type P_Full = ParseDeleteSQL<`
  DELETE FROM users
  USING accounts
  WHERE users.account_id = accounts.id AND users.active = FALSE
  RETURNING id , name
`>
type _P9 = RequireTrue<AssertExtends<P_Full, SQLDeleteQuery>>

// Test: DELETE via ParseSQL (router)
type P_ViaRouter = ParseSQL<"DELETE FROM users WHERE id = 1">
type _P10 = RequireTrue<AssertExtends<P_ViaRouter, SQLDeleteQuery>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Missing FROM
type P_NoFrom = ParseDeleteSQL<"DELETE users WHERE id = 1">
type _P11 = RequireTrue<AssertIsParseError<P_NoFrom>>

// Test: Empty query
type P_Empty = ParseDeleteSQL<"">
type _P12 = RequireTrue<AssertIsParseError<P_Empty>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are handled
type P_ExtraSpaces = ParseDeleteSQL<"DELETE    FROM    users    WHERE    id = 1">
type _P13 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLDeleteQuery>>

// Test: Newlines are handled
type P_Newlines = ParseDeleteSQL<`
DELETE FROM users
WHERE id = 1
`>
type _P14 = RequireTrue<AssertExtends<P_Newlines, SQLDeleteQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseDeleteSQL<"delete from users where id = 1">
type _P15 = RequireTrue<AssertExtends<P_Lowercase, SQLDeleteQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseDeleteSQL<"Delete From users Where id = 1">
type _P16 = RequireTrue<AssertExtends<P_MixedCase, SQLDeleteQuery>>

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
type _P17 = RequireTrue<P_QuotedTable_Check>

// ============================================================================
// Table Alias Tests
// ============================================================================

// Test: Table with alias
type P_Alias = ParseDeleteSQL<"DELETE FROM users u WHERE u.id = 1">
type P_Alias_Check = P_Alias extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<TableRef<"users", "u", undefined>, any, any, any>
    ? true
    : false
  : false
type _P18 = RequireTrue<P_Alias_Check>

// Test: Table with AS alias
type P_AsAlias = ParseDeleteSQL<"DELETE FROM users AS u WHERE u.id = 1">
type P_AsAlias_Check = P_AsAlias extends SQLDeleteQuery<infer Q>
  ? Q extends DeleteClause<TableRef<"users", "u", undefined>, any, any, any>
    ? true
    : false
  : false
type _P19 = RequireTrue<P_AsAlias_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type DeleteParserTestsPass = true

