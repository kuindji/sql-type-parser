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
    TableRef,
    UnboundColumnRef,
    ParsedCondition,
    ParseError,
} from "../../src/index.js"
import type { ReturningClause } from "../../src/update/ast.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsParseError } from "../helpers.js"

// ============================================================================
// Basic UPDATE Tests
// ============================================================================

// Test: UPDATE table SET column = value
type P_BasicUpdate = ParseUpdateSQL<"UPDATE users SET name = 'John'">
type _P1 = RequireTrue<AssertExtends<P_BasicUpdate, SQLUpdateQuery>>

// Test: UPDATE with WHERE clause
type P_WithWhere = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1">
type _P2 = RequireTrue<AssertExtends<P_WithWhere, SQLUpdateQuery>>

// Test: Check table is parsed correctly
type P_BasicUpdate_Check = P_BasicUpdate extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<TableRef<"users", "users", undefined>, any, any, any, any>
        ? true
        : false
    : false
type _P3 = RequireTrue<P_BasicUpdate_Check>

// Test: UPDATE with schema.table
type P_SchemaTable = ParseUpdateSQL<"UPDATE public.users SET name = 'John' WHERE id = 1">
type P_SchemaTable_Check = P_SchemaTable extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<TableRef<"users", "users", "public">, any, any, any, any>
        ? true
        : false
    : false
type _P4 = RequireTrue<P_SchemaTable_Check>

// ============================================================================
// SET Clause Tests
// ============================================================================

// Test: Single SET assignment
type P_SingleSet = ParseUpdateSQL<"UPDATE users SET name = 'John'">
type P_SingleSet_Check = P_SingleSet extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, SetClause<[SetAssignment<"name", any>]>, any, any, any>
        ? true
        : false
    : false
type _P5 = RequireTrue<P_SingleSet_Check>

// Test: Multiple SET assignments
type P_MultiSet = ParseUpdateSQL<"UPDATE users SET name = 'John' , email = 'john@example.com' , active = TRUE">
type P_MultiSet_Check = P_MultiSet extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, SetClause<[SetAssignment, SetAssignment, SetAssignment]>, any, any, any>
        ? true
        : false
    : false
type _P6 = RequireTrue<P_MultiSet_Check>

// Test: SET with NULL value
type P_SetNull = ParseUpdateSQL<"UPDATE users SET email = NULL WHERE id = 1">
type _P7 = RequireTrue<AssertExtends<P_SetNull, SQLUpdateQuery>>

// Test: SET with DEFAULT value
type P_SetDefault = ParseUpdateSQL<"UPDATE users SET created_at = DEFAULT WHERE id = 1">
type _P8 = RequireTrue<AssertExtends<P_SetDefault, SQLUpdateQuery>>

// Test: SET with boolean values
type P_SetBool = ParseUpdateSQL<"UPDATE users SET active = TRUE , verified = FALSE">
type _P9 = RequireTrue<AssertExtends<P_SetBool, SQLUpdateQuery>>

// Test: SET with numeric values
type P_SetNumeric = ParseUpdateSQL<"UPDATE products SET price = 19.99 , quantity = 100">
type _P10 = RequireTrue<AssertExtends<P_SetNumeric, SQLUpdateQuery>>

// Test: SET with parameter placeholders
type P_SetParams = ParseUpdateSQL<"UPDATE users SET name = $1 , email = $2 WHERE id = $3">
type _P11 = RequireTrue<AssertExtends<P_SetParams, SQLUpdateQuery>>

// ============================================================================
// WHERE Clause Tests
// ============================================================================

// Test: WHERE clause is parsed
type P_Where = ParseUpdateSQL<"UPDATE users SET active = FALSE WHERE created_at < '2024-01-01'">
type P_Where_Check = P_Where extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, ParsedCondition, any>
        ? true
        : false
    : false
type _P12 = RequireTrue<P_Where_Check>

// Test: Without WHERE
type P_NoWhere = ParseUpdateSQL<"UPDATE users SET active = FALSE">
type P_NoWhere_Check = P_NoWhere extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, undefined, any>
        ? true
        : false
    : false
type _P13 = RequireTrue<P_NoWhere_Check>

// Test: Complex WHERE with AND/OR
type P_ComplexWhere = ParseUpdateSQL<"UPDATE users SET active = FALSE WHERE role = 'admin' AND last_login < '2024-01-01'">
type _P14 = RequireTrue<AssertExtends<P_ComplexWhere, SQLUpdateQuery>>

// ============================================================================
// RETURNING Tests
// ============================================================================

// Test: RETURNING *
type P_ReturningStar = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING *">
type P_ReturningStar_Check = P_ReturningStar extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<"*">>
        ? true
        : false
    : false
type _P15 = RequireTrue<P_ReturningStar_Check>

