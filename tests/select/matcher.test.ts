/**
 * Matcher Type Tests
 *
 * Tests for QueryResult, ValidateSQL, MatchError and schema matching.
 * If this file compiles without errors, all tests pass.
 */

import type {
    DatabaseSchema,
    MatchError,
    MatchSelectQuery,
    QueryResult,
    ValidateQuery,
    ValidateSQL,
} from "../../src/index.js";
import type {
    AssertEqual,
    AssertExtends,
    AssertIsMatchError,
    AssertNotMatchError,
    IsNever,
    RequireTrue,
} from "../helpers.js";

// ============================================================================
// Test Schemas
// ============================================================================

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                email: string;
                role: "admin" | "user" | "guest";
                is_active: boolean;
                created_at: string;
                deleted_at: string | null;
            };
            posts: {
                id: number;
                author_id: number;
                title: string;
                content: string;
                views: number;
                status: "draft" | "published";
                published_at: string | null;
            };
            comments: {
                id: number;
                post_id: number;
                user_id: number;
                content: string;
                created_at: string;
            };
        };
        audit: {
            logs: {
                id: number;
                user_id: number | null;
                action: string;
                created_at: string;
            };
        };
    };
};

type CamelCaseTestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            userAccounts: {
                id: number;
                firstName: string;
                lastName: string;
                emailAddress: string;
            };
            orderItems: {
                id: number;
                orderId: number;
                unitPrice: number;
            };
        };
    };
};

// ============================================================================
// Basic Column Type Inference Tests
// ============================================================================

// Test: Single column returns correct type
type M_SingleCol = QueryResult<"SELECT id FROM users", TestSchema>;
type _M1 = RequireTrue<AssertEqual<M_SingleCol, { id: number; }>>;

// Test: Multiple columns return correct types
type M_MultiCol = QueryResult<"SELECT id, name, email FROM users", TestSchema>;
type _M2 = RequireTrue<
    AssertEqual<M_MultiCol, { id: number; name: string; email: string; }>
>;

// Test: String column
type M_StringCol = QueryResult<"SELECT name FROM users", TestSchema>;
type _M3 = RequireTrue<AssertEqual<M_StringCol, { name: string; }>>;

// Test: Boolean column
type M_BoolCol = QueryResult<"SELECT is_active FROM users", TestSchema>;
type _M4 = RequireTrue<AssertEqual<M_BoolCol, { is_active: boolean; }>>;

// ============================================================================
// SELECT * Tests
// ============================================================================

// Test: SELECT * returns all columns
type M_Star = QueryResult<"SELECT * FROM users", TestSchema>;
type _M5 = RequireTrue<
    AssertExtends<
        M_Star,
        {
            id: number;
            name: string;
            email: string;
            role: "admin" | "user" | "guest";
            is_active: boolean;
            created_at: string;
            deleted_at: string | null;
        }
    >
>;

// ============================================================================
// Column Alias Tests
// ============================================================================

// Test: AS alias changes key name
type M_Alias = QueryResult<"SELECT id AS user_id FROM users", TestSchema>;
type _M6 = RequireTrue<AssertEqual<M_Alias, { user_id: number; }>>;

// Test: Multiple aliases
type M_MultiAlias = QueryResult<
    "SELECT id AS uid, name AS display_name FROM users",
    TestSchema
>;
type _M7 = RequireTrue<
    AssertEqual<M_MultiAlias, { uid: number; display_name: string; }>
>;

// Test: Quoted alias preserves case
type M_QuotedAlias = QueryResult<
    'SELECT id AS "UserId" FROM users',
    TestSchema
>;
type _M8 = RequireTrue<AssertEqual<M_QuotedAlias, { UserId: number; }>>;

// ============================================================================
// Union Type Tests
// ============================================================================

// Test: Union type is preserved
type M_Union = QueryResult<"SELECT role FROM users", TestSchema>;
type _M9 = RequireTrue<
    AssertEqual<M_Union, { role: "admin" | "user" | "guest"; }>
>;

// Test: Another union type
type M_UnionStatus = QueryResult<"SELECT status FROM posts", TestSchema>;
type _M10 = RequireTrue<
    AssertEqual<M_UnionStatus, { status: "draft" | "published"; }>
>;

// ============================================================================
// Nullable Type Tests
// ============================================================================

// Test: Nullable column type is preserved
type M_Nullable = QueryResult<"SELECT deleted_at FROM users", TestSchema>;
type _M11 = RequireTrue<
    AssertEqual<M_Nullable, { deleted_at: string | null; }>
>;

// Test: Non-nullable column
type M_NonNullable = QueryResult<"SELECT name FROM users", TestSchema>;
type _M12 = RequireTrue<AssertEqual<M_NonNullable, { name: string; }>>;

