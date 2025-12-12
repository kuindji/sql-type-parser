/**
 * Complex Query Validation Tests
 *
 * Tests for complex queries, error cases, UNION, DISTINCT, and LIMIT/OFFSET.
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// Complex Query Validation Tests
// ============================================================================

// Test: Valid complex query with all clauses returns true
type V_Complex = ValidateSelectSQL<
    `
SELECT u.name, p.title
FROM users AS u
INNER JOIN posts AS p ON u.id = p.author_id
WHERE u.is_active = TRUE
GROUP BY u.name, p.title
HAVING u.name IS NOT NULL
ORDER BY p.title
LIMIT 10
`,
    TestSchema
>;
type _V38 = RequireTrue<AssertEqual<V_Complex, true>>;

// Test: Full complex query with CTE returns true
type V_FullComplex = ValidateSelectSQL<
    `
WITH user_stats AS (
  SELECT author_id, COUNT ( * ) AS post_count, SUM ( views ) AS total_views
  FROM posts
  WHERE status = 'published'
  GROUP BY author_id
)
SELECT
  u.id,
  u.name,
  u.email,
  us.post_count,
  us.total_views
FROM users AS u
LEFT JOIN user_stats AS us ON u.id = us.author_id
WHERE u.is_active = TRUE
ORDER BY us.total_views DESC
LIMIT 100
`,
    TestSchema
>;
type _V39 = RequireTrue<AssertEqual<V_FullComplex, true>>;

// ============================================================================
// Error Case Tests
// ============================================================================

// Test: Unknown table returns error
type V_UnknownTable = ValidateSelectSQL<
    "SELECT * FROM unknown_table",
    TestSchema
>;
type _V40 = RequireTrue<AssertExtends<V_UnknownTable, string>>;

// Test: Unknown column returns error
type V_UnknownColumn = ValidateSelectSQL<
    "SELECT unknown_col FROM users",
    TestSchema
>;
type _V41 = RequireTrue<AssertExtends<V_UnknownColumn, string>>;

// Test: Wrong table qualifier returns error
type V_WrongQualifier = ValidateSelectSQL<
    "SELECT wrong.id FROM users AS u",
    TestSchema
>;
type _V42 = RequireTrue<AssertExtends<V_WrongQualifier, string>>;

// ============================================================================
// UNION Validation Tests
// ============================================================================

// Test: Valid UNION returns true
type V_Union = ValidateSelectSQL<
    "SELECT id, name FROM users UNION SELECT id, title AS name FROM posts",
    TestSchema
>;
type _V43 = RequireTrue<AssertEqual<V_Union, true>>;

// Test: Valid UNION ALL returns true
type V_UnionAll = ValidateSelectSQL<
    "SELECT id, name FROM users UNION ALL SELECT id, title AS name FROM posts",
    TestSchema
>;
type _V44 = RequireTrue<AssertEqual<V_UnionAll, true>>;

// ============================================================================
// DISTINCT Validation Tests
// ============================================================================

// Test: Valid DISTINCT returns true
type V_Distinct = ValidateSelectSQL<
    "SELECT DISTINCT role FROM users",
    TestSchema
>;
type _V45 = RequireTrue<AssertEqual<V_Distinct, true>>;

// ============================================================================
// LIMIT/OFFSET Validation Tests
// ============================================================================

// Test: Valid LIMIT returns true
type V_Limit = ValidateSelectSQL<"SELECT id FROM users LIMIT 10", TestSchema>;
type _V46 = RequireTrue<AssertEqual<V_Limit, true>>;

// Test: Valid LIMIT OFFSET returns true
type V_LimitOffset = ValidateSelectSQL<
    "SELECT id FROM users LIMIT 10 OFFSET 20",
    TestSchema
>;
type _V47 = RequireTrue<AssertEqual<V_LimitOffset, true>>;

// ============================================================================
// Export for verification
// ============================================================================

export type ComplexValidatorTestsPass = true;