// Test: RETURNING specific columns
type P_ReturningCols = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name , email">
type P_ReturningCols_Check = P_ReturningCols extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[UnboundColumnRef<"id">, UnboundColumnRef<"name">, UnboundColumnRef<"email">]>>
        ? true
        : false
    : false
type _P16 = RequireTrue<P_ReturningCols_Check>

// Test: Without RETURNING
type P_NoReturning = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1">
type P_NoReturning_Check = P_NoReturning extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, undefined>
        ? true
        : false
    : false
type _P17 = RequireTrue<P_NoReturning_Check>

// ============================================================================
// RETURNING with OLD/NEW (PostgreSQL 17+)
// ============================================================================

import type { QualifiedWildcard, QualifiedColumnRef } from "../../src/update/ast.js"

// Test: RETURNING OLD.*
type P_ReturningOldStar = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.*">
type P_ReturningOldStar_Check = P_ReturningOldStar extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedWildcard<"OLD">]>>
        ? true
        : false
    : false
type _P17a = RequireTrue<P_ReturningOldStar_Check>

// Test: RETURNING NEW.*
type P_ReturningNewStar = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.*">
type P_ReturningNewStar_Check = P_ReturningNewStar extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedWildcard<"NEW">]>>
        ? true
        : false
    : false
type _P17b = RequireTrue<P_ReturningNewStar_Check>

// Test: RETURNING OLD.column
type P_ReturningOldCol = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.name">
type P_ReturningOldCol_Check = P_ReturningOldCol extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedColumnRef<"name", "OLD">]>>
        ? true
        : false
    : false
type _P17c = RequireTrue<P_ReturningOldCol_Check>

// Test: RETURNING NEW.column
type P_ReturningNewCol = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.name">
type P_ReturningNewCol_Check = P_ReturningNewCol extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedColumnRef<"name", "NEW">]>>
        ? true
        : false
    : false
type _P17d = RequireTrue<P_ReturningNewCol_Check>

// Test: Mixed OLD and NEW columns
type P_ReturningMixed = ParseUpdateSQL<"UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING OLD.name , NEW.name , id">
type P_ReturningMixed_Check = P_ReturningMixed extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedColumnRef<"name", "OLD">, QualifiedColumnRef<"name", "NEW">, UnboundColumnRef<"id">]>>
        ? true
        : false
    : false
type _P17e = RequireTrue<P_ReturningMixed_Check>

// Test: RETURNING OLD.* and NEW.* together
type P_ReturningBothStar = ParseUpdateSQL<"UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING OLD.* , NEW.*">
type P_ReturningBothStar_Check = P_ReturningBothStar extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, ReturningClause<[QualifiedWildcard<"OLD">, QualifiedWildcard<"NEW">]>>
        ? true
        : false
    : false
type _P17f = RequireTrue<P_ReturningBothStar_Check>

// ============================================================================
// FROM Clause Tests (PostgreSQL multi-table update)
// ============================================================================

// Test: UPDATE with FROM
type P_From = ParseUpdateSQL<"UPDATE orders SET status = 'cancelled' FROM users WHERE orders.user_id = users.id AND users.active = FALSE">
type P_From_Check = P_From extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, UpdateFromClause, any, any, any>
        ? true
        : false
    : false
type _P18 = RequireTrue<P_From_Check>

// Test: UPDATE with multiple FROM tables
type P_MultiFrom = ParseUpdateSQL<"UPDATE order_items SET price = products.price FROM orders , products WHERE order_items.order_id = orders.id AND order_items.product_id = products.id">
type _P19 = RequireTrue<AssertExtends<P_MultiFrom, SQLUpdateQuery>>

// ============================================================================
// FROM Clause with JOIN Tests
// ============================================================================

import type { JoinClause } from "../../src/common/ast.js"

// Test: UPDATE with FROM and JOIN
type P_FromJoin = ParseUpdateSQL<"UPDATE orders SET status = 'shipped' FROM order_items JOIN products ON order_items.product_id = products.id WHERE orders.id = order_items.order_id">
type P_FromJoin_Check = P_FromJoin extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, UpdateFromClause<any, JoinClause[]>, any, any, any>
        ? true
        : false
    : false
type _P19a = RequireTrue<P_FromJoin_Check>

// Test: UPDATE with LEFT JOIN
type P_LeftJoin = ParseUpdateSQL<"UPDATE users SET last_order = orders.id FROM orders LEFT JOIN order_items ON orders.id = order_items.order_id WHERE users.id = orders.user_id">
type _P19b = RequireTrue<AssertExtends<P_LeftJoin, SQLUpdateQuery>>

// Test: UPDATE with multiple JOINs
type P_MultiJoin = ParseUpdateSQL<"UPDATE order_items SET total = products.price * order_items.quantity FROM orders JOIN products ON order_items.product_id = products.id JOIN users ON orders.user_id = users.id WHERE order_items.order_id = orders.id">
type _P19c = RequireTrue<AssertExtends<P_MultiJoin, SQLUpdateQuery>>