// Test: Mixed nullable and non-nullable
type M_MixedNull = QueryResult<
    "SELECT name, deleted_at FROM users",
    TestSchema
>;
type _M13 = RequireTrue<
    AssertEqual<M_MixedNull, { name: string; deleted_at: string | null; }>
>;

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

// Test: LEFT JOIN
type M_LeftJoin = QueryResult<
    "SELECT u.name, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
    TestSchema
>;
type _M17 = RequireTrue<
    AssertEqual<M_LeftJoin, { name: string; title: string; }>
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
// Aggregate Function Tests
// ============================================================================

// Test: COUNT returns number
type M_Count = QueryResult<
    "SELECT COUNT ( * ) AS total FROM users",
    TestSchema
>;
type _M19 = RequireTrue<AssertEqual<M_Count, { total: number; }>>;

// Test: SUM returns number
type M_Sum = QueryResult<
    "SELECT SUM ( views ) AS total FROM posts",
    TestSchema
>;
type _M20 = RequireTrue<AssertEqual<M_Sum, { total: number; }>>;

// Test: AVG returns number
type M_Avg = QueryResult<
    "SELECT AVG ( views ) AS average FROM posts",
    TestSchema
>;
type _M21 = RequireTrue<AssertEqual<M_Avg, { average: number; }>>;

// Test: MIN preserves type
type M_Min = QueryResult<
    "SELECT MIN ( views ) AS lowest FROM posts",
    TestSchema
>;
type _M22 = RequireTrue<AssertEqual<M_Min, { lowest: number; }>>;

// Test: MAX preserves type
type M_Max = QueryResult<
    "SELECT MAX ( title ) AS last_title FROM posts",
    TestSchema
>;
type _M23 = RequireTrue<AssertEqual<M_Max, { last_title: string; }>>;

// Test: Multiple aggregates
type M_MultiAgg = QueryResult<
    "SELECT COUNT ( * ) AS count, SUM ( views ) AS total, AVG ( views ) AS avg FROM posts",
    TestSchema
>;
type _M24 = RequireTrue<
    AssertEqual<M_MultiAgg, { count: number; total: number; avg: number; }>
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
    "SELECT u.*, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
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
// Type Casting Tests
// ============================================================================

// Test: Type cast to text
type M_CastText = QueryResult<
    "SELECT id::text AS id_str FROM users",
    TestSchema
>;
type _M31 = RequireTrue<AssertExtends<M_CastText, { id_str: string; }>>;

// Test: Type cast to int
type M_CastInt = QueryResult<
    "SELECT views::int AS view_count FROM posts",
    TestSchema
>;
type _M32 = RequireTrue<AssertExtends<M_CastInt, { view_count: number; }>>;

// Test: Type cast to boolean
type M_CastBool = QueryResult<
    "SELECT is_active::bool AS active FROM users",
    TestSchema
>;
type _M33 = RequireTrue<AssertExtends<M_CastBool, { active: boolean; }>>;

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
>;
type _M44 = RequireTrue<
    AssertEqual<
        M_Complex,
        {
            id: number;
            name: string;
            email: string;
            post_count: number;
            total_views: number;
        }
    >
>;

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

// ============================================================================
// Complex Object / JSON Field Tests
// ============================================================================

// Schema with complex object types (JSON fields)
type JsonFieldSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            items: {
                id: number;
                name: string;
                // Nested object type (like a JSON field)
                metadata: { foo: string; bar: number; };
                // Deeply nested object
                config: {
                    settings: {
                        enabled: boolean;
                        values: number[];
                    };
                    tags: string[];
                };
                // Nullable object
                extra: { key: string; } | null;
                // Record type (common for JSON)
                data: Record<string, unknown>;
            };
        };
    };
};

// Test: Query with nested object field returns correct type (not never)
type M_JsonField = QueryResult<"SELECT metadata FROM items", JsonFieldSchema>;
type _M47 = RequireTrue<
    AssertEqual<M_JsonField, { metadata: { foo: string; bar: number; }; }>
>;

// Test: Query with deeply nested object field
type M_DeepJsonField = QueryResult<"SELECT config FROM items", JsonFieldSchema>;
type _M48 = RequireTrue<
    AssertEqual<
        M_DeepJsonField,
        {
            config: {
                settings: { enabled: boolean; values: number[]; };
                tags: string[];
            };
        }
    >
>;

// Test: JSON field accessor returns unknown (no type cast)
type M_DeepJsonFieldProperty = QueryResult<
    "SELECT config->>'settings' FROM items",
    JsonFieldSchema
>;
type _M48_1 = RequireTrue<
    AssertEqual<M_DeepJsonFieldProperty, { settings: unknown; }>
>;

// Test: JSON field accessor with type cast returns casted type
type M_JsonFieldWithCast = QueryResult<
    "SELECT (config)->>'settings'::text FROM items",
    JsonFieldSchema
