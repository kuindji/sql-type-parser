/**
 * Matcher Complex Expression Tests
 *
 * Tests for type inference of complex SQL expressions found in production codebases.
 * Validates that complex expressions are correctly matched against schemas.
 *
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult, ValidateSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { TestSchema as MainTestSchema } from "./schemas.js";

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                given_name: string;
                family_name: string;
                email: string;
                active: boolean;
                created_at: string;
                deleted_at: string | null;
                login_at: string | null;
                bank_id: number | null;
            };
            orders: {
                id: number;
                user_id: number;
                amount: number;
                commission: number;
                rate: number;
                currency: string;
                sale: number;
                order_date: string;
                status: "pending" | "completed" | "cancelled";
                discount: number | null;
            };
            items: {
                id: number;
                order_id: number;
                name: string;
                price: number;
                quantity: number;
                tags: string[];
            };
            analytics: {
                id: number;
                user_id: number;
                seconds: number;
                start_date: string;
                end_date: string;
            };
            clicks: {
                id: number;
                link_id: number | null;
                product_id: number | null;
                retailer: string | null;
            };
            links: {
                id: number;
                retailer: string | null;
            };
            products: {
                id: number;
                retailer: string | null;
            };
        };
    };
};

// ============================================================================
// COALESCE Expression Matcher Tests
// ============================================================================

// Test: COALESCE returns unknown (cannot determine which branch)
type M_CoalesceSimple = QueryResult<
    "SELECT COALESCE ( given_name , 'Anonymous' ) AS name FROM users",
    TestSchema
>;
type _MC1 = RequireTrue<AssertEqual<M_CoalesceSimple, { name: unknown; }>>;

// Test: COALESCE with type cast returns casted type
type M_CoalesceCast = QueryResult<
    "SELECT COALESCE ( given_name , 'Anonymous' )::text AS name FROM users",
    TestSchema
>;
type _MC2 = RequireTrue<AssertEqual<M_CoalesceCast, { name: string; }>>;

// Test: COALESCE validates column names
type V_CoalesceValid = ValidateSQL<
    "SELECT COALESCE ( given_name , family_name ) AS name FROM users",
    TestSchema
>;
type _VC1 = RequireTrue<AssertEqual<V_CoalesceValid, true>>;

// Test: COALESCE with invalid column produces error
type V_CoalesceInvalid = ValidateSQL<
    "SELECT COALESCE ( invalid_col , 'default' ) AS name FROM users",
    TestSchema
>;
type _VC2 = RequireTrue<AssertExtends<V_CoalesceInvalid, string>>;

// ============================================================================
// CASE WHEN Expression Matcher Tests
// ============================================================================

// Test: CASE WHEN parses and returns result with flag property
type M_CaseSimple = QueryResult<
    "SELECT CASE WHEN active THEN 1 ELSE 0 END AS flag FROM users",
    TestSchema
>;
type _MCW1 = RequireTrue<AssertExtends<M_CaseSimple, { flag: unknown; }>>;

// Test: CASE WHEN with type cast returns casted type
type M_CaseCast = QueryResult<
    "SELECT ( CASE WHEN active THEN 1 ELSE 0 END )::int AS flag FROM users",
    TestSchema
>;
type _MCW2 = RequireTrue<AssertExtends<M_CaseCast, { flag: number; }>>;

// Test: CASE WHEN with comparison - validates successfully
type M_CaseComparison = QueryResult<
    "SELECT CASE WHEN active = TRUE THEN given_name ELSE 'Unknown' END AS name FROM users",
    TestSchema
>;
type _MCW1a = RequireTrue<AssertExtends<M_CaseComparison, { name: unknown; }>>;

// Test: Complex CASE with arithmetic and cast - returns number
type M_CaseArithmetic = QueryResult<
    `SELECT ( 
        CASE WHEN commission > 0 
            THEN commission - COALESCE ( commission * rate , 0 ) 
        ELSE 0 
        END 
    )::float8 AS revenue 
    FROM orders`,
    TestSchema
>;
type _MCW2a = RequireTrue<
    AssertExtends<M_CaseArithmetic, { revenue: number; }>
>;

// ============================================================================
// EXTRACT Expression Matcher Tests
// ============================================================================

// Test: EXTRACT returns result with expected alias
type M_Extract = QueryResult<
    "SELECT EXTRACT ( epoch FROM created_at ) AS epoch FROM users",
    TestSchema
>;
type _ME1 = RequireTrue<AssertExtends<M_Extract, { epoch: unknown; }>>;

// Test: EXTRACT with cast returns number
type M_ExtractCast = QueryResult<
    "SELECT EXTRACT ( epoch FROM created_at )::float8 AS epoch FROM users",
    TestSchema
>;
type _ME2 = RequireTrue<AssertExtends<M_ExtractCast, { epoch: number; }>>;

// Test: EXTRACT with arithmetic operations
type M_ExtractDiv = QueryResult<
    "SELECT ( EXTRACT ( epoch FROM end_date ) - EXTRACT ( epoch FROM start_date ) ) / 86400 AS days FROM analytics",
    TestSchema
>;
type _ME3 = RequireTrue<AssertExtends<M_ExtractDiv, { days: unknown; }>>;

// Test: EXTRACT division with cast
type M_ExtractDivCast = QueryResult<
    "SELECT ( ( EXTRACT ( epoch FROM end_date ) - EXTRACT ( epoch FROM start_date ) ) / 86400 )::float8 AS days FROM analytics",
    TestSchema
>;
type _ME4 = RequireTrue<AssertExtends<M_ExtractDivCast, { days: number; }>>;

// Test: EXTRACT parses successfully
type M_ExtractYear = QueryResult<
    "SELECT EXTRACT ( year FROM order_date ) AS year FROM orders",
    TestSchema
>;
type _ME5 = RequireTrue<AssertExtends<M_ExtractYear, { year: unknown; }>>;

// ============================================================================
// TO_CHAR Expression Matcher Tests
// ============================================================================

// Test: TO_CHAR returns unknown by default
type M_ToChar = QueryResult<
    "SELECT TO_CHAR ( order_date , 'YYYY-MM' ) AS month FROM orders",
    TestSchema
>;
type _MTC1 = RequireTrue<AssertEqual<M_ToChar, { month: unknown; }>>;

// Test: TO_CHAR with cast returns string
type M_ToCharCast = QueryResult<
    "SELECT TO_CHAR ( order_date , 'YYYY-MM' )::text AS month FROM orders",
    TestSchema
>;
type _MTC2 = RequireTrue<AssertEqual<M_ToCharCast, { month: string; }>>;

// Test: TO_CHAR validates column
type V_ToCharValid = ValidateSQL<
    "SELECT TO_CHAR ( created_at , 'YYYY-MM-DD' ) AS date FROM users",
    TestSchema
>;
type _VTC1 = RequireTrue<AssertEqual<V_ToCharValid, true>>;

// ============================================================================
// Array Aggregate Matcher Tests
// ============================================================================

// Test: ARRAY_AGG returns unknown
type M_ArrayAgg = QueryResult<
    "SELECT ARRAY_AGG ( id ) AS ids FROM users",
    TestSchema
>;
type _MAA1 = RequireTrue<AssertEqual<M_ArrayAgg, { ids: unknown; }>>;

// Test: STRING_AGG returns unknown
type M_StringAgg = QueryResult<
    "SELECT STRING_AGG ( given_name , ', ' ) AS names FROM users",
    TestSchema
>;
type _MSA1 = RequireTrue<AssertEqual<M_StringAgg, { names: unknown; }>>;

// Test: STRING_AGG with cast returns string
type M_StringAggCast = QueryResult<
    "SELECT STRING_AGG ( given_name , ', ' )::text AS names FROM users",
    TestSchema
>;
type _MSA2 = RequireTrue<AssertEqual<M_StringAggCast, { names: string; }>>;

// Test: Array aggregate validates columns
type V_ArrayAggValid = ValidateSQL<
    "SELECT ARRAY_AGG ( given_name || ' ' || family_name ) AS names FROM users",
    TestSchema
>;
type _VAA1 = RequireTrue<AssertEqual<V_ArrayAggValid, true>>;

// ============================================================================
// Type Casting Matcher Tests
// ============================================================================

// Test: Cast to float8 returns number
type M_CastFloat8 = QueryResult<
    "SELECT amount::float8 AS amount FROM orders",
    TestSchema
>;
type _MCTF = RequireTrue<AssertEqual<M_CastFloat8, { amount: number; }>>;

// Test: Cast to numeric returns number
type M_CastNumeric = QueryResult<
    "SELECT amount::numeric AS amount FROM orders",
    TestSchema
>;
type _MCTN = RequireTrue<AssertEqual<M_CastNumeric, { amount: number; }>>;

// Test: Cast to text returns string
type M_CastText = QueryResult<
    "SELECT id::text AS id_str FROM users",
    TestSchema
>;
type _MCTT = RequireTrue<AssertEqual<M_CastText, { id_str: string; }>>;

// Test: Cast to boolean returns boolean
type M_CastBool = QueryResult<
    "SELECT ( id IS NOT NULL )::boolean AS has_id FROM users",
    TestSchema
>;
type _MCTB = RequireTrue<AssertEqual<M_CastBool, { has_id: boolean; }>>;

// Test: Cast expression result
type M_CastExpr = QueryResult<
    "SELECT ( amount + commission )::float8 AS total FROM orders",
    TestSchema
>;
type _MCTE = RequireTrue<AssertEqual<M_CastExpr, { total: number; }>>;

// ============================================================================
// Arithmetic Expression Matcher Tests
// ============================================================================

// Test: Simple arithmetic returns unknown
type M_ArithSimple = QueryResult<
    "SELECT price * quantity AS total FROM items",
    TestSchema
>;
type _MAR1 = RequireTrue<AssertExtends<M_ArithSimple, { total: unknown; }>>;

// Test: Arithmetic with cast returns casted type
type M_ArithCast = QueryResult<
    "SELECT ( price * quantity )::float8 AS total FROM items",
    TestSchema
>;
type _MAR2 = RequireTrue<AssertExtends<M_ArithCast, { total: number; }>>;

// Test: Division with literal
type M_DivLiteral = QueryResult<
    "SELECT ( seconds / 86400 )::float8 AS days FROM analytics",
    TestSchema
>;
type _MAR3 = RequireTrue<AssertExtends<M_DivLiteral, { days: number; }>>;

// Test: Arithmetic parses successfully
type M_ArithValid = QueryResult<
    "SELECT price * quantity AS total FROM items",
    TestSchema
>;
type _MAR4 = RequireTrue<AssertExtends<M_ArithValid, { total: unknown; }>>;

// ============================================================================
// Boolean Expression Matcher Tests
// ============================================================================

// Test: IS NOT NULL returns unknown (boolean expression)
type M_IsNotNull = QueryResult<
    "SELECT bank_id IS NOT NULL AS has_bank FROM users",
    TestSchema
>;
type _MBE1 = RequireTrue<AssertEqual<M_IsNotNull, { has_bank: unknown; }>>;

// Test: IS NULL with cast returns boolean
type M_IsNullCast = QueryResult<
    "SELECT ( deleted_at IS NULL )::boolean AS active FROM users",
    TestSchema
>;
type _MBE2 = RequireTrue<AssertEqual<M_IsNullCast, { active: boolean; }>>;

// Test: Boolean expression validates columns
type V_BoolValid = ValidateSQL<
    "SELECT login_at IS NOT NULL AS logged_in FROM users",
    TestSchema
>;
type _VBE1 = RequireTrue<AssertEqual<V_BoolValid, true>>;

// ============================================================================
// Complex Combined Expression Matcher Tests (Real-World Patterns)
// ============================================================================

// Test: Revenue calculation pattern
type M_RevenueCalc = QueryResult<
    `SELECT ( 
        CASE WHEN commission > 0 
            THEN commission - COALESCE ( commission * rate , 0 ) 
        ELSE 0 
        END 
    )::float8 AS revenue 
    FROM orders`,
    TestSchema
>;
type _MRW1 = RequireTrue<AssertEqual<M_RevenueCalc, { revenue: number; }>>;

// Test: Commission rate calculation
type M_CommissionRate = QueryResult<
    `SELECT ( 
        CASE WHEN commission > 0 AND sale > 0 
            THEN commission / sale 
        ELSE NULL 
        END 
    )::float8 AS rate 
    FROM orders`,
    TestSchema
>;
type _MRW2 = RequireTrue<AssertEqual<M_CommissionRate, { rate: number; }>>;

// Test: Validate complex revenue calculation
type V_RevenueValid = ValidateSQL<
    `SELECT ( 
        CASE WHEN commission > 0 
            THEN commission - COALESCE ( commission * rate , 0 ) 
        ELSE 0 
        END 
    )::float8 AS revenue 
    FROM orders`,
    TestSchema
>;
type _VRW1 = RequireTrue<AssertEqual<V_RevenueValid, true>>;

// Test: Nested COALESCE with fallback chain
type M_CoalesceFallback = QueryResult<
    "SELECT COALESCE ( c.retailer , l.retailer , p.retailer , 'Unknown' )::text AS retailer FROM clicks c LEFT JOIN links l ON c.link_id = l.id LEFT JOIN products p ON c.product_id = p.id",
    TestSchema
>;
type _MRW3 = RequireTrue<
    AssertEqual<M_CoalesceFallback, { retailer: string; }>
>;

// Test: Mixed regular columns with complex expressions
type M_Mixed = QueryResult<
    `SELECT 
        id,
        given_name,
        COALESCE ( login_at , 'never' )::text AS last_login,
        ( deleted_at IS NULL )::boolean AS active
    FROM users`,
    TestSchema
>;
type _MRW4 = RequireTrue<
    AssertEqual<
        M_Mixed,
        {
            id: number;
            given_name: string;
            last_login: string;
            active: boolean;
        }
    >
>;

// ============================================================================
// NULLIF Expression Matcher Tests
// ============================================================================

// Test: NULLIF returns unknown
type M_NullIf = QueryResult<
    "SELECT NULLIF ( amount , 0 ) AS safe_amount FROM orders",
    TestSchema
>;
type _MNI1 = RequireTrue<AssertEqual<M_NullIf, { safe_amount: unknown; }>>;

// Test: NULLIF in division
type M_NullIfDiv = QueryResult<
    "SELECT ( price / NULLIF ( quantity , 0 ) )::float8 AS unit_price FROM items",
    TestSchema
>;
type _MNI2 = RequireTrue<AssertEqual<M_NullIfDiv, { unit_price: number; }>>;

// ============================================================================
// GREATEST/LEAST Matcher Tests
// ============================================================================

// Test: GREATEST returns unknown
type M_Greatest = QueryResult<
    "SELECT GREATEST ( amount , commission ) AS max_val FROM orders",
    TestSchema
>;
type _MGL1 = RequireTrue<AssertEqual<M_Greatest, { max_val: unknown; }>>;

// Test: LEAST with cast
type M_LeastCast = QueryResult<
    "SELECT LEAST ( price , 100 )::float8 AS capped_price FROM items",
    TestSchema
>;
type _MGL2 = RequireTrue<AssertEqual<M_LeastCast, { capped_price: number; }>>;

// ============================================================================
// ROUND/FLOOR/CEIL Matcher Tests
// ============================================================================

// Test: ROUND returns unknown
type M_Round = QueryResult<
    "SELECT ROUND ( amount , 2 ) AS rounded FROM orders",
    TestSchema
>;
type _MRF1 = RequireTrue<AssertEqual<M_Round, { rounded: unknown; }>>;

// Test: ROUND with cast returns number
type M_RoundCast = QueryResult<
    "SELECT ROUND ( amount , 2 )::numeric AS rounded FROM orders",
    TestSchema
>;
type _MRF2 = RequireTrue<AssertEqual<M_RoundCast, { rounded: number; }>>;

// Test: FLOOR validates columns
type V_FloorValid = ValidateSQL<
    "SELECT FLOOR ( price ) AS floor_price FROM items",
    TestSchema
>;
type _VRF1 = RequireTrue<AssertEqual<V_FloorValid, true>>;

// ============================================================================
// Complex Query Tests (from original matcher.test.ts)
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
    MainTestSchema
>;
// LEFT JOIN makes user_stats columns nullable
type _M44 = RequireTrue<
    AssertEqual<
        M_Complex,
        {
            id: number;
            name: string;
            email: string;
            post_count: number | null;
            total_views: number | null;
        }
    >
>;

// ============================================================================
// Export for verification
// ============================================================================

export type MatcherComplexTestsPass = true;
export type ComplexTestsPass = true;
