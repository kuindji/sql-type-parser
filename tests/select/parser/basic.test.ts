/**
 * Basic SELECT and DISTINCT Parser Tests
 *
 * Tests for basic SELECT parsing and DISTINCT functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    ColumnRef,
    TableRef,
    UnboundColumnRef,
    TableColumnRef,
} from "../../../src/index.js"
import type { AssertExtends, RequireTrue } from "../../helpers.js"

// ============================================================================
// Basic SELECT Tests
// ============================================================================

// Test: SELECT * FROM table
type P_SelectAll = ParseSQL<"SELECT * FROM users">
type _P1 = RequireTrue<AssertExtends<P_SelectAll, SQLSelectQuery>>

// Test: SELECT * has columns: "*"
type P_SelectAll_Columns = P_SelectAll extends SQLSelectQuery<infer Q>
    ? Q extends { columns: "*" }
    ? true
    : false
    : false
type _P1a = RequireTrue<P_SelectAll_Columns>

// Test: Single column SELECT
type P_SingleCol = ParseSQL<"SELECT id FROM users">
type _P2 = RequireTrue<AssertExtends<P_SingleCol, SQLSelectQuery>>

// Test: Multiple columns SELECT
type P_MultiCol = ParseSQL<"SELECT id, name, email FROM users">
type P_MultiCol_Columns = P_MultiCol extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef, ColumnRef, ColumnRef] }
    ? true
    : false
    : false
type _P3 = RequireTrue<P_MultiCol_Columns>

// Test: SELECT with column alias (AS)
type P_ColAlias = ParseSQL<"SELECT id AS user_id FROM users">
type P_ColAlias_Check = P_ColAlias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<UnboundColumnRef<"id">, "user_id">] }
    ? true
    : false
    : false
type _P4 = RequireTrue<P_ColAlias_Check>

// Test: SELECT with table alias
type P_TableAlias = ParseSQL<"SELECT u.id FROM users AS u">
type P_TableAlias_Check = P_TableAlias extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"users", "u", undefined> }
    ? true
    : false
    : false
type _P5 = RequireTrue<P_TableAlias_Check>

// Test: SELECT with table.column reference
type P_TableCol = ParseSQL<"SELECT u.id FROM users AS u">
type P_TableCol_Check = P_TableCol extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<TableColumnRef<"u", "id", undefined>, "id">] }
    ? true
    : false
    : false
type _P6 = RequireTrue<P_TableCol_Check>

// ============================================================================
// DISTINCT Tests
// ============================================================================

// Test: DISTINCT sets distinct: true
type P_Distinct = ParseSQL<"SELECT DISTINCT role FROM users">
type P_Distinct_Check = P_Distinct extends SQLSelectQuery<infer Q>
    ? Q extends { distinct: true }
    ? true
    : false
    : false
type _P7 = RequireTrue<P_Distinct_Check>

// Test: Without DISTINCT has distinct: false
type P_NoDistinct = ParseSQL<"SELECT role FROM users">
type P_NoDistinct_Check = P_NoDistinct extends SQLSelectQuery<infer Q>
    ? Q extends { distinct: false }
    ? true
    : false
    : false
type _P8 = RequireTrue<P_NoDistinct_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type BasicParserTestsPass = true