>;
type _M48_2 = RequireTrue<
    AssertEqual<M_JsonFieldWithCast, { settings: string; }>
>;

// Test: Query with nullable object field
type M_NullableJsonField = QueryResult<
    "SELECT extra FROM items",
    JsonFieldSchema
>;
type _M49 = RequireTrue<
    AssertEqual<M_NullableJsonField, { extra: { key: string; } | null; }>
>;

// Test: Query with Record type field
type M_RecordField = QueryResult<"SELECT data FROM items", JsonFieldSchema>;
type _M50 = RequireTrue<
    AssertEqual<M_RecordField, { data: Record<string, unknown>; }>
>;

// Test: ValidateSQL returns true for JSON field queries (not never)
type V_JsonValid = ValidateSQL<"SELECT metadata FROM items", JsonFieldSchema>;
type _V6 = RequireTrue<AssertEqual<V_JsonValid, true>>;

// Test: ValidateSQL returns true for deeply nested JSON field queries
type V_DeepJsonValid = ValidateSQL<"SELECT config FROM items", JsonFieldSchema>;
type _V7 = RequireTrue<AssertEqual<V_DeepJsonValid, true>>;

// Test: Multiple JSON fields in one query
type M_MultiJsonFields = QueryResult<
    "SELECT id, metadata, config FROM items",
    JsonFieldSchema
>;
type _M51 = RequireTrue<
    AssertEqual<
        M_MultiJsonFields,
        {
            id: number;
            metadata: { foo: string; bar: number; };
            config: {
                settings: { enabled: boolean; values: number[]; };
                tags: string[];
            };
        }
    >
>;

// Test: SELECT * with JSON fields
type M_StarWithJson = QueryResult<"SELECT * FROM items", JsonFieldSchema>;
type _M52 = RequireTrue<
    AssertExtends<
        M_StarWithJson,
        { id: number; metadata: { foo: string; bar: number; }; }
    >
>;

// Test: ValidateSQL for SELECT * with JSON fields returns true
type V_StarJsonValid = ValidateSQL<"SELECT * FROM items", JsonFieldSchema>;
type _V8 = RequireTrue<AssertEqual<V_StarJsonValid, true>>;

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
// PostgreSQL Function Tests
// ============================================================================
// Functions resolve to `unknown` by default, unless type-casted.

// Test: length() function returns unknown by default
type M_LengthFunc = QueryResult<
    "SELECT length ( name ) AS name_len FROM users",
    TestSchema
>;
type _F1 = RequireTrue<AssertEqual<M_LengthFunc, { name_len: unknown; }>>;

// Test: length() with type cast returns the casted type
type M_LengthFuncCast = QueryResult<
    "SELECT length ( name )::int AS name_len FROM users",
    TestSchema
>;
type _F2 = RequireTrue<AssertEqual<M_LengthFuncCast, { name_len: number; }>>;

// Test: concat() function returns unknown by default
type M_ConcatFunc = QueryResult<
    "SELECT concat ( name, ' ', email ) AS full_info FROM users",
    TestSchema
>;
type _F3 = RequireTrue<AssertEqual<M_ConcatFunc, { full_info: unknown; }>>;

// Test: concat() with type cast returns string
type M_ConcatFuncCast = QueryResult<
    "SELECT concat ( name, email )::text AS full_info FROM users",
    TestSchema
>;
type _F4 = RequireTrue<AssertEqual<M_ConcatFuncCast, { full_info: string; }>>;

// Test: split_part() function returns unknown
type M_SplitPartFunc = QueryResult<
    "SELECT split_part ( email, '@', 1 ) AS username FROM users",
    TestSchema
>;
type _F5 = RequireTrue<AssertEqual<M_SplitPartFunc, { username: unknown; }>>;

// Test: split_part() with type cast
type M_SplitPartFuncCast = QueryResult<
    "SELECT split_part ( email, '@', 1 )::varchar AS username FROM users",
    TestSchema
>;
type _F6 = RequireTrue<AssertEqual<M_SplitPartFuncCast, { username: string; }>>;

// Test: coalesce() function returns unknown
type M_CoalesceFunc = QueryResult<
    "SELECT coalesce ( deleted_at, created_at ) AS date FROM users",
    TestSchema
>;
type _F7 = RequireTrue<AssertEqual<M_CoalesceFunc, { date: unknown; }>>;

// Test: coalesce() with type cast
type M_CoalesceFuncCast = QueryResult<
    "SELECT coalesce ( deleted_at, created_at )::timestamp AS date FROM users --comment",
    TestSchema
>;
type _F8 = RequireTrue<AssertEqual<M_CoalesceFuncCast, { date: string; }>>;

// Test: upper() function returns unknown
type M_UpperFunc = QueryResult<
    "SELECT upper ( name ) /*comment*/ AS upper_name FROM users",
    TestSchema
