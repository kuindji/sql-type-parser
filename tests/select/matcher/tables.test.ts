/**
 * Table-related Tests
 *
 * Tests for table aliases, JOINs, table wildcards, and multi-schema queries.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type {
    AssertEqual,
    AssertExtends,
    RequireTrue,
} from "../../helpers.js";
import type { CamelCaseTestSchema, TestSchema } from "./schemas.js";

// ============================================================================
// Table Alias Tests
// ============================================================================

// Test: Table alias with qualified columns
type M_TableAlias = QueryResult<
    "SELECT u.id, u.name FROM users AS u",
    TestSchema
>;
type _M14 = RequireTrue<
    AssertEqual<M_TableAlias, { id: number; name: string; }>
>;

// Test: Table alias with simple columns
type M_TableAliasSimple = QueryResult<
    "SELECT id, name FROM users AS u",
    TestSchema
>;
type _M15 = RequireTrue<
    AssertEqual<M_TableAliasSimple, { id: number; name: string; }>
>;

// ============================================================================
// JOIN Tests
// ============================================================================

// Test: INNER JOIN merges columns
type M_Join = QueryResult<
    "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id != p.author_id",
    TestSchema
>;
type _M16 = RequireTrue<AssertEqual<M_Join, { name: string; title: string; }>>;

// Test: LEFT JOIN - joined table columns are nullable
type M_LeftJoin = QueryResult<
    "SELECT u.name, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>;
type _M17 = RequireTrue<
    AssertEqual<M_LeftJoin, { name: string; title: string | null; }>
>;

// Test: Multiple JOINs
type M_MultiJoin = QueryResult<
    `
SELECT u.name, p.title, c.content
FROM users AS u
INNER JOIN posts AS p ON u.id = p.author_id
INNER JOIN comments AS c ON p.id = c.post_id
`,
    TestSchema
>;
type _M18 = RequireTrue<
    AssertEqual<M_MultiJoin, { name: string; title: string; content: string; }>
>;

// ============================================================================
// Table Wildcard Tests
// ============================================================================

// Test: table.* expands to all columns
type M_TableWildcard = QueryResult<"SELECT u.* FROM users AS u", TestSchema>;
type _M25 = RequireTrue<
    AssertExtends<
        M_TableWildcard,
        {
            id: number;
            name: string;
            email: string;
        }
    >
>;

// Test: table.* with join
type M_WildcardJoin = QueryResult<
    "SELECT u.*, posts.title FROM users AS u INNER JOIN posts ON u.id = posts.author_id",
    TestSchema
>;
type _M26 = RequireTrue<
    AssertExtends<
        M_WildcardJoin,
        {
            id: number;
            name: string;
            title: string;
        }
    >
>;

// ============================================================================
// Multi-Schema Tests
// ============================================================================

// Test: Query from default schema (implicit)
type M_DefaultSchema = QueryResult<"SELECT id, name FROM users", TestSchema>;
type _M34 = RequireTrue<
    AssertEqual<M_DefaultSchema, { id: number; name: string; }>
>;

// Test: Query with explicit schema prefix
type M_ExplicitSchema = QueryResult<
    "SELECT id, action FROM audit.logs",
    TestSchema
>;
type _M35 = RequireTrue<
    AssertEqual<M_ExplicitSchema, { id: number; action: string; }>
>;

// Test: Cross-schema query with alias
type M_CrossSchema = QueryResult<
    "SELECT u.name, l.action FROM users AS u INNER JOIN audit.logs AS l ON u.id = l.user_id",
    TestSchema
>;
type _M36 = RequireTrue<
    AssertEqual<M_CrossSchema, { name: string; action: string; }>
>;

// ============================================================================
// camelCase Identifier Tests
// ============================================================================

// Test: camelCase column names
type M_CamelCol = QueryResult<
    'SELECT "firstName", "lastName" FROM "userAccounts"',
    CamelCaseTestSchema
>;
type _M37 = RequireTrue<
    AssertEqual<M_CamelCol, { firstName: string; lastName: string; }>
>;

// Test: camelCase table with alias
type M_CamelAlias = QueryResult<
    'SELECT ua."firstName", ua."emailAddress" FROM "userAccounts" AS ua',
    CamelCaseTestSchema
>;
type _M38 = RequireTrue<
    AssertEqual<M_CamelAlias, { firstName: string; emailAddress: string; }>
>;

// Test: camelCase join
type M_CamelJoin = QueryResult<
    `
SELECT ua."firstName", oi."unitPrice"
FROM "userAccounts" AS ua
INNER JOIN "orderItems" AS oi ON ua.id = oi."orderId"
`,
    CamelCaseTestSchema
>;
type _M39 = RequireTrue<
    AssertEqual<M_CamelJoin, { firstName: string; unitPrice: number; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type TablesTestsPass = true;
