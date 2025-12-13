/**
 * Validation Tests
 *
 * Tests for error detection, ValidateSQL, and ValidateQuery.
 * If this file compiles without errors, all tests pass.
 */

import type {
    MatchError,
    QueryResult,
    ValidateQuery,
    ValidateSQL,
} from "../../../src/index.js";
import type {
    AssertEqual,
    AssertExtends,
    AssertIsMatchError,
    AssertNotMatchError,
    RequireTrue,
} from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// Error Detection Tests
// ============================================================================

// Test: Unknown column produces error in result
type M_UnknownCol = QueryResult<"SELECT unknown_column FROM users", TestSchema>;
type M_UnknownCol_IsError = M_UnknownCol extends
    { unknown_column: MatchError<string>; } ? true : false;
type _M40 = RequireTrue<M_UnknownCol_IsError>;

// Test: Unknown table produces error
type M_UnknownTable = QueryResult<"SELECT * FROM unknown_table", TestSchema>;
type _M41 = RequireTrue<AssertIsMatchError<M_UnknownTable>>;

// Test: Wrong table qualifier produces error
type M_WrongQualifier = QueryResult<
    "SELECT wrong.id FROM users AS u",
    TestSchema
>;
type M_WrongQualifier_IsError = M_WrongQualifier extends
    { id: MatchError<string>; } ? true : false;
type _M42 = RequireTrue<M_WrongQualifier_IsError>;

// Test: Unknown schema produces error
type M_UnknownSchema = QueryResult<
    "SELECT * FROM nonexistent.users",
    TestSchema
>;
type _M43 = RequireTrue<AssertIsMatchError<M_UnknownSchema>>;

// ============================================================================
// ValidateSQL Tests
// ============================================================================

// Test: Valid query returns true
type V_Valid = ValidateSQL<"SELECT id, name FROM users", TestSchema>;
type _V1 = RequireTrue<AssertEqual<V_Valid, true>>;

// Test: Valid complex query returns true
type V_ValidComplex = ValidateSQL<
    `
SELECT u.name, p.title
FROM users AS u
INNER JOIN posts AS p ON u.id = p.author_id
WHERE u.is_active != TRUE and u.id < 10
ORDER BY p.views DESC
LIMIT 10
`,
    TestSchema
>;
type _V2 = RequireTrue<AssertEqual<V_ValidComplex, true>>;

// Test: Invalid column returns error string
type V_InvalidCol = ValidateSQL<"SELECT bad_column FROM users", TestSchema>;
type _V3 = RequireTrue<AssertExtends<V_InvalidCol, string>>;

// Test: Invalid table returns error string
type V_InvalidTable = ValidateSQL<"SELECT * FROM bad_table", TestSchema>;
type _V4 = RequireTrue<AssertExtends<V_InvalidTable, string>>;

// Test: Invalid table qualifier returns error
type V_InvalidQualifier = ValidateSQL<
    "SELECT wrong.id FROM users AS u",
    TestSchema
>;
type _V5 = RequireTrue<AssertExtends<V_InvalidQualifier, string>>;

// ============================================================================
// ValidateQuery Tests
// ============================================================================

// Test: ValidateQuery returns true for valid result
type VQ_Valid = ValidateQuery<{ id: number; name: string; }>;
type _VQ1 = RequireTrue<AssertEqual<VQ_Valid, true>>;

// Test: ValidateQuery detects error in result
type VQ_Invalid = ValidateQuery<{ id: MatchError<"Column not found">; }>;
type _VQ2 = RequireTrue<AssertExtends<VQ_Invalid, string>>;

// ============================================================================
// Edge Cases
// ============================================================================

// Test: Empty result object when no columns match
type M_NoMatch = QueryResult<"SELECT * FROM users WHERE 1 = 0", TestSchema>;
type _M45 = RequireTrue<AssertNotMatchError<M_NoMatch>>;

// Test: Select same column twice with different aliases
type M_SameColTwice = QueryResult<
    "SELECT id AS id1, id AS id2 FROM users",
    TestSchema
>;
type _M46 = RequireTrue<
    AssertEqual<M_SameColTwice, { id1: number; id2: number; }>
>;

// --- Test: Aggregation functions with type casts and dynamic field names
type AG1_Valid = ValidateSQL<
    `SELECT SUM(convert_currency(${string}, 'USD', 'GBP'))::float8 as "s" FROM users`,
    TestSchema
>;
type AG1_QueryResult = QueryResult<
    `SELECT SUM(convert_currency(${string}, 'USD', 'GBP') + convert_currency(${string}, 'USD', 'GBP'))::float8 as "s" FROM users`,
    TestSchema
>;
type _AG1 = RequireTrue<AssertEqual<AG1_Valid, true>>;
type _AG2 = RequireTrue<
    AssertEqual<AG1_QueryResult, { s: number; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type ValidationTestsPass = true;