>;
type _F9 = RequireTrue<AssertEqual<M_UpperFunc, { upper_name: unknown; }>>;

// Test: upper() with type cast
type M_UpperFuncCast = QueryResult<
    "SELECT upper ( name )::text AS upper_name FROM users",
    TestSchema
>;
type _F10 = RequireTrue<AssertEqual<M_UpperFuncCast, { upper_name: string; }>>;

// Test: lower() function returns unknown
type M_LowerFunc = QueryResult<
    "SELECT lower ( email ) AS lower_email FROM users",
    TestSchema
>;
type _F11 = RequireTrue<AssertEqual<M_LowerFunc, { lower_email: unknown; }>>;

// Test: substring() function returns unknown
type M_SubstringFunc = QueryResult<
    "SELECT substring ( name from 1 for 5 ) AS short_name FROM users",
    TestSchema
>;
type _F12 = RequireTrue<AssertEqual<M_SubstringFunc, { short_name: unknown; }>>;

// Test: substring() with type cast
type M_SubstringFuncCast = QueryResult<
    "SELECT substring ( name from 1 for 5 )::text AS short_name FROM users",
    TestSchema
>;
type _F13 = RequireTrue<
    AssertEqual<M_SubstringFuncCast, { short_name: string; }>
>;

// Test: now() function (no arguments) returns unknown
type M_NowFunc = QueryResult<
    "SELECT now ( ) AS current_time FROM users",
    TestSchema
>;
type _F14 = RequireTrue<AssertEqual<M_NowFunc, { current_time: unknown; }>>;

// Test: now() with type cast
type M_NowFuncCast = QueryResult<
    "SELECT now ( )::timestamp AS current_time FROM users",
    TestSchema
>;
type _F15 = RequireTrue<AssertEqual<M_NowFuncCast, { current_time: string; }>>;

// Test: date_part() function returns unknown
type M_DatePartFunc = QueryResult<
    "SELECT date_part ( 'year', created_at ) AS year FROM users",
    TestSchema
>;
type _F16 = RequireTrue<AssertEqual<M_DatePartFunc, { year: unknown; }>>;

// Test: date_part() with type cast returns number
type M_DatePartFuncCast = QueryResult<
    "SELECT date_part ( 'year', created_at )::int AS year FROM users",
    TestSchema
>;
type _F17 = RequireTrue<AssertEqual<M_DatePartFuncCast, { year: number; }>>;

// Test: trim() function returns unknown
type M_TrimFunc = QueryResult<
    "SELECT trim ( name ) AS trimmed_name FROM users",
    TestSchema
>;
type _F18 = RequireTrue<AssertEqual<M_TrimFunc, { trimmed_name: unknown; }>>;

// Test: replace() function returns unknown
type M_ReplaceFunc = QueryResult<
    "SELECT replace ( email, '@', '_at_' ) AS safe_email FROM users",
    TestSchema
>;
type _F19 = RequireTrue<AssertEqual<M_ReplaceFunc, { safe_email: unknown; }>>;

// Test: regexp_replace() function returns unknown
type M_RegexpReplaceFunc = QueryResult<
    "SELECT regexp_replace ( email, '@.*', '' ) AS user_part FROM users",
    TestSchema
>;
type _F20 = RequireTrue<
    AssertEqual<M_RegexpReplaceFunc, { user_part: unknown; }>
>;

// Test: left() function returns unknown
type M_LeftFunc = QueryResult<
    "SELECT left ( name, 3 ) AS initials FROM users",
    TestSchema
>;
type _F21 = RequireTrue<AssertEqual<M_LeftFunc, { initials: unknown; }>>;

// Test: left() with type cast
type M_LeftFuncCast = QueryResult<
    "SELECT left ( name, 3 )::char AS initials FROM users",
    TestSchema
>;
type _F22 = RequireTrue<AssertEqual<M_LeftFuncCast, { initials: string; }>>;

// Test: right() function returns unknown
type M_RightFunc = QueryResult<
    "SELECT right ( name, 3 ) AS suffix FROM users",
    TestSchema
>;
type _F23 = RequireTrue<AssertEqual<M_RightFunc, { suffix: unknown; }>>;

// Test: array_agg() function returns unknown
type M_ArrayAggFunc = QueryResult<
    "SELECT array_agg ( name ) AS names FROM users",
    TestSchema
>;
type _F24 = RequireTrue<AssertEqual<M_ArrayAggFunc, { names: unknown; }>>;

// Test: string_agg() function returns unknown
type M_StringAggFunc = QueryResult<
    "SELECT string_agg ( name, ', ' ) AS all_names FROM users",
    TestSchema
>;
type _F25 = RequireTrue<AssertEqual<M_StringAggFunc, { all_names: unknown; }>>;

