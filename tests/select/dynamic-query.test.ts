/**
 * Dynamic Query Tests
 * 
 * Tests for queries with dynamic parts (template literal interpolations)
 * that can't be validated at compile time.
 * 
 * These tests verify that:
 * 1. Generic `string` type queries don't cause compile errors
 * 2. Generic `string` type queries return DynamicQueryResult (Record<string, unknown>)
 * 3. Validation passes (returns true) for generic `string` type queries
 * 
 * Note: Template literal types like `SELECT * FROM ${string}` are still specific
 * types in TypeScript (not equivalent to `string`), so they go through normal parsing.
 * The dynamic query handling specifically targets the exact `string` type.
 */

import type {
    ParseSQL,
    QueryResult,
    ValidateSQL,
    DynamicQuery,
    DynamicQueryResult,
    IsStringLiteral,
} from "../../src/index.js"
import type { BlogSchema } from "../../examples/schema.js"
import type { AssertEqual, AssertExtends, RequireTrue } from "../helpers.js"

// ============================================================================
// IsStringLiteral Detection Tests
// ============================================================================

// Test: Literal string is detected as literal
type Test_LiteralIsLiteral = IsStringLiteral<"SELECT * FROM users">
type _L1 = RequireTrue<AssertEqual<Test_LiteralIsLiteral, true>>

// Test: Generic string type is not a literal
type Test_StringIsNotLiteral = IsStringLiteral<string>
type _L2 = RequireTrue<AssertEqual<Test_StringIsNotLiteral, false>>

// Note: Template literal types like `SELECT * FROM ${string}` ARE considered
// specific types by TypeScript (not the same as plain `string`), so IsStringLiteral
// returns true for them. This is correct TypeScript behavior.

// ============================================================================
// ParseSQL with Dynamic Queries
// ============================================================================

// Test: Parsing a generic string returns DynamicQuery
type Test_ParseDynamicString = ParseSQL<string>
type _P1 = RequireTrue<AssertExtends<Test_ParseDynamicString, DynamicQuery>>

// Test: Parsing a literal string still works
type Test_ParseLiteralString = ParseSQL<"SELECT * FROM users">
type _P2 = RequireTrue<AssertExtends<Test_ParseLiteralString, { type: "SQLQuery"; queryType: "SELECT" }>>

// ============================================================================
// QueryResult with Dynamic Queries
// ============================================================================

// Test: QueryResult for generic string returns DynamicQueryResult
type Test_QueryResultDynamic = QueryResult<string, BlogSchema>
type _Q1 = RequireTrue<AssertEqual<Test_QueryResultDynamic, DynamicQueryResult>>

// Test: QueryResult for literal string still works
type Test_QueryResultLiteral = QueryResult<"SELECT id, name FROM users", BlogSchema>
type _Q2 = RequireTrue<AssertEqual<Test_QueryResultLiteral, { id: number; name: string }>>

// Test: DynamicQueryResult is Record<string, unknown>
type _Q3 = RequireTrue<AssertEqual<DynamicQueryResult, Record<string, unknown>>>

const queryPart = "WHERE id = 1";
const query = `SELECT id FROM users ${queryPart}` as const;
type Test_QueryResultDynamic2 = QueryResult<typeof query, BlogSchema>
type _Q4 = RequireTrue<AssertEqual<Test_QueryResultDynamic2, { id: number }>>

// ============================================================================
// ValidateSQL with Dynamic Queries
// ============================================================================

// Test: Validation passes for generic string queries (returns true)
type Test_ValidateDynamic = ValidateSQL<string, BlogSchema>
type _V1 = RequireTrue<AssertEqual<Test_ValidateDynamic, true>>

// Test: Validation still works for literal queries
type Test_ValidateLiteralValid = ValidateSQL<"SELECT id FROM users", BlogSchema>
type _V2 = RequireTrue<AssertEqual<Test_ValidateLiteralValid, true>>

// Test: Validation still catches errors in literal queries
type Test_ValidateLiteralInvalid = ValidateSQL<"SELECT bad_col FROM users", BlogSchema>
type _V3 = RequireTrue<AssertExtends<Test_ValidateLiteralInvalid, string>>

type Test_ValidateDynamic2 = ValidateSQL<typeof query, BlogSchema>
type _V4 = RequireTrue<AssertEqual<Test_ValidateDynamic2, true>>
// ============================================================================
// Real-world Usage Pattern
// ============================================================================

/**
 * The primary use case for dynamic query support:
 * When the query parameter type is exactly `string` (not a literal),
 * the parser/matcher returns a permissive type instead of failing.
 * 
 * This happens when:
 * 1. A function accepts `query: string` parameter
 * 2. A variable is typed as `string` (not inferred from literal)
 * 3. Query comes from external source (config, database, etc.)
 * 
 * @example
 * ```typescript
 * function executeQuery(query: string) {
 *   // query is `string`, not a literal, so:
 *   // - ParseSQL<typeof query> returns DynamicQuery
 *   // - QueryResult<typeof query, Schema> returns Record<string, unknown>
 *   // - ValidateSQL<typeof query, Schema> returns true (bypasses validation)
 * }
 * ```
 */

// ============================================================================
// Export for verification
// ============================================================================

/**
 * If this file compiles without errors, all dynamic query tests pass!
 */
export type DynamicQueryTestsPass = true

