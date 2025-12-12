/**
 * Identifier Parser Tests
 *
 * Tests for parsing quoted identifiers and three-part identifiers.
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
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted column names
type P_QuotedCol = ParseSQL<'SELECT "firstName", "lastName" FROM users'>
type P_QuotedCol_Check = P_QuotedCol extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [
            ColumnRef<UnboundColumnRef<"firstName">, "firstName">,
            ColumnRef<UnboundColumnRef<"lastName">, "lastName">,
        ]
    }
    ? true
    : false
    : false
type _P53 = RequireTrue<P_QuotedCol_Check>

// Test: Quoted table and column
type P_QuotedBoth = ParseSQL<'SELECT u."firstName" FROM "Users" AS u'>
type P_QuotedBoth_Check = P_QuotedBoth extends SQLSelectQuery<infer Q>
    ? Q extends {
        from: TableRef<"Users", "u", undefined>
        columns: [ColumnRef<TableColumnRef<"u", "firstName", undefined>, "firstName">]
    }
    ? true
    : false
    : false
type _P54 = RequireTrue<P_QuotedBoth_Check>

// ============================================================================
// Three-part Identifier Tests
// ============================================================================

// Test: schema.table.column
type P_ThreePart = ParseSQL<"SELECT public.users.id FROM public.users">
type P_ThreePart_Check = P_ThreePart extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<TableColumnRef<"users", "id", "public">, "id">] }
    ? true
    : false
    : false
type _P55 = RequireTrue<P_ThreePart_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type IdentifiersParserTestsPass = true