// Test: string_agg() with type cast
type M_StringAggFuncCast = QueryResult<
    "SELECT string_agg ( name, ', ' )::text AS all_names FROM users",
    TestSchema
>;
type _F26 = RequireTrue<
    AssertEqual<M_StringAggFuncCast, { all_names: string; }>
>;

// Test: abs() function returns unknown
type M_AbsFunc = QueryResult<
    "SELECT abs ( views ) AS abs_views FROM posts",
    TestSchema
>;
type _F27 = RequireTrue<AssertEqual<M_AbsFunc, { abs_views: unknown; }>>;

// Test: abs() with type cast returns number
type M_AbsFuncCast = QueryResult<
    "SELECT abs ( views )::int AS abs_views FROM posts",
    TestSchema
>;
type _F28 = RequireTrue<AssertEqual<M_AbsFuncCast, { abs_views: number; }>>;

// Test: round() function returns unknown
type M_RoundFunc = QueryResult<
    "SELECT round ( views / 10.0, 2 ) AS rounded_views FROM posts",
    TestSchema
>;
type _F29 = RequireTrue<AssertEqual<M_RoundFunc, { rounded_views: unknown; }>>;

// Test: round() with type cast
type M_RoundFuncCast = QueryResult<
    "SELECT round ( views / 10.0, 2 )::numeric AS rounded_views FROM posts",
    TestSchema
>;
type _F30 = RequireTrue<
    AssertEqual<M_RoundFuncCast, { rounded_views: number; }>
>;

// Test: Mixed: function with regular columns
type M_MixedFuncAndCols = QueryResult<
    "SELECT id, name, length ( name )::int AS name_len FROM users",
    TestSchema
>;
type _F31 = RequireTrue<
    AssertEqual<
        M_MixedFuncAndCols,
        { id: number; name: string; name_len: number; }
    >
>;

// Test: Nested functions return unknown
type M_NestedFuncs = QueryResult<
    "SELECT upper ( trim ( name ) ) AS cleaned_name FROM users",
    TestSchema
>;
type _F32 = RequireTrue<AssertEqual<M_NestedFuncs, { cleaned_name: unknown; }>>;

// Test: Nested functions with type cast
type M_NestedFuncsCast = QueryResult<
    "SELECT upper ( trim ( name ) )::text AS cleaned_name FROM users",
    TestSchema
>;
type _F33 = RequireTrue<
    AssertEqual<M_NestedFuncsCast, { cleaned_name: string; }>
>;

// Test: Function in expression (e.g., length() > 5)
type M_FuncInExpr = QueryResult<
    "SELECT id FROM users WHERE length ( name ) > 5",
    TestSchema
>;
type _F34 = RequireTrue<AssertEqual<M_FuncInExpr, { id: number; }>>;

// Test: ValidateSQL passes for function calls
type V_FuncValid = ValidateSQL<
    "SELECT length ( name ) AS len FROM users",
    TestSchema
>;
type _F35 = RequireTrue<AssertEqual<V_FuncValid, true>>;

// Test: ValidateSQL passes for function with unknown arg (string literal)
type V_FuncLiteralValid = ValidateSQL<
    "SELECT concat ( 'Hello', name ) AS greeting FROM users",
    TestSchema
>;
type _F36 = RequireTrue<AssertEqual<V_FuncLiteralValid, true>>;

// Test: ValidateSQL fails for function with invalid column
type V_FuncInvalidCol = ValidateSQL<
    "SELECT length ( bad_column ) AS len FROM users",
    TestSchema
>;
type _F37 = RequireTrue<AssertExtends<V_FuncInvalidCol, string>>;

// Test: :: cast syntax returns the casted type
type M_ColonCast = QueryResult<
    "SELECT id::text AS id_text FROM users",
    TestSchema
>;
type _F38 = RequireTrue<AssertEqual<M_ColonCast, { id_text: string; }>>;

// Test: CAST() function returns the casted type
type M_CastFunc = QueryResult<
    "SELECT CAST ( id AS text ) AS id_text FROM users",
    TestSchema
>;
type _F38a = RequireTrue<AssertEqual<M_CastFunc, { id_text: string; }>>;

// Test: CAST() without alias uses expression name
type M_CastNoAlias = QueryResult<
    "SELECT CAST ( id AS varchar ) FROM users",
    TestSchema
>;
type _F38b = RequireTrue<AssertEqual<M_CastNoAlias, { id: string; }>>;

// Test: CAST() with different type conversion
type M_CastToInt = QueryResult<
    "SELECT CAST ( name AS int ) AS name_num FROM users",
    TestSchema
>;
type _F38c = RequireTrue<AssertEqual<M_CastToInt, { name_num: number; }>>;

// Test: to_char() function returns unknown
type M_ToCharFunc = QueryResult<
    "SELECT to_char ( created_at, 'YYYY-MM-DD' ) AS date_str FROM users",
    TestSchema
