/**
 * Clause Validation Tests
 *
 * Tests for JOIN, WHERE, ORDER BY, GROUP BY, and HAVING clause validation.
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// JOIN Validation Tests
// ============================================================================

// Test: Valid INNER JOIN returns true
type V_InnerJoin = ValidateSelectSQL<
    "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>;
type _V5 = RequireTrue<AssertEqual<V_InnerJoin, true>>;

// Test: Valid LEFT JOIN returns true
type V_LeftJoin = ValidateSelectSQL<
    "SELECT u.name, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>;
type _V6 = RequireTrue<AssertEqual<V_LeftJoin, true>>;

// Test: Valid multiple JOINs returns true
type V_MultiJoin = ValidateSelectSQL<
    `
SELECT u.name, p.title, c.content
FROM users AS u
INNER JOIN posts AS p ON u.id = p.author_id
INNER JOIN comments AS c ON p.id = c.post_id
`,
    TestSchema
>;
type _V7 = RequireTrue<AssertEqual<V_MultiJoin, true>>;

// Test: Invalid JOIN ON column returns error
type V_InvalidJoinOn = ValidateSelectSQL<
    "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
    TestSchema
>;
type _V8 = RequireTrue<AssertExtends<V_InvalidJoinOn, string>>;

// ============================================================================
// WHERE Clause Validation Tests
// ============================================================================

// Test: Valid WHERE clause returns true
type V_Where = ValidateSelectSQL<
    "SELECT id FROM users WHERE is_active = TRUE",
    TestSchema
>;
type _V9 = RequireTrue<AssertEqual<V_Where, true>>;

// Test: Valid WHERE with table qualifier returns true
type V_WhereQualified = ValidateSelectSQL<
    "SELECT u.id FROM users AS u WHERE u.is_active = TRUE",
    TestSchema
>;
type _V10 = RequireTrue<AssertEqual<V_WhereQualified, true>>;

// Test: Invalid WHERE column returns error
type V_InvalidWhere = ValidateSelectSQL<
    "SELECT id FROM users WHERE bad_column = 1",
    TestSchema
>;
type _V11 = RequireTrue<AssertExtends<V_InvalidWhere, string>>;

// Test: Invalid WHERE column with full validation enabled
type V_InvalidWhereFullValidation = ValidateSelectSQL<
    "SELECT id FROM users WHERE bad_column = 1",
    TestSchema,
    { validateAllFields: true; }
>;
type _V12 = RequireTrue<AssertExtends<V_InvalidWhereFullValidation, string>>;

// ============================================================================
// ORDER BY Validation Tests
// ============================================================================

// Test: Valid ORDER BY returns true
type V_OrderBy = ValidateSelectSQL<
    "SELECT id FROM users ORDER BY name",
    TestSchema
>;
type _V13 = RequireTrue<AssertEqual<V_OrderBy, true>>;

// Test: Valid ORDER BY with direction returns true
type V_OrderByDesc = ValidateSelectSQL<
    "SELECT id FROM users ORDER BY created_at DESC",
    TestSchema
>;
type _V14 = RequireTrue<AssertEqual<V_OrderByDesc, true>>;

// Test: Invalid ORDER BY column returns error
type V_InvalidOrderBy = ValidateSelectSQL<
    "SELECT id FROM users ORDER BY bad_column",
    TestSchema
>;
type _V15 = RequireTrue<AssertExtends<V_InvalidOrderBy, string>>;

// ============================================================================
// GROUP BY Validation Tests
// ============================================================================

// Test: Valid GROUP BY returns true
type V_GroupBy = ValidateSelectSQL<
    "SELECT role, COUNT ( * ) AS total FROM users GROUP BY role",
    TestSchema
>;
type _V16 = RequireTrue<AssertEqual<V_GroupBy, true>>;

// Test: Invalid GROUP BY column returns error
type V_InvalidGroupBy = ValidateSelectSQL<
    "SELECT id FROM users GROUP BY bad_column",
    TestSchema
>;
type _V17 = RequireTrue<AssertExtends<V_InvalidGroupBy, string>>;

// ============================================================================
// HAVING Validation Tests
// ============================================================================

// Test: Valid HAVING returns true
type V_Having = ValidateSelectSQL<
    "SELECT author_id, COUNT ( * ) AS cnt FROM posts GROUP BY author_id HAVING author_id > 0",
    TestSchema
>;
type _V18 = RequireTrue<AssertEqual<V_Having, true>>;

// Test: Invalid HAVING column returns error
type V_InvalidHaving = ValidateSelectSQL<
    "SELECT author_id FROM posts GROUP BY author_id HAVING bad_column > 0",
    TestSchema
>;
type _V19 = RequireTrue<AssertExtends<V_InvalidHaving, string>>;

// ============================================================================
// Export for verification
// ============================================================================

export type ClausesValidatorTestsPass = true;
