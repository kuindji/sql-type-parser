/**
 * Normalization and Error Parser Tests
 *
 * Tests for whitespace handling, case insensitivity, and error cases.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
} from "../../../src/index.js"
import type { AssertExtends, RequireTrue, AssertIsParseError } from "../../helpers.js"

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Empty query returns error
type P_Empty = ParseSQL<"">
type _P58 = RequireTrue<AssertIsParseError<P_Empty>>

// Test: Missing FROM returns error
type P_NoFrom = ParseSQL<"SELECT id">
type _P59 = RequireTrue<AssertIsParseError<P_NoFrom>>

// Test: Invalid keyword start returns error
type P_InvalidStart = ParseSQL<"MERGE INTO users USING ...">
type _P60 = RequireTrue<AssertIsParseError<P_InvalidStart>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are normalized
type P_ExtraSpaces = ParseSQL<"SELECT    id   FROM    users">
type _P61 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLSelectQuery>>

// Test: Newlines are handled
type P_Newlines = ParseSQL<`
SELECT
    id,
    name
FROM
    users
`>
type _P62 = RequireTrue<AssertExtends<P_Newlines, SQLSelectQuery>>

// Test: Tabs are handled
type P_Tabs = ParseSQL<"SELECT\tid\tFROM\tusers">
type _P63 = RequireTrue<AssertExtends<P_Tabs, SQLSelectQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseSQL<"select id from users">
type _P64 = RequireTrue<AssertExtends<P_Lowercase, SQLSelectQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseSQL<"Select Id From Users Where Active = True">
type _P65 = RequireTrue<AssertExtends<P_MixedCase, SQLSelectQuery>>

// ============================================================================
// Export for verification
// ============================================================================

export type NormalizationParserTestsPass = true
