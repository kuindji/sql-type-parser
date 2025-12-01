/**
 * Matcher Type Tests
 *
 * Tests for QueryResult, ValidateSQL, MatchError and schema matching.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult, ValidateSQL, MatchError, DatabaseSchema } from "../src/index.js"
import type { ValidQuery } from "../src/db.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsMatchError, AssertNotMatchError, IsNever } from "./helpers.js"

// ============================================================================
// Test Schemas
// ============================================================================

type TestSchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            users: {
                id: number
                name: string
                email: string
                role: "admin" | "user" | "guest"
                is_active: boolean
                created_at: string
                deleted_at: string | null
            }
            posts: {
                id: number
                author_id: number
                title: string
                content: string
                views: number
                status: "draft" | "published"
                published_at: string | null
            }
            comments: {
                id: number
                post_id: number
                user_id: number
                content: string
                created_at: string
            }
        }
        audit: {
            logs: {
                id: number
                user_id: number | null
                action: string
                created_at: string
            }
        }
    }
}

type CamelCaseTestSchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            userAccounts: {
                id: number
                firstName: string
                lastName: string
                emailAddress: string
            }
            orderItems: {
                id: number
                orderId: number
                unitPrice: number
            }
        }
    }
}

// ============================================================================
// Basic Column Type Inference Tests
// ============================================================================

// Test: Single column returns correct type
type M_SingleCol = QueryResult<"SELECT id FROM users", TestSchema>
type _M1 = RequireTrue<AssertEqual<M_SingleCol, { id: number }>>

// Test: Multiple columns return correct types
type M_MultiCol = QueryResult<"SELECT id, name, email FROM users", TestSchema>
type _M2 = RequireTrue<AssertEqual<M_MultiCol, { id: number; name: string; email: string }>>

// Test: String column
type M_StringCol = QueryResult<"SELECT name FROM users", TestSchema>
type _M3 = RequireTrue<AssertEqual<M_StringCol, { name: string }>>

// Test: Boolean column
type M_BoolCol = QueryResult<"SELECT is_active FROM users", TestSchema>
type _M4 = RequireTrue<AssertEqual<M_BoolCol, { is_active: boolean }>>

// ============================================================================
// SELECT * Tests
// ============================================================================

// Test: SELECT * returns all columns
type M_Star = QueryResult<"SELECT * FROM users", TestSchema>
type _M5 = RequireTrue<
    AssertExtends<
        M_Star,
        {
            id: number
            name: string
            email: string
            role: "admin" | "user" | "guest"
            is_active: boolean
            created_at: string
            deleted_at: string | null
        }
    >
>

// ============================================================================
// Column Alias Tests
// ============================================================================

// Test: AS alias changes key name
type M_Alias = QueryResult<"SELECT id AS user_id FROM users", TestSchema>
type _M6 = RequireTrue<AssertEqual<M_Alias, { user_id: number }>>

// Test: Multiple aliases
type M_MultiAlias = QueryResult<"SELECT id AS uid, name AS display_name FROM users", TestSchema>
type _M7 = RequireTrue<AssertEqual<M_MultiAlias, { uid: number; display_name: string }>>

// Test: Quoted alias preserves case
type M_QuotedAlias = QueryResult<'SELECT id AS "UserId" FROM users', TestSchema>
type _M8 = RequireTrue<AssertEqual<M_QuotedAlias, { UserId: number }>>

// ============================================================================
// Union Type Tests
// ============================================================================

// Test: Union type is preserved
type M_Union = QueryResult<"SELECT role FROM users", TestSchema>
type _M9 = RequireTrue<AssertEqual<M_Union, { role: "admin" | "user" | "guest" }>>

// Test: Another union type
type M_UnionStatus = QueryResult<"SELECT status FROM posts", TestSchema>
type _M10 = RequireTrue<AssertEqual<M_UnionStatus, { status: "draft" | "published" }>>

// ============================================================================
// Nullable Type Tests
// ============================================================================

// Test: Nullable column type is preserved
type M_Nullable = QueryResult<"SELECT deleted_at FROM users", TestSchema>
type _M11 = RequireTrue<AssertEqual<M_Nullable, { deleted_at: string | null }>>

// Test: Non-nullable column
type M_NonNullable = QueryResult<"SELECT name FROM users", TestSchema>
type _M12 = RequireTrue<AssertEqual<M_NonNullable, { name: string }>>

// Test: Mixed nullable and non-nullable
type M_MixedNull = QueryResult<"SELECT name, deleted_at FROM users", TestSchema>
type _M13 = RequireTrue<AssertEqual<M_MixedNull, { name: string; deleted_at: string | null }>>

// ============================================================================
// Table Alias Tests
// ============================================================================

// Test: Table alias with qualified columns
type M_TableAlias = QueryResult<"SELECT u.id, u.name FROM users AS u", TestSchema>
type _M14 = RequireTrue<AssertEqual<M_TableAlias, { id: number; name: string }>>

// Test: Table alias with simple columns
type M_TableAliasSimple = QueryResult<"SELECT id, name FROM users AS u", TestSchema>
type _M15 = RequireTrue<AssertEqual<M_TableAliasSimple, { id: number; name: string }>>

// ============================================================================
// JOIN Tests
// ============================================================================

// Test: INNER JOIN merges columns
type M_Join = QueryResult<
    "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>
type _M16 = RequireTrue<AssertEqual<M_Join, { name: string; title: string }>>

// Test: LEFT JOIN
type M_LeftJoin = QueryResult<
    "SELECT u.name, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>
type _M17 = RequireTrue<AssertEqual<M_LeftJoin, { name: string; title: string }>>

// Test: Multiple JOINs
type M_MultiJoin = QueryResult<
    `
  SELECT u.name, p.title, c.content
  FROM users AS u
  INNER JOIN posts AS p ON u.id = p.author_id
  INNER JOIN comments AS c ON p.id = c.post_id
`,
    TestSchema
>
type _M18 = RequireTrue<AssertEqual<M_MultiJoin, { name: string; title: string; content: string }>>

// ============================================================================
// Aggregate Function Tests
// ============================================================================

// Test: COUNT returns number
type M_Count = QueryResult<"SELECT COUNT ( * ) AS total FROM users", TestSchema>
type _M19 = RequireTrue<AssertEqual<M_Count, { total: number }>>

// Test: SUM returns number
type M_Sum = QueryResult<"SELECT SUM ( views ) AS total FROM posts", TestSchema>
type _M20 = RequireTrue<AssertEqual<M_Sum, { total: number }>>

// Test: AVG returns number
type M_Avg = QueryResult<"SELECT AVG ( views ) AS average FROM posts", TestSchema>
type _M21 = RequireTrue<AssertEqual<M_Avg, { average: number }>>

// Test: MIN preserves type
type M_Min = QueryResult<"SELECT MIN ( views ) AS lowest FROM posts", TestSchema>
type _M22 = RequireTrue<AssertEqual<M_Min, { lowest: number }>>

// Test: MAX preserves type
type M_Max = QueryResult<"SELECT MAX ( title ) AS last_title FROM posts", TestSchema>
type _M23 = RequireTrue<AssertEqual<M_Max, { last_title: string }>>

// Test: Multiple aggregates
type M_MultiAgg = QueryResult<
    "SELECT COUNT ( * ) AS count, SUM ( views ) AS total, AVG ( views ) AS avg FROM posts",
    TestSchema
>
type _M24 = RequireTrue<AssertEqual<M_MultiAgg, { count: number; total: number; avg: number }>>

// ============================================================================
// Table Wildcard Tests
// ============================================================================

// Test: table.* expands to all columns
type M_TableWildcard = QueryResult<"SELECT u.* FROM users AS u", TestSchema>
type _M25 = RequireTrue<
    AssertExtends<
        M_TableWildcard,
        {
            id: number
            name: string
            email: string
        }
    >
>

// Test: table.* with join
type M_WildcardJoin = QueryResult<
    "SELECT u.*, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>
type _M26 = RequireTrue<
    AssertExtends<
        M_WildcardJoin,
        {
            id: number
            name: string
            title: string
        }
    >
>

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
>
type _M27 = RequireTrue<AssertEqual<M_CTE, { id: number; name: string }>>

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
>
type _M28 = RequireTrue<AssertEqual<M_CTEJoin, { name: string }>>

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
>
type _M29 = RequireTrue<AssertEqual<M_Derived, { total: number }>>

// Test: Derived table with multiple columns
type M_DerivedMulti = QueryResult<
    `
  SELECT sub.cnt, sub.avg_views
  FROM ( SELECT COUNT ( * ) AS cnt, AVG ( views ) AS avg_views FROM posts ) AS sub
`,
    TestSchema
>
type _M30 = RequireTrue<AssertEqual<M_DerivedMulti, { cnt: number; avg_views: number }>>

// ============================================================================
// Type Casting Tests
// ============================================================================

// Test: Type cast to text
type M_CastText = QueryResult<"SELECT id::text AS id_str FROM users", TestSchema>
type _M31 = RequireTrue<AssertExtends<M_CastText, { id_str: string }>>

// Test: Type cast to int
type M_CastInt = QueryResult<"SELECT views::int AS view_count FROM posts", TestSchema>
type _M32 = RequireTrue<AssertExtends<M_CastInt, { view_count: number }>>

// Test: Type cast to boolean
type M_CastBool = QueryResult<"SELECT is_active::bool AS active FROM users", TestSchema>
type _M33 = RequireTrue<AssertExtends<M_CastBool, { active: boolean }>>

// ============================================================================
// Multi-Schema Tests
// ============================================================================

// Test: Query from default schema (implicit)
type M_DefaultSchema = QueryResult<"SELECT id, name FROM users", TestSchema>
type _M34 = RequireTrue<AssertEqual<M_DefaultSchema, { id: number; name: string }>>

// Test: Query with explicit schema prefix
type M_ExplicitSchema = QueryResult<"SELECT id, action FROM audit.logs", TestSchema>
type _M35 = RequireTrue<AssertEqual<M_ExplicitSchema, { id: number; action: string }>>

// Test: Cross-schema query with alias
type M_CrossSchema = QueryResult<
    "SELECT u.name, l.action FROM users AS u INNER JOIN audit.logs AS l ON u.id = l.user_id",
    TestSchema
>
type _M36 = RequireTrue<AssertEqual<M_CrossSchema, { name: string; action: string }>>

// ============================================================================
// camelCase Identifier Tests
// ============================================================================

// Test: camelCase column names
type M_CamelCol = QueryResult<'SELECT "firstName", "lastName" FROM "userAccounts"', CamelCaseTestSchema>
type _M37 = RequireTrue<AssertEqual<M_CamelCol, { firstName: string; lastName: string }>>

// Test: camelCase table with alias
type M_CamelAlias = QueryResult<
    'SELECT ua."firstName", ua."emailAddress" FROM "userAccounts" AS ua',
    CamelCaseTestSchema
>
type _M38 = RequireTrue<AssertEqual<M_CamelAlias, { firstName: string; emailAddress: string }>>

// Test: camelCase join
type M_CamelJoin = QueryResult<
    `
  SELECT ua."firstName", oi."unitPrice"
  FROM "userAccounts" AS ua
  INNER JOIN "orderItems" AS oi ON ua.id = oi."orderId"
`,
    CamelCaseTestSchema
>
type _M39 = RequireTrue<AssertEqual<M_CamelJoin, { firstName: string; unitPrice: number }>>

// ============================================================================
// Error Detection Tests
// ============================================================================

// Test: Unknown column produces error in result
type M_UnknownCol = QueryResult<"SELECT unknown_column FROM users", TestSchema>
type M_UnknownCol_IsError = M_UnknownCol extends { unknown_column: MatchError<string> } ? true : false
type _M40 = RequireTrue<M_UnknownCol_IsError>

// Test: Unknown table produces error
type M_UnknownTable = QueryResult<"SELECT * FROM unknown_table", TestSchema>
type _M41 = RequireTrue<AssertIsMatchError<M_UnknownTable>>

// Test: Wrong table qualifier produces error
type M_WrongQualifier = QueryResult<"SELECT wrong.id FROM users AS u", TestSchema>
type M_WrongQualifier_IsError = M_WrongQualifier extends { id: MatchError<string> } ? true : false
type _M42 = RequireTrue<M_WrongQualifier_IsError>

// Test: Unknown schema produces error
type M_UnknownSchema = QueryResult<"SELECT * FROM nonexistent.users", TestSchema>
type _M43 = RequireTrue<AssertIsMatchError<M_UnknownSchema>>

// ============================================================================
// ValidateSQL Tests
// ============================================================================

// Test: Valid query returns true
type V_Valid = ValidateSQL<"SELECT id, name FROM users", TestSchema>
type _V1 = RequireTrue<AssertEqual<V_Valid, true>>

// Test: Valid complex query returns true
type V_ValidComplex = ValidateSQL<
    `
  SELECT u.name, p.title
  FROM users AS u
  INNER JOIN posts AS p ON u.id = p.author_id
  WHERE u.is_active = TRUE
  ORDER BY p.views DESC
  LIMIT 10
`,
    TestSchema
>
type _V2 = RequireTrue<AssertEqual<V_ValidComplex, true>>

// Test: Invalid column returns error string
type V_InvalidCol = ValidateSQL<"SELECT bad_column FROM users", TestSchema>
type _V3 = RequireTrue<AssertExtends<V_InvalidCol, string>>

// Test: Invalid table returns error string
type V_InvalidTable = ValidateSQL<"SELECT * FROM bad_table", TestSchema>
type _V4 = RequireTrue<AssertExtends<V_InvalidTable, string>>

// Test: Invalid table qualifier returns error
type V_InvalidQualifier = ValidateSQL<"SELECT wrong.id FROM users AS u", TestSchema>
type _V5 = RequireTrue<AssertExtends<V_InvalidQualifier, string>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Full complex query with all features
type M_Complex = QueryResult<
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
>
type _M44 = RequireTrue<
    AssertEqual<
        M_Complex,
        {
            id: number
            name: string
            email: string
            post_count: number
            total_views: number
        }
    >
>

// ============================================================================
// Edge Cases
// ============================================================================

// Test: Empty result object when no columns match
type M_NoMatch = QueryResult<"SELECT * FROM users WHERE 1 = 0", TestSchema>
type _M45 = RequireTrue<AssertNotMatchError<M_NoMatch>>

// Test: Select same column twice with different aliases
type M_SameColTwice = QueryResult<"SELECT id AS id1, id AS id2 FROM users", TestSchema>
type _M46 = RequireTrue<AssertEqual<M_SameColTwice, { id1: number; id2: number }>>

// ============================================================================
// Complex Object / JSON Field Tests
// ============================================================================

// Schema with complex object types (JSON fields)
type JsonFieldSchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            items: {
                id: number
                name: string
                // Nested object type (like a JSON field)
                metadata: { foo: string; bar: number }
                // Deeply nested object
                config: { 
                    settings: { 
                        enabled: boolean
                        values: number[] 
                    }
                    tags: string[]
                }
                // Nullable object
                extra: { key: string } | null
                // Record type (common for JSON)
                data: Record<string, unknown>
            }
        }
    }
}

// Test: Query with nested object field returns correct type (not never)
type M_JsonField = QueryResult<"SELECT metadata FROM items", JsonFieldSchema>
type _M47 = RequireTrue<AssertEqual<M_JsonField, { metadata: { foo: string; bar: number } }>>

// Test: Query with deeply nested object field
type M_DeepJsonField = QueryResult<"SELECT config FROM items", JsonFieldSchema>
type _M48 = RequireTrue<AssertEqual<
    M_DeepJsonField, 
    { config: { settings: { enabled: boolean; values: number[] }; tags: string[] } }
>>

// Test: Query with nullable object field
type M_NullableJsonField = QueryResult<"SELECT extra FROM items", JsonFieldSchema>
type _M49 = RequireTrue<AssertEqual<M_NullableJsonField, { extra: { key: string } | null }>>

// Test: Query with Record type field
type M_RecordField = QueryResult<"SELECT data FROM items", JsonFieldSchema>
type _M50 = RequireTrue<AssertEqual<M_RecordField, { data: Record<string, unknown> }>>

// Test: ValidateSQL returns true for JSON field queries (not never)
type V_JsonValid = ValidateSQL<"SELECT metadata FROM items", JsonFieldSchema>
type _V6 = RequireTrue<AssertEqual<V_JsonValid, true>>

// Test: ValidateSQL returns true for deeply nested JSON field queries
type V_DeepJsonValid = ValidateSQL<"SELECT config FROM items", JsonFieldSchema>
type _V7 = RequireTrue<AssertEqual<V_DeepJsonValid, true>>

// Test: Multiple JSON fields in one query
type M_MultiJsonFields = QueryResult<"SELECT id, metadata, config FROM items", JsonFieldSchema>
type _M51 = RequireTrue<AssertEqual<
    M_MultiJsonFields,
    { 
        id: number
        metadata: { foo: string; bar: number }
        config: { settings: { enabled: boolean; values: number[] }; tags: string[] }
    }
>>

// Test: SELECT * with JSON fields
type M_StarWithJson = QueryResult<"SELECT * FROM items", JsonFieldSchema>
type _M52 = RequireTrue<AssertExtends<M_StarWithJson, { id: number; metadata: { foo: string; bar: number } }>>

// Test: ValidateSQL for SELECT * with JSON fields returns true
type V_StarJsonValid = ValidateSQL<"SELECT * FROM items", JsonFieldSchema>
type _V8 = RequireTrue<AssertEqual<V_StarJsonValid, true>>

// Test: ValidQuery returns query string (not never) for JSON field queries
type VQ_JsonField = ValidQuery<"SELECT metadata FROM items", JsonFieldSchema>
type _VQ1 = RequireTrue<AssertEqual<IsNever<VQ_JsonField>, false>>
type _VQ2 = RequireTrue<AssertExtends<VQ_JsonField, string>>

// Test: ValidQuery returns query string for deeply nested JSON field queries
type VQ_DeepJsonField = ValidQuery<"SELECT config FROM items", JsonFieldSchema>
type _VQ3 = RequireTrue<AssertEqual<IsNever<VQ_DeepJsonField>, false>>
type _VQ4 = RequireTrue<AssertExtends<VQ_DeepJsonField, string>>

// Test: ValidQuery returns query string for SELECT * with JSON fields
type VQ_StarJson = ValidQuery<"SELECT * FROM items", JsonFieldSchema>
type _VQ5 = RequireTrue<AssertEqual<IsNever<VQ_StarJson>, false>>
type _VQ6 = RequireTrue<AssertExtends<VQ_StarJson, string>>

// ============================================================================
// Full Field Validation Tests (validateAllFields option)
// ============================================================================

// Test: Invalid WHERE column detected with full validation (default)
type V_InvalidWhereCol = ValidateSQL<"SELECT id FROM users WHERE bad_column = 1", TestSchema>
type _V9 = RequireTrue<AssertExtends<V_InvalidWhereCol, string>>

// Test: Invalid ORDER BY column detected with full validation (default)
type V_InvalidOrderByCol = ValidateSQL<"SELECT id FROM users ORDER BY bad_column", TestSchema>
type _V10 = RequireTrue<AssertExtends<V_InvalidOrderByCol, string>>

// Test: Invalid GROUP BY column detected with full validation (default)
type V_InvalidGroupByCol = ValidateSQL<"SELECT id FROM users GROUP BY bad_column", TestSchema>
type _V11 = RequireTrue<AssertExtends<V_InvalidGroupByCol, string>>

// Test: Invalid JOIN ON column detected with full validation (default)
type V_InvalidJoinOnCol = ValidateSQL<
    "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
    TestSchema
>
type _V12 = RequireTrue<AssertExtends<V_InvalidJoinOnCol, string>>

// Test: Invalid HAVING column detected with full validation (default)
type V_InvalidHavingCol = ValidateSQL<
    "SELECT author_id FROM posts GROUP BY author_id HAVING bad_column > 0",
    TestSchema
>
type _V13 = RequireTrue<AssertExtends<V_InvalidHavingCol, string>>

// Test: Valid query with all clauses passes full validation
type V_ValidAllClauses = ValidateSQL<
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
>
type _V14 = RequireTrue<AssertEqual<V_ValidAllClauses, true>>

// Test: Invalid WHERE column is allowed when validateAllFields is false
import type { ValidateSelectSQL } from "../src/index.js"

type V_InvalidWhereCol_NoFullCheck = ValidateSelectSQL<
    "SELECT id FROM users WHERE bad_column = 1",
    TestSchema,
    { validateAllFields: false }
>
type _V15 = RequireTrue<AssertEqual<V_InvalidWhereCol_NoFullCheck, true>>

// Test: Invalid ORDER BY column is allowed when validateAllFields is false
type V_InvalidOrderByCol_NoFullCheck = ValidateSelectSQL<
    "SELECT id FROM users ORDER BY bad_column",
    TestSchema,
    { validateAllFields: false }
>
type _V16 = RequireTrue<AssertEqual<V_InvalidOrderByCol_NoFullCheck, true>>

// Test: Invalid JOIN ON column is allowed when validateAllFields is false
type V_InvalidJoinOnCol_NoFullCheck = ValidateSelectSQL<
    "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
    TestSchema,
    { validateAllFields: false }
>
type _V17 = RequireTrue<AssertEqual<V_InvalidJoinOnCol_NoFullCheck, true>>

// Test: Invalid SELECT column still fails even when validateAllFields is false
type V_InvalidSelectCol_NoFullCheck = ValidateSelectSQL<
    "SELECT bad_column FROM users",
    TestSchema,
    { validateAllFields: false }
>
type _V18 = RequireTrue<AssertExtends<V_InvalidSelectCol_NoFullCheck, string>>

// ============================================================================
// Export for verification
// ============================================================================

export type MatcherTestsPass = true