>;
type _F39 = RequireTrue<AssertEqual<M_ToCharFunc, { date_str: unknown; }>>;

// Test: to_char() with type cast
type M_ToCharFuncCast = QueryResult<
    "SELECT to_char ( created_at, 'YYYY-MM-DD' )::text AS date_str FROM users",
    TestSchema
>;
type _F40 = RequireTrue<AssertEqual<M_ToCharFuncCast, { date_str: string; }>>;

// ============================================================================
// PostgreSQL Concatenation Operator Tests
// ============================================================================

// Test: Simple string concatenation with || operator returns unknown (no type cast)
type M_ConcatSimple = QueryResult<
    "SELECT name || email AS combined FROM users",
    TestSchema
>;
type _C1 = RequireTrue<AssertEqual<M_ConcatSimple, { combined: unknown; }>>;

// Test: Concatenation with type cast returns casted type
type M_ConcatCast = QueryResult<
    "SELECT (name || email)::text AS combined FROM users",
    TestSchema
>;
type _C2 = RequireTrue<AssertEqual<M_ConcatCast, { combined: string; }>>;

// Test: Concatenation with literal strings
type M_ConcatLiteral = QueryResult<
    "SELECT name || ' - ' || email AS display FROM users",
    TestSchema
>;
type _C3 = RequireTrue<AssertEqual<M_ConcatLiteral, { display: unknown; }>>;

// Test: ValidateSQL returns true for concatenation queries (columns are validated)
type V_ConcatValid = ValidateSQL<"SELECT name || email FROM users", TestSchema>;
type _C4 = RequireTrue<AssertEqual<V_ConcatValid, true>>;

// Test: ValidateSQL catches invalid column in concatenation
type V_ConcatInvalid = ValidateSQL<
    "SELECT name || invalid_col FROM users",
    TestSchema
>;
type _C5 = RequireTrue<AssertExtends<V_ConcatInvalid, string>>;

// ============================================================================
// Literal Value Type Inference Tests
// ============================================================================

// Test: Numeric literal returns the exact number type
type M_NumericLiteral = QueryResult<"SELECT 1 AS num FROM users", TestSchema>;
type _L1 = RequireTrue<AssertEqual<M_NumericLiteral, { num: 1; }>>;

// Test: String literal returns the exact string type
type M_StringLiteral = QueryResult<
    "SELECT 'hello' AS greeting FROM users",
    TestSchema
>;
type _L2 = RequireTrue<AssertEqual<M_StringLiteral, { greeting: "hello"; }>>;

// Test: NULL literal returns null type
type M_NullLiteral = QueryResult<
    "SELECT NULL AS nothing FROM users",
    TestSchema
>;
type _L3 = RequireTrue<AssertEqual<M_NullLiteral, { nothing: null; }>>;

// Test: TRUE literal returns true type
type M_TrueLiteral = QueryResult<"SELECT TRUE AS flag FROM users", TestSchema>;
type _L4 = RequireTrue<AssertEqual<M_TrueLiteral, { flag: true; }>>;

// Test: FALSE literal returns false type
type M_FalseLiteral = QueryResult<
    "SELECT FALSE AS inactive FROM users",
    TestSchema
>;
type _L5 = RequireTrue<AssertEqual<M_FalseLiteral, { inactive: false; }>>;

// Test: Mix of literals and columns
type M_MixedLiteralsCols = QueryResult<
    "SELECT id, 1 AS one, name, 'test' AS str FROM users",
    TestSchema
>;
type _L6 = RequireTrue<
    AssertEqual<
        M_MixedLiteralsCols,
        { id: number; one: 1; name: string; str: "test"; }
    >
>;

// Test: Larger numeric literal
type M_LargeNumeric = QueryResult<"SELECT 42 AS answer FROM users", TestSchema>;
type _L7 = RequireTrue<AssertEqual<M_LargeNumeric, { answer: 42; }>>;

// Test: String literal with spaces
type M_StringWithSpaces = QueryResult<
    "SELECT 'hello world' AS msg FROM users",
    TestSchema
>;
type _L8 = RequireTrue<
    AssertEqual<M_StringWithSpaces, { msg: "hello world"; }>
>;

// Test: ValidateSQL passes for literal values (no column reference to validate)
type V_LiteralValid = ValidateSQL<
    "SELECT 1 AS num, 'test' AS str FROM users",
    TestSchema
>;
type _L9 = RequireTrue<AssertEqual<V_LiteralValid, true>>;

// ============================================================================
// Parameter Placeholder Type Inference Tests
// ============================================================================

// Test: Parameter placeholder returns unknown
type M_ParamPlaceholder = QueryResult<
    "SELECT $1 AS field_name FROM users",
    TestSchema
>;
type _PP1 = RequireTrue<
    AssertEqual<M_ParamPlaceholder, { field_name: unknown; }>
