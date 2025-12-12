/**
 * Table Reference Parser Tests
 *
 * Tests for parsing table references including schemas and quoted identifiers.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    TableRef,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Table Reference Tests
// ============================================================================

// Test: Simple table reference
type P_SimpleTable = ParseSQL<"SELECT * FROM products">
type P_SimpleTable_Check = P_SimpleTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"products", "products", undefined> }
    ? true
    : false
    : false
type _P9 = RequireTrue<P_SimpleTable_Check>

// Test: Table with schema prefix
type P_SchemaTable = ParseSQL<"SELECT * FROM public.users">
type P_SchemaTable_Check = P_SchemaTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"users", "users", "public"> }
    ? true
    : false
    : false
type _P10 = RequireTrue<P_SchemaTable_Check>

// Test: Quoted table name
type P_QuotedTable = ParseSQL<'SELECT * FROM "UserAccounts"'>
type P_QuotedTable_Check = P_QuotedTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"UserAccounts", "UserAccounts", undefined> }
    ? true
    : false
    : false
type _P11 = RequireTrue<P_QuotedTable_Check>

// Test: Quoted table with schema
type P_QuotedSchemaTable = ParseSQL<'SELECT * FROM "mySchema"."MyTable"'>
type P_QuotedSchemaTable_Check = P_QuotedSchemaTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"MyTable", "MyTable", "mySchema"> }
    ? true
    : false
    : false
type _P12 = RequireTrue<P_QuotedSchemaTable_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type TableRefParserTestsPass = true
