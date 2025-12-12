/**
 * EXISTS and NOT EXISTS Tests
 *
 * Tests for EXISTS expressions in SELECT and WHERE clauses.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// EXISTS and NOT EXISTS in SELECT Tests
// ============================================================================

// Test: EXISTS returns boolean
type M_Exists = QueryResult<
    "SELECT EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AS has_posts FROM users",
    TestSchema
>;
type _EX1 = RequireTrue<AssertEqual<M_Exists, { has_posts: boolean; }>>;

// Test: NOT EXISTS returns boolean
type M_NotExists = QueryResult<
    "SELECT NOT EXISTS ( SELECT 1 FROM comments WHERE user_id = users.id ) AS no_comments FROM users",
    TestSchema
>;
type _EX2 = RequireTrue<AssertEqual<M_NotExists, { no_comments: boolean; }>>;

// Test: EXISTS without alias defaults to "exists"
type M_ExistsNoAlias = QueryResult<
    "SELECT EXISTS ( SELECT 1 FROM posts ) FROM users",
    TestSchema
>;
type _EX3 = RequireTrue<AssertEqual<M_ExistsNoAlias, { exists: boolean; }>>;

// Test: EXISTS mixed with other columns
type M_ExistsMixed = QueryResult<
    "SELECT id, name, EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AS has_posts FROM users",
    TestSchema
>;
type _EX4 = RequireTrue<
    AssertEqual<
        M_ExistsMixed,
        { id: number; name: string; has_posts: boolean; }
    >
>;

// Test: Multiple EXISTS in same query
type M_MultiExists = QueryResult<
    "SELECT EXISTS ( SELECT 1 FROM posts ) AS has_posts, NOT EXISTS ( SELECT 1 FROM comments ) AS no_comments FROM users",
    TestSchema
>;
type _EX5 = RequireTrue<
    AssertEqual<M_MultiExists, { has_posts: boolean; no_comments: boolean; }>
>;

// Test: EXISTS with complex subquery
type M_ExistsComplex = QueryResult<
    "SELECT EXISTS ( SELECT id FROM posts WHERE status = 'published' AND author_id = users.id ) AS has_published FROM users",
    TestSchema
>;
type _EX6 = RequireTrue<
    AssertEqual<M_ExistsComplex, { has_published: boolean; }>
>;

// ============================================================================
// EXISTS in WHERE Clause Tests
// ============================================================================

// Test: EXISTS in WHERE clause - should not cause validation errors
type M_ExistsInWhere = QueryResult<
    "SELECT id, name FROM users WHERE EXISTS ( SELECT 1 FROM posts WHERE posts.author_id = users.id )",
    TestSchema
>;
type _EXW1 = RequireTrue<
    AssertEqual<M_ExistsInWhere, { id: number; name: string; }>
>;

// Test: NOT EXISTS in WHERE clause
type M_NotExistsInWhere = QueryResult<
    "SELECT id, name FROM users WHERE NOT EXISTS ( SELECT 1 FROM comments WHERE comments.user_id = users.id )",
    TestSchema
>;
type _EXW2 = RequireTrue<
    AssertEqual<M_NotExistsInWhere, { id: number; name: string; }>
>;

// Test: EXISTS in WHERE with additional conditions
type M_ExistsWithAnd = QueryResult<
    "SELECT id, name FROM users WHERE is_active = TRUE AND EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id )",
    TestSchema
>;
type _EXW3 = RequireTrue<
    AssertEqual<M_ExistsWithAnd, { id: number; name: string; }>
>;

// Test: Multiple EXISTS in WHERE clause
type M_MultiExistsWhere = QueryResult<
    `SELECT id FROM users WHERE id > 10 and not EXISTS ( SELECT 1 FROM "posts" WHERE author_id = users.id ) AND NOT EXISTS ( SELECT 1 FROM comments WHERE user_id = users.id )`,
    TestSchema
>;
type _EXW4 = RequireTrue<AssertEqual<M_MultiExistsWhere, { id: number; }>>;

// Test: EXISTS with nested subquery in WHERE
type M_NestedExistsWhere = QueryResult<
    "SELECT id FROM users WHERE EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id AND views > 100 )",
    TestSchema
>;
type _EXW5 = RequireTrue<AssertEqual<M_NestedExistsWhere, { id: number; }>>;

// ============================================================================
// Export for verification
// ============================================================================

export type ExistsTestsPass = true;
