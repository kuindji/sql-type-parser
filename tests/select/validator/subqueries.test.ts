/**
 * Subquery Validation Tests
 *
 * Tests for CTE, derived tables, and EXISTS/NOT EXISTS validation.
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// CTE Validation Tests
// ============================================================================

// Test: Valid CTE returns true
type V_CTE = ValidateSelectSQL<
    `
WITH active_users AS (
  SELECT id, name FROM users WHERE is_active = TRUE
)
SELECT id, name FROM active_users
`,
    TestSchema
>;
type _V26 = RequireTrue<AssertEqual<V_CTE, true>>;

// Test: Valid multiple CTEs returns true
type V_MultiCTE = ValidateSelectSQL<
    `
WITH
  cte1 AS ( SELECT id, author_id FROM posts ),
  cte2 AS ( SELECT id, name FROM users )
SELECT c1.id, c2.name
FROM cte1 AS c1
INNER JOIN cte2 AS c2 ON c1.author_id = c2.id
`,
    TestSchema
>;
type _V27 = RequireTrue<AssertEqual<V_MultiCTE, true>>;

// ============================================================================
// Derived Table Validation Tests
// ============================================================================

// Test: Valid derived table returns true
type V_Derived = ValidateSelectSQL<
    `
SELECT sub.total
FROM ( SELECT COUNT ( * ) AS total FROM users ) AS sub
`,
    TestSchema
>;
type _V28 = RequireTrue<AssertEqual<V_Derived, true>>;

// ============================================================================
// EXISTS/NOT EXISTS Validation Tests
// ============================================================================

// Test: EXISTS in SELECT validates successfully
type V_ExistsSelect = ValidateSelectSQL<
    "SELECT EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AS has_posts FROM users",
    TestSchema
>;
type _V54 = RequireTrue<AssertEqual<V_ExistsSelect, true>>;

// Test: NOT EXISTS in SELECT validates successfully
type V_NotExistsSelect = ValidateSelectSQL<
    "SELECT NOT EXISTS ( SELECT 1 FROM comments WHERE user_id = users.id ) AS no_comments FROM users",
    TestSchema
>;
type _V55 = RequireTrue<AssertEqual<V_NotExistsSelect, true>>;

// Test: EXISTS in WHERE clause validates successfully
type V_ExistsWhere = ValidateSelectSQL<
    "SELECT id, name FROM users WHERE EXISTS ( SELECT 1 FROM posts WHERE posts.author_id = users.id )",
    TestSchema
>;
type _V56 = RequireTrue<AssertEqual<V_ExistsWhere, true>>;

// Test: NOT EXISTS in WHERE clause validates successfully
type V_NotExistsWhere = ValidateSelectSQL<
    "SELECT id, name FROM users WHERE NOT EXISTS ( SELECT 1 FROM comments WHERE comments.user_id = users.id )",
    TestSchema
>;
type _V57 = RequireTrue<AssertEqual<V_NotExistsWhere, true>>;

// Test: EXISTS in WHERE with additional conditions validates successfully
type V_ExistsWhereAnd = ValidateSelectSQL<
    "SELECT id, name FROM users WHERE is_active = TRUE AND EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id )",
    TestSchema
>;
type _V58 = RequireTrue<AssertEqual<V_ExistsWhereAnd, true>>;

// Test: Multiple EXISTS in WHERE validates successfully
type V_MultiExistsWhere = ValidateSelectSQL<
    "SELECT id FROM users WHERE EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AND NOT EXISTS ( SELECT 1 FROM comments WHERE user_id = users.id )",
    TestSchema
>;
type _V59 = RequireTrue<AssertEqual<V_MultiExistsWhere, true>>;

type V_MultiExistsWhere_1 = ValidateSelectSQL<
    `SELECT u.id FROM users u
      WHERE
      u.id > $1
      and exists ( SELECT 1 FROM posts WHERE author_id = u.id )
      and not exists (
        select 1 from "comments" c WHERE c.user_id = u.id
      )`,
    TestSchema
>;
type _V59_1 = RequireTrue<AssertEqual<V_MultiExistsWhere, true>>;

// Test: EXISTS mixed with regular columns validates successfully
type V_ExistsMixed = ValidateSelectSQL<
    "SELECT id, name, EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AS has_posts FROM users",
    TestSchema
>;
type _V60 = RequireTrue<AssertEqual<V_ExistsMixed, true>>;

// ============================================================================
// Export for verification
// ============================================================================

export type SubqueriesValidatorTestsPass = true;