// ============================================================================
// WITH Clause (CTE) Tests
// ============================================================================

import type { CTEDefinition } from "../../src/common/ast.js"

// Test: WITH ... UPDATE
type P_WithUpdate = ParseUpdateSQL<"WITH inactive_users AS ( SELECT id FROM users WHERE active = FALSE ) UPDATE users SET status = 'archived' WHERE id IN ( SELECT id FROM inactive_users )">
type P_WithUpdate_Check = P_WithUpdate extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<any, any, any, any, any, CTEDefinition[]>
        ? true
        : false
    : false
type _P19d = RequireTrue<P_WithUpdate_Check>

// Test: WITH multiple CTEs
type P_MultiCTE = ParseUpdateSQL<"WITH old_orders AS ( SELECT id FROM orders WHERE created_at < '2024-01-01' ) , old_items AS ( SELECT order_id FROM order_items WHERE order_id IN ( SELECT id FROM old_orders ) ) UPDATE order_items SET archived = TRUE WHERE order_id IN ( SELECT order_id FROM old_items )">
type _P19e = RequireTrue<AssertExtends<P_MultiCTE, SQLUpdateQuery>>

// Test: WITH ... UPDATE ... FROM
type P_WithFrom = ParseUpdateSQL<"WITH recent_products AS ( SELECT id , price FROM products WHERE updated_at > '2024-01-01' ) UPDATE order_items SET price = rp.price FROM recent_products AS rp WHERE order_items.product_id = rp.id">
type _P19f = RequireTrue<AssertExtends<P_WithFrom, SQLUpdateQuery>>

// Test: WITH ... UPDATE ... RETURNING
type P_WithReturning = ParseUpdateSQL<"WITH target AS ( SELECT id FROM users WHERE email LIKE '%@test.com' ) UPDATE users SET verified = TRUE WHERE id IN ( SELECT id FROM target ) RETURNING id , email">
type _P19g = RequireTrue<AssertExtends<P_WithReturning, SQLUpdateQuery>>

// ============================================================================
// Combined Tests
// ============================================================================

// Test: Full UPDATE with all clauses
type P_Full = ParseUpdateSQL<`
    UPDATE users
    SET name = 'John' , email = 'john@example.com' , active = TRUE
    WHERE id = 1
    RETURNING id , name , email
`>
type _P20 = RequireTrue<AssertExtends<P_Full, SQLUpdateQuery>>

// Test: UPDATE via ParseSQL (router)
type P_ViaRouter = ParseSQL<"UPDATE users SET name = 'John' WHERE id = 1">
type _P21 = RequireTrue<AssertExtends<P_ViaRouter, SQLUpdateQuery>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Missing SET
type P_NoSet = ParseUpdateSQL<"UPDATE users WHERE id = 1">
type _P22 = RequireTrue<AssertIsParseError<P_NoSet>>

// Test: Empty query
type P_Empty = ParseUpdateSQL<"">
type _P23 = RequireTrue<AssertIsParseError<P_Empty>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are handled
type P_ExtraSpaces = ParseUpdateSQL<"UPDATE    users    SET    name = 'John'    WHERE    id = 1">
type _P24 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLUpdateQuery>>

// Test: Newlines are handled
type P_Newlines = ParseUpdateSQL<`
UPDATE users
SET name = 'John'
WHERE id = 1
RETURNING *
`>
type _P25 = RequireTrue<AssertExtends<P_Newlines, SQLUpdateQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseUpdateSQL<"update users set name = 'John' where id = 1">
type _P26 = RequireTrue<AssertExtends<P_Lowercase, SQLUpdateQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseUpdateSQL<"Update users Set name = 'John' Where id = 1">
type _P27 = RequireTrue<AssertExtends<P_MixedCase, SQLUpdateQuery>>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted table name
type P_QuotedTable = ParseUpdateSQL<'UPDATE "UserAccounts" SET name = \'John\' WHERE id = 1'>
type P_QuotedTable_Check = P_QuotedTable extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<TableRef<"UserAccounts", "UserAccounts", undefined>, any, any, any, any>
        ? true
        : false
    : false
type _P28 = RequireTrue<P_QuotedTable_Check>

// ============================================================================
// Table Alias Tests
// ============================================================================

// Test: UPDATE with table alias
type P_TableAlias = ParseUpdateSQL<"UPDATE users AS u SET name = 'John' WHERE u.id = 1">
type P_TableAlias_Check = P_TableAlias extends SQLUpdateQuery<infer Q>
    ? Q extends UpdateClause<TableRef<"users", "u", undefined>, any, any, any, any>
        ? true
        : false
    : false
type _P29 = RequireTrue<P_TableAlias_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type UpdateParserTestsPass = true