>;

// Test: Named parameter returns unknown
type M_NamedParam = QueryResult<
    "SELECT :user_id AS uid FROM users",
    TestSchema
>;
type _PP2 = RequireTrue<AssertEqual<M_NamedParam, { uid: unknown; }>>;

// Test: Mix of parameters and columns
type M_MixedParams = QueryResult<
    "SELECT id, $1 AS param FROM users",
    TestSchema
>;
type _PP3 = RequireTrue<
    AssertEqual<M_MixedParams, { id: number; param: unknown; }>
>;

// ============================================================================
// Function Call Type Inference Tests
// ============================================================================

// Test: now() returns unknown
type M_FuncNow = QueryResult<
    "SELECT now ( ) AS created_at FROM users",
    TestSchema
>;
type _FN1 = RequireTrue<AssertEqual<M_FuncNow, { created_at: unknown; }>>;

// Test: concat() returns unknown
type M_FuncConcat2 = QueryResult<
    "SELECT concat ( 'a' , 'b' ) AS combined FROM users",
    TestSchema
>;
type _FN2 = RequireTrue<AssertEqual<M_FuncConcat2, { combined: unknown; }>>;

// Test: Function with column argument validates the column
type M_FuncWithCol = QueryResult<
    "SELECT upper ( name ) AS upper_name FROM users",
    TestSchema
>;
type _FN3 = RequireTrue<AssertEqual<M_FuncWithCol, { upper_name: unknown; }>>;

// Test: Function with type cast returns cast type
type M_FuncCast = QueryResult<
    "SELECT now ( ) ::text AS ts FROM users",
    TestSchema
>;
type _FN4 = RequireTrue<AssertEqual<M_FuncCast, { ts: string; }>>;

// Test: ValidateSQL catches invalid column in function
type V_FuncInvalidCol2 = ValidateSQL<
    "SELECT upper ( invalid_col ) AS upper_name FROM users",
    TestSchema
>;
type _FN5 = RequireTrue<AssertExtends<V_FuncInvalidCol2, string>>;

// ============================================================================
// Arithmetic Expression Type Inference Tests
// ============================================================================

// Test: Arithmetic with literals returns unknown
type M_ArithLiteral = QueryResult<"SELECT 1 + 1 AS two FROM users", TestSchema>;
type _AR1 = RequireTrue<AssertEqual<M_ArithLiteral, { two: unknown; }>>;

// Test: Arithmetic with columns returns unknown
type M_ArithCols = QueryResult<
    "SELECT views + 1 AS incremented FROM posts",
    TestSchema
>;
type _AR2 = RequireTrue<AssertEqual<M_ArithCols, { incremented: unknown; }>>;

// Test: Arithmetic with type cast returns cast type
type M_ArithCast = QueryResult<
    "SELECT ( views + 1 ) ::int AS incremented FROM posts",
    TestSchema
>;
type _AR3 = RequireTrue<AssertEqual<M_ArithCast, { incremented: number; }>>;

// ============================================================================
// SQL Constants Type Inference Tests
// ============================================================================

// Test: CURRENT_DATE returns string (date type)
type M_CurrentDate = QueryResult<
    "SELECT CURRENT_DATE AS dt FROM users",
    TestSchema
>;
type _SC1 = RequireTrue<AssertEqual<M_CurrentDate, { dt: string; }>>;

// Test: CURRENT_TIMESTAMP returns string (timestamp type)
type M_CurrentTimestamp = QueryResult<
    "SELECT CURRENT_TIMESTAMP AS ts FROM users",
    TestSchema
>;
type _SC2 = RequireTrue<AssertEqual<M_CurrentTimestamp, { ts: string; }>>;

// Test: CURRENT_TIME returns string (time type)
type M_CurrentTime = QueryResult<
    "SELECT CURRENT_TIME AS t FROM users",
    TestSchema
>;
type _SC3 = RequireTrue<AssertEqual<M_CurrentTime, { t: string; }>>;

// Test: LOCALTIME returns string (time type)
type M_LocalTime = QueryResult<"SELECT LOCALTIME AS lt FROM users", TestSchema>;
type _SC4 = RequireTrue<AssertEqual<M_LocalTime, { lt: string; }>>;

// Test: LOCALTIMESTAMP returns string (timestamp type)
type M_LocalTimestamp = QueryResult<
    "SELECT LOCALTIMESTAMP AS lts FROM users",
    TestSchema
>;
type _SC5 = RequireTrue<AssertEqual<M_LocalTimestamp, { lts: string; }>>;

// Test: CURRENT_USER returns string
type M_CurrentUser = QueryResult<
    "SELECT CURRENT_USER AS u FROM users",
    TestSchema
>;
type _SC6 = RequireTrue<AssertEqual<M_CurrentUser, { u: string; }>>;

