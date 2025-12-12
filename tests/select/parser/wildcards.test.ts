/**
 * Table Wildcard Parser Tests
 *
 * Tests for parsing table wildcards (table.*, schema.table.*).
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    TableWildcard,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Table Wildcard Tests
// ============================================================================

// Test: table.*
type P_TableWildcard = ParseSQL<"SELECT u.* FROM users AS u">
type P_TableWildcard_Check = P_TableWildcard extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [TableWildcard<"u", undefined>] }
    ? true
    : false
    : false
type _P44 = RequireTrue<P_TableWildcard_Check>

// Test: schema.table.*
type P_SchemaTableWildcard = ParseSQL<"SELECT public.users.* FROM public.users">
type P_SchemaTableWildcard_Check = P_SchemaTableWildcard extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [TableWildcard<"users", "public">] }
    ? true
    : false
    : false
type _P45 = RequireTrue<P_SchemaTableWildcard_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type WildcardsParserTestsPass = true
