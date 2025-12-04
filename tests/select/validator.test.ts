/**
 * Validator Type Tests
 *
 * Tests for ValidateSelectSQL with comprehensive validation options.
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL, ValidateSelectOptions, ValidateSQL, DatabaseSchema } from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, RequireFalse } from "../helpers.js"

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

type JsonFieldSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
      items: {
        id: number
        name: string
        metadata: { foo: string; bar: number }
        config: {
          settings: {
            enabled: boolean
            values: number[]
          }
          tags: string[]
        }
        extra: { key: string } | null
        data: Record<string, unknown>
      }
    }
  }
}

// ============================================================================
// Basic Validation Tests
// ============================================================================

// Test: Valid simple query returns true
type V_Simple = ValidateSelectSQL<"SELECT id, name FROM users", TestSchema>
type _V1 = RequireTrue<AssertEqual<V_Simple, true>>

// Test: Valid SELECT * returns true
type V_Star = ValidateSelectSQL<"SELECT * FROM users", TestSchema>
type _V2 = RequireTrue<AssertEqual<V_Star, true>>

// Test: Valid query with alias returns true
type V_Alias = ValidateSelectSQL<"SELECT id AS user_id, name AS display_name FROM users", TestSchema>
type _V3 = RequireTrue<AssertEqual<V_Alias, true>>

// Test: Valid query with table alias returns true
type V_TableAlias = ValidateSelectSQL<"SELECT u.id, u.name FROM users AS u", TestSchema>
type _V4 = RequireTrue<AssertEqual<V_TableAlias, true>>

// ============================================================================
// JOIN Validation Tests
// ============================================================================

// Test: Valid INNER JOIN returns true
type V_InnerJoin = ValidateSelectSQL<
  "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
  TestSchema
>
type _V5 = RequireTrue<AssertEqual<V_InnerJoin, true>>

// Test: Valid LEFT JOIN returns true
type V_LeftJoin = ValidateSelectSQL<
  "SELECT u.name, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
  TestSchema
>
type _V6 = RequireTrue<AssertEqual<V_LeftJoin, true>>

// Test: Valid multiple JOINs returns true
type V_MultiJoin = ValidateSelectSQL<
  `
SELECT u.name, p.title, c.content
FROM users AS u
INNER JOIN posts AS p ON u.id = p.author_id
INNER JOIN comments AS c ON p.id = c.post_id
`,
  TestSchema
>
type _V7 = RequireTrue<AssertEqual<V_MultiJoin, true>>

// Test: Invalid JOIN ON column returns error
type V_InvalidJoinOn = ValidateSelectSQL<
  "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
  TestSchema
>
type _V8 = RequireTrue<AssertExtends<V_InvalidJoinOn, string>>

// ============================================================================
// WHERE Clause Validation Tests
// ============================================================================

// Test: Valid WHERE clause returns true
type V_Where = ValidateSelectSQL<"SELECT id FROM users WHERE is_active = TRUE", TestSchema>
type _V9 = RequireTrue<AssertEqual<V_Where, true>>

// Test: Valid WHERE with table qualifier returns true
type V_WhereQualified = ValidateSelectSQL<
  "SELECT u.id FROM users AS u WHERE u.is_active = TRUE",
  TestSchema
>
type _V10 = RequireTrue<AssertEqual<V_WhereQualified, true>>

// Test: Invalid WHERE column returns error
type V_InvalidWhere = ValidateSelectSQL<"SELECT id FROM users WHERE bad_column = 1", TestSchema>
type _V11 = RequireTrue<AssertExtends<V_InvalidWhere, string>>

// Test: Invalid WHERE column with full validation enabled
type V_InvalidWhereFullValidation = ValidateSelectSQL<
  "SELECT id FROM users WHERE bad_column = 1",
  TestSchema,
  { validateAllFields: true }
>
type _V12 = RequireTrue<AssertExtends<V_InvalidWhereFullValidation, string>>

// ============================================================================
// ORDER BY Validation Tests
// ============================================================================

// Test: Valid ORDER BY returns true
type V_OrderBy = ValidateSelectSQL<"SELECT id FROM users ORDER BY name", TestSchema>
type _V13 = RequireTrue<AssertEqual<V_OrderBy, true>>

// Test: Valid ORDER BY with direction returns true
type V_OrderByDesc = ValidateSelectSQL<"SELECT id FROM users ORDER BY created_at DESC", TestSchema>
type _V14 = RequireTrue<AssertEqual<V_OrderByDesc, true>>

// Test: Invalid ORDER BY column returns error
type V_InvalidOrderBy = ValidateSelectSQL<"SELECT id FROM users ORDER BY bad_column", TestSchema>
type _V15 = RequireTrue<AssertExtends<V_InvalidOrderBy, string>>

// ============================================================================
// GROUP BY Validation Tests
// ============================================================================

// Test: Valid GROUP BY returns true
type V_GroupBy = ValidateSelectSQL<
  "SELECT role, COUNT ( * ) AS total FROM users GROUP BY role",
  TestSchema
>
type _V16 = RequireTrue<AssertEqual<V_GroupBy, true>>

// Test: Invalid GROUP BY column returns error
type V_InvalidGroupBy = ValidateSelectSQL<
  "SELECT id FROM users GROUP BY bad_column",
  TestSchema
>
type _V17 = RequireTrue<AssertExtends<V_InvalidGroupBy, string>>

// ============================================================================
// HAVING Validation Tests
// ============================================================================

// Test: Valid HAVING returns true
type V_Having = ValidateSelectSQL<
  "SELECT author_id, COUNT ( * ) AS cnt FROM posts GROUP BY author_id HAVING author_id > 0",
  TestSchema
>
type _V18 = RequireTrue<AssertEqual<V_Having, true>>

// Test: Invalid HAVING column returns error
type V_InvalidHaving = ValidateSelectSQL<
  "SELECT author_id FROM posts GROUP BY author_id HAVING bad_column > 0",
  TestSchema
>
type _V19 = RequireTrue<AssertExtends<V_InvalidHaving, string>>

// ============================================================================
// ValidateSelectOptions Tests
// ============================================================================

// Test: Invalid WHERE passes with validateAllFields: false
type V_InvalidWhereNoCheck = ValidateSelectSQL<
  "SELECT id FROM users WHERE bad_column = 1",
  TestSchema,
  { validateAllFields: false }
>
type _V20 = RequireTrue<AssertEqual<V_InvalidWhereNoCheck, true>>

// Test: Invalid ORDER BY passes with validateAllFields: false
type V_InvalidOrderByNoCheck = ValidateSelectSQL<
  "SELECT id FROM users ORDER BY bad_column",
  TestSchema,
  { validateAllFields: false }
>
type _V21 = RequireTrue<AssertEqual<V_InvalidOrderByNoCheck, true>>

// Test: Invalid GROUP BY passes with validateAllFields: false
type V_InvalidGroupByNoCheck = ValidateSelectSQL<
  "SELECT id FROM users GROUP BY bad_column",
  TestSchema,
  { validateAllFields: false }
>
type _V22 = RequireTrue<AssertEqual<V_InvalidGroupByNoCheck, true>>

// Test: Invalid HAVING passes with validateAllFields: false
type V_InvalidHavingNoCheck = ValidateSelectSQL<
  "SELECT author_id FROM posts GROUP BY author_id HAVING bad_column > 0",
  TestSchema,
  { validateAllFields: false }
>
type _V23 = RequireTrue<AssertEqual<V_InvalidHavingNoCheck, true>>

// Test: Invalid JOIN ON passes with validateAllFields: false
type V_InvalidJoinOnNoCheck = ValidateSelectSQL<
  "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
  TestSchema,
  { validateAllFields: false }
>
type _V24 = RequireTrue<AssertEqual<V_InvalidJoinOnNoCheck, true>>

// Test: Invalid SELECT column still fails with validateAllFields: false
type V_InvalidSelectNoCheck = ValidateSelectSQL<
  "SELECT bad_column FROM users",
  TestSchema,
  { validateAllFields: false }
>
type _V25 = RequireTrue<AssertExtends<V_InvalidSelectNoCheck, string>>

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
>
type _V26 = RequireTrue<AssertEqual<V_CTE, true>>

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
>
type _V27 = RequireTrue<AssertEqual<V_MultiCTE, true>>

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
>
type _V28 = RequireTrue<AssertEqual<V_Derived, true>>

// ============================================================================
// Aggregate Validation Tests
// ============================================================================

// Test: Valid aggregate returns true
type V_Agg = ValidateSelectSQL<"SELECT COUNT ( * ) AS total FROM users", TestSchema>
type _V29 = RequireTrue<AssertEqual<V_Agg, true>>

// Test: Valid aggregate with column returns true
type V_AggCol = ValidateSelectSQL<"SELECT SUM ( views ) AS total FROM posts", TestSchema>
type _V30 = RequireTrue<AssertEqual<V_AggCol, true>>

// ============================================================================
// Multi-Schema Validation Tests
// ============================================================================

// Test: Valid cross-schema query returns true
type V_CrossSchema = ValidateSelectSQL<
  "SELECT u.name, l.action FROM users AS u INNER JOIN audit.logs AS l ON u.id = l.user_id",
  TestSchema
>
type _V31 = RequireTrue<AssertEqual<V_CrossSchema, true>>

// Test: Invalid schema returns error
type V_InvalidSchema = ValidateSelectSQL<"SELECT * FROM bad_schema.users", TestSchema>
type _V32 = RequireTrue<AssertExtends<V_InvalidSchema, string>>

// ============================================================================
// Table Wildcard Validation Tests
// ============================================================================

// Test: Valid table wildcard returns true
type V_TableWildcard = ValidateSelectSQL<"SELECT u.* FROM users AS u", TestSchema>
type _V33 = RequireTrue<AssertEqual<V_TableWildcard, true>>

// Test: Invalid table wildcard returns error
type V_InvalidTableWildcard = ValidateSelectSQL<"SELECT bad.* FROM users AS u", TestSchema>
type _V34 = RequireTrue<AssertExtends<V_InvalidTableWildcard, string>>

// ============================================================================
// JSON Field Validation Tests
// ============================================================================

// Test: Valid JSON field query returns true
type V_JsonField = ValidateSelectSQL<"SELECT metadata FROM items", JsonFieldSchema>
type _V35 = RequireTrue<AssertEqual<V_JsonField, true>>

// Test: Valid deeply nested JSON field returns true
type V_DeepJsonField = ValidateSelectSQL<"SELECT config FROM items", JsonFieldSchema>
type _V36 = RequireTrue<AssertEqual<V_DeepJsonField, true>>

// Test: Valid JSON accessor in WHERE returns true
type V_JsonWhere = ValidateSelectSQL<
  "SELECT id FROM items WHERE config->>'key' = 'value'",
  JsonFieldSchema
>
type _V37 = RequireTrue<AssertEqual<V_JsonWhere, true>>

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
>
type _V38 = RequireTrue<AssertEqual<V_Complex, true>>

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
>
type _V39 = RequireTrue<AssertEqual<V_FullComplex, true>>

// ============================================================================
// Error Case Tests
// ============================================================================

// Test: Unknown table returns error
type V_UnknownTable = ValidateSelectSQL<"SELECT * FROM unknown_table", TestSchema>
type _V40 = RequireTrue<AssertExtends<V_UnknownTable, string>>

// Test: Unknown column returns error
type V_UnknownColumn = ValidateSelectSQL<"SELECT unknown_col FROM users", TestSchema>
type _V41 = RequireTrue<AssertExtends<V_UnknownColumn, string>>

// Test: Wrong table qualifier returns error
type V_WrongQualifier = ValidateSelectSQL<"SELECT wrong.id FROM users AS u", TestSchema>
type _V42 = RequireTrue<AssertExtends<V_WrongQualifier, string>>

// ============================================================================
// UNION Validation Tests
// ============================================================================

// Test: Valid UNION returns true
type V_Union = ValidateSelectSQL<
  "SELECT id, name FROM users UNION SELECT id, title AS name FROM posts",
  TestSchema
>
type _V43 = RequireTrue<AssertEqual<V_Union, true>>

// Test: Valid UNION ALL returns true
type V_UnionAll = ValidateSelectSQL<
  "SELECT id, name FROM users UNION ALL SELECT id, title AS name FROM posts",
  TestSchema
>
type _V44 = RequireTrue<AssertEqual<V_UnionAll, true>>

// ============================================================================
// DISTINCT Validation Tests
// ============================================================================

// Test: Valid DISTINCT returns true
type V_Distinct = ValidateSelectSQL<"SELECT DISTINCT role FROM users", TestSchema>
type _V45 = RequireTrue<AssertEqual<V_Distinct, true>>

// ============================================================================
// LIMIT/OFFSET Validation Tests
// ============================================================================

// Test: Valid LIMIT returns true
type V_Limit = ValidateSelectSQL<"SELECT id FROM users LIMIT 10", TestSchema>
type _V46 = RequireTrue<AssertEqual<V_Limit, true>>

// Test: Valid LIMIT OFFSET returns true
type V_LimitOffset = ValidateSelectSQL<"SELECT id FROM users LIMIT 10 OFFSET 20", TestSchema>
type _V47 = RequireTrue<AssertEqual<V_LimitOffset, true>>

// ============================================================================
// Type Casting Validation Tests
// ============================================================================

// Test: Valid type cast returns true
type V_TypeCast = ValidateSelectSQL<"SELECT id::text AS id_str FROM users", TestSchema>
type _V48 = RequireTrue<AssertEqual<V_TypeCast, true>>

// ============================================================================
// SQL Constants Validation Tests
// ============================================================================

// Test: CURRENT_DATE validates successfully
type V_CurrentDate = ValidateSelectSQL<"SELECT CURRENT_DATE AS dt FROM users", TestSchema>
type _V49 = RequireTrue<AssertEqual<V_CurrentDate, true>>

// Test: CURRENT_TIMESTAMP validates successfully
type V_CurrentTimestamp = ValidateSelectSQL<"SELECT CURRENT_TIMESTAMP AS ts FROM users", TestSchema>
type _V50 = RequireTrue<AssertEqual<V_CurrentTimestamp, true>>

// Test: Multiple SQL constants validate successfully
type V_MultiConstants = ValidateSelectSQL<
  "SELECT CURRENT_DATE AS dt, CURRENT_TIME AS tm, CURRENT_TIMESTAMP AS ts FROM users",
  TestSchema
>
type _V51 = RequireTrue<AssertEqual<V_MultiConstants, true>>

// Test: SQL constants mixed with columns validate successfully
type V_MixedConstants = ValidateSelectSQL<
  "SELECT id, name, CURRENT_DATE AS dt FROM users",
  TestSchema
>
type _V52 = RequireTrue<AssertEqual<V_MixedConstants, true>>

// Test: SQL constants in INSERT (via SELECT) validate successfully
type V_ConstantWithJoin = ValidateSelectSQL<
  "SELECT u.id, CURRENT_USER AS cu FROM users u",
  TestSchema
>
type _V53 = RequireTrue<AssertEqual<V_ConstantWithJoin, true>>

// ============================================================================
// Export for verification
// ============================================================================

export type ValidatorTestsPass = true