// Test: SESSION_USER returns string
type M_SessionUser = QueryResult<
    "SELECT SESSION_USER AS su FROM users",
    TestSchema
>;
type _SC7 = RequireTrue<AssertEqual<M_SessionUser, { su: string; }>>;

// Test: CURRENT_SCHEMA returns string
type M_CurrentSchema = QueryResult<
    "SELECT CURRENT_SCHEMA AS schema FROM users",
    TestSchema
>;
type _SC8 = RequireTrue<AssertEqual<M_CurrentSchema, { schema: string; }>>;

// Test: Mix of SQL constants and columns
type M_MixedConstants = QueryResult<
    "SELECT id, CURRENT_DATE AS dt FROM users",
    TestSchema
>;
type _SC9 = RequireTrue<
    AssertEqual<M_MixedConstants, { id: number; dt: string; }>
>;

// Test: SQL constant with alias
type M_ConstantAlias = QueryResult<
    "SELECT CURRENT_DATE AS today FROM users",
    TestSchema
>;
type _SC10 = RequireTrue<AssertEqual<M_ConstantAlias, { today: string; }>>;

// Test: Multiple SQL constants
type M_MultiConstants = QueryResult<
    "SELECT CURRENT_DATE AS dt, CURRENT_TIME AS tm FROM users",
    TestSchema
>;
type _SC11 = RequireTrue<
    AssertEqual<M_MultiConstants, { dt: string; tm: string; }>
>;

// Test: SQL constants in function calls (concat, etc.) - lowercase should work too
type M_ConstantInFunc = QueryResult<
    "SELECT concat ( '1' , '2' , current_date ) AS result FROM users",
    TestSchema
>;
type _SC12 = RequireTrue<AssertEqual<M_ConstantInFunc, { result: unknown; }>>;

// Test: SQL constants in function calls with uppercase
type M_ConstantInFuncUpper = QueryResult<
    "SELECT concat ( 'test' , CURRENT_TIMESTAMP ) AS result FROM users",
    TestSchema
>;
type _SC13 = RequireTrue<
    AssertEqual<M_ConstantInFuncUpper, { result: unknown; }>
>;

// ============================================================================
// EXISTS and NOT EXISTS Tests
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
    "SELECT id FROM users WHERE EXISTS ( SELECT 1 FROM posts WHERE author_id = users.id ) AND NOT EXISTS ( SELECT 1 FROM comments WHERE user_id = users.id )",
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
// INTERVAL Expression Tests
// ============================================================================

// Test: INTERVAL expression returns string
type M_Interval = QueryResult<"SELECT INTERVAL '1 day' AS duration FROM users", TestSchema>;
type _INT1 = RequireTrue<AssertEqual<M_Interval, { duration: string; }>>;

// Test: INTERVAL with unit keyword
type M_IntervalUnit = QueryResult<"SELECT INTERVAL '1' DAY AS one_day FROM users", TestSchema>;
type _INT2 = RequireTrue<AssertEqual<M_IntervalUnit, { one_day: string; }>>;

// Test: INTERVAL with complex value
type M_IntervalComplex = QueryResult<"SELECT INTERVAL '1 year 2 months' AS period FROM users", TestSchema>;
type _INT3 = RequireTrue<AssertEqual<M_IntervalComplex, { period: string; }>>;

// Test: INTERVAL without alias defaults to "interval"
type M_IntervalNoAlias = QueryResult<"SELECT INTERVAL '1 hour' FROM users", TestSchema>;
type _INT4 = RequireTrue<AssertEqual<M_IntervalNoAlias, { interval: string; }>>;

// Test: INTERVAL mixed with other columns
type M_IntervalMixed = QueryResult<"SELECT id, name, INTERVAL '30 days' AS month FROM users", TestSchema>;
type _INT5 = RequireTrue<AssertEqual<M_IntervalMixed, { id: number; name: string; month: string; }>>;

// Test: INTERVAL with TO keyword
type M_IntervalTo = QueryResult<"SELECT INTERVAL '1-2' YEAR TO MONTH AS range FROM users", TestSchema>;
type _INT6 = RequireTrue<AssertEqual<M_IntervalTo, { range: string; }>>;

// Test: INTERVAL in WHERE clause - should not cause validation errors
type M_IntervalWhere = QueryResult<"SELECT id, name FROM users WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'", TestSchema>;
type _INT7 = RequireTrue<AssertEqual<M_IntervalWhere, { id: number; name: string; }>>;

// Test: Multiple INTERVALs in same query
type M_MultiInterval = QueryResult<"SELECT INTERVAL '1 day' AS day, INTERVAL '1 hour' AS hour FROM users", TestSchema>;
type _INT8 = RequireTrue<AssertEqual<M_MultiInterval, { day: string; hour: string; }>>;

// ============================================================================
// Export for verification
// ============================================================================

export type MatcherTestsPass = true;
