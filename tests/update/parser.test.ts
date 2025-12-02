/**
 * UPDATE Parser Type Tests
 *
 * Tests for the ParseUpdateSQL type and related parsing functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
  ParseSQL,
  ParseUpdateSQL,
  SQLUpdateQuery,
  UpdateClause,
  SetClause,
  SetAssignment,
  UpdateFromClause,
  UpdateReturningClause,
  TableRef,
  UnboundColumnRef,
  ParseError,
  QualifiedColumnRef,
  QualifiedWildcard,
} from "../../src/index.js"
import type {
  AssertEqual,
  AssertExtends,
  RequireTrue,
  AssertIsParseError,
} from "../helpers.js"

// ============================================================================
// Basic UPDATE Tests
// ============================================================================

// Test: Basic UPDATE with SET
type P_Basic = ParseUpdateSQL<"UPDATE users SET name = 'John'">
type _P1 = RequireTrue<AssertExtends<P_Basic, SQLUpdateQuery>>

// Test: UPDATE with multiple SET assignments
type P_MultiSet = ParseUpdateSQL<"UPDATE users SET name = 'John' , email = 'john@example.com'">
type _P2 = RequireTrue<AssertExtends<P_MultiSet, SQLUpdateQuery>>

// Test: UPDATE with WHERE clause
type P_Where = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1">
type _P3 = RequireTrue<AssertExtends<P_Where, SQLUpdateQuery>>

// Test: UPDATE with schema.table
type P_SchemaTable = ParseUpdateSQL<"UPDATE public.users SET name = 'John'">
type P_SchemaTable_Check = P_SchemaTable extends SQLUpdateQuery<infer Q>
  ? Q extends UpdateClause<TableRef<"users", "users", "public">, any, any, any, any, any>
    ? true
    : false
  : false
type _P4 = RequireTrue<P_SchemaTable_Check>

// ============================================================================
// SET Value Tests
// ============================================================================

// Test: SET with NULL value
type P_SetNull = ParseUpdateSQL<"UPDATE users SET email = NULL">
type _P5 = RequireTrue<AssertExtends<P_SetNull, SQLUpdateQuery>>

// Test: SET with DEFAULT value
type P_SetDefault = ParseUpdateSQL<"UPDATE users SET created_at = DEFAULT">
type _P6 = RequireTrue<AssertExtends<P_SetDefault, SQLUpdateQuery>>

// Test: SET with boolean values
type P_SetBool = ParseUpdateSQL<"UPDATE users SET active = TRUE , verified = FALSE">
type _P7 = RequireTrue<AssertExtends<P_SetBool, SQLUpdateQuery>>

// Test: SET with numeric values
type P_SetNum = ParseUpdateSQL<"UPDATE products SET price = 19.99 , quantity = 100">
type _P8 = RequireTrue<AssertExtends<P_SetNum, SQLUpdateQuery>>

// Test: SET with parameter placeholders
type P_SetParams = ParseUpdateSQL<"UPDATE users SET name = $1 , email = $2">
type _P9 = RequireTrue<AssertExtends<P_SetParams, SQLUpdateQuery>>

// Test: SET with column reference
type P_SetColRef = ParseUpdateSQL<"UPDATE users SET updated_name = name">
type _P10 = RequireTrue<AssertExtends<P_SetColRef, SQLUpdateQuery>>

// ============================================================================
// RETURNING Tests
// ============================================================================

// Test: RETURNING *
type P_ReturningStar = ParseUpdateSQL<"UPDATE users SET name = 'John' RETURNING *">
type P_ReturningStar_Check = P_ReturningStar extends SQLUpdateQuery<infer Q>
  ? Q extends UpdateClause<any, any, any, any, UpdateReturningClause<"*">, any>
    ? true
    : false
  : false
type _P11 = RequireTrue<P_ReturningStar_Check>

// Test: RETURNING specific columns
type P_ReturningCols = ParseUpdateSQL<"UPDATE users SET name = 'John' RETURNING id , name">
type _P12 = RequireTrue<AssertExtends<P_ReturningCols, SQLUpdateQuery>>

// Test: RETURNING with OLD qualifier (PostgreSQL 17+)
type P_ReturningOld = ParseUpdateSQL<"UPDATE users SET name = 'John' RETURNING OLD.name">
type _P13 = RequireTrue<AssertExtends<P_ReturningOld, SQLUpdateQuery>>

// Test: RETURNING with NEW qualifier (PostgreSQL 17+)
type P_ReturningNew = ParseUpdateSQL<"UPDATE users SET name = 'John' RETURNING NEW.name">
type _P14 = RequireTrue<AssertExtends<P_ReturningNew, SQLUpdateQuery>>

// Test: RETURNING with OLD.* wildcard
type P_ReturningOldStar = ParseUpdateSQL<"UPDATE users SET name = 'John' RETURNING OLD.*">
type _P15 = RequireTrue<AssertExtends<P_ReturningOldStar, SQLUpdateQuery>>

// ============================================================================
// FROM Clause Tests (PostgreSQL multi-table UPDATE)
// ============================================================================

// Test: UPDATE with FROM clause
type P_From = ParseUpdateSQL<"UPDATE users SET email = emails.address FROM emails WHERE users.id = emails.user_id">
type _P16 = RequireTrue<AssertExtends<P_From, SQLUpdateQuery>>

// Test: UPDATE with FROM and JOIN
type P_FromJoin = ParseUpdateSQL<"UPDATE users SET status = 'active' FROM accounts JOIN roles ON accounts.role_id = roles.id WHERE users.account_id = accounts.id">
type _P17 = RequireTrue<AssertExtends<P_FromJoin, SQLUpdateQuery>>

// ============================================================================
// Combined Tests
// ============================================================================

// Test: Full UPDATE with all clauses
type P_Full = ParseUpdateSQL<`
  UPDATE users
  SET name = 'John' , email = 'john@example.com'
  FROM accounts
  WHERE users.id = 1 AND accounts.user_id = users.id
  RETURNING id , name
`>
type _P18 = RequireTrue<AssertExtends<P_Full, SQLUpdateQuery>>

// Test: UPDATE via ParseSQL (router)
type P_ViaRouter = ParseSQL<"UPDATE users SET name = 'John'">
type _P19 = RequireTrue<AssertExtends<P_ViaRouter, SQLUpdateQuery>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Missing SET clause
type P_NoSet = ParseUpdateSQL<"UPDATE users WHERE id = 1">
type _P20 = RequireTrue<AssertIsParseError<P_NoSet>>

// Test: Empty query
type P_Empty = ParseUpdateSQL<"">
type _P21 = RequireTrue<AssertIsParseError<P_Empty>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are handled
type P_ExtraSpaces = ParseUpdateSQL<"UPDATE    users    SET    name = 'John'">
type _P22 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLUpdateQuery>>

// Test: Newlines are handled
type P_Newlines = ParseUpdateSQL<`
UPDATE users
SET name = 'John'
WHERE id = 1
`>
type _P23 = RequireTrue<AssertExtends<P_Newlines, SQLUpdateQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseUpdateSQL<"update users set name = 'John'">
type _P24 = RequireTrue<AssertExtends<P_Lowercase, SQLUpdateQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseUpdateSQL<"Update users Set name = 'John' Where id = 1">
type _P25 = RequireTrue<AssertExtends<P_MixedCase, SQLUpdateQuery>>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted table name
type P_QuotedTable = ParseUpdateSQL<'UPDATE "UserAccounts" SET name = \'John\''>
type P_QuotedTable_Check = P_QuotedTable extends SQLUpdateQuery<infer Q>
  ? Q extends UpdateClause<TableRef<"UserAccounts", "UserAccounts", undefined>, any, any, any, any, any>
    ? true
    : false
  : false
type _P26 = RequireTrue<P_QuotedTable_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type UpdateParserTestsPass = true

