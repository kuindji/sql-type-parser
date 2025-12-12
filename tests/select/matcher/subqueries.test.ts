/**
 * Subquery Tests
 *
 * Tests for CTEs and derived tables.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// CTE Tests
// ============================================================================

// Test: CTE columns accessible
type M_CTE = QueryResult<
    `
WITH active_users AS (
  SELECT id, name FROM users WHERE is_active = TRUE
)
SELECT id, name FROM active_users
`,
    TestSchema
>;
type _M27 = RequireTrue<AssertEqual<M_CTE, { id: number; name: string; }>>;

// Test: CTE with JOIN
type M_CTEJoin = QueryResult<
    `
WITH authors AS (
  SELECT DISTINCT author_id FROM posts
)
SELECT u.name
FROM authors AS a
INNER JOIN users AS u ON a.author_id = u.id
`,
    TestSchema
>;
type _M28 = RequireTrue<AssertEqual<M_CTEJoin, { name: string; }>>;

// ============================================================================
// Derived Table Tests
// ============================================================================

// Test: Derived table columns accessible
type M_Derived = QueryResult<
    `
SELECT sub.total
FROM ( SELECT COUNT ( * ) AS total FROM users ) AS sub
`,
    TestSchema
>;
type _M29 = RequireTrue<AssertEqual<M_Derived, { total: number; }>>;

// Test: Derived table with multiple columns
type M_DerivedMulti = QueryResult<
    `
SELECT sub.cnt, sub.avg_views
FROM ( SELECT COUNT ( * ) AS cnt, AVG ( views ) AS avg_views FROM posts ) AS sub
`,
    TestSchema
>;
type _M30 = RequireTrue<
    AssertEqual<M_DerivedMulti, { cnt: number; avg_views: number; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type SubqueriesTestsPass = true;
