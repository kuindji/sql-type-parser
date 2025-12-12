/**
 * Parser Complex Expression Tests
 *
 * Tests for complex SQL expressions found in production codebases:
 * - COALESCE, CASE WHEN, EXTRACT, TO_CHAR
 * - Array functions (array_agg, array_to_string, regexp_split_to_array)
 * - Arithmetic expressions and division
 * - Nested function calls
 * - Type casting combinations
 *
 * If this file compiles without errors, all tests pass.
 */

import type {
    AggregateExpr,
    ColumnRef,
    ComplexExpr,
    ParseSQL,
    SQLSelectQuery,
} from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";

// ============================================================================
// COALESCE Expression Tests
// ============================================================================

// Test: Simple COALESCE with two arguments
type P_CoalesceSimple = ParseSQL<"SELECT COALESCE ( a , b ) AS result FROM t">;
type _PC1 = RequireTrue<AssertExtends<P_CoalesceSimple, SQLSelectQuery>>;

// Test: COALESCE with multiple fallback values
type P_CoalesceMulti = ParseSQL<
    "SELECT COALESCE ( a , b , c , d ) AS result FROM t"
>;
type _PC2 = RequireTrue<AssertExtends<P_CoalesceMulti, SQLSelectQuery>>;

// Test: COALESCE with qualified columns
type P_CoalesceQualified = ParseSQL<
    "SELECT COALESCE ( t1.a , t2.b , 'default' ) AS val FROM t1"
>;
type _PC3 = RequireTrue<AssertExtends<P_CoalesceQualified, SQLSelectQuery>>;

// Test: COALESCE with nested function
type P_CoalesceNested = ParseSQL<
    "SELECT COALESCE ( SUM ( amount ) , 0 ) AS total FROM orders"
>;
type _PC4 = RequireTrue<AssertExtends<P_CoalesceNested, SQLSelectQuery>>;

// Test: COALESCE in arithmetic expression
type P_CoalesceArith = ParseSQL<
    "SELECT COALESCE ( a , 0 ) * rate AS computed FROM t"
>;
type _PC5 = RequireTrue<AssertExtends<P_CoalesceArith, SQLSelectQuery>>;

// ============================================================================
// CASE WHEN Expression Tests
// ============================================================================

// Test: Simple CASE WHEN with single condition
type P_CaseSimple = ParseSQL<
    "SELECT CASE WHEN active THEN 1 ELSE 0 END AS flag FROM users"
>;
type _PCW1 = RequireTrue<AssertExtends<P_CaseSimple, SQLSelectQuery>>;

// Test: CASE WHEN with comparison operator
type P_CaseComparison = ParseSQL<
    "SELECT CASE WHEN amount > 0 THEN 'positive' ELSE 'zero' END AS sign FROM t"
>;
type _PCW2 = RequireTrue<AssertExtends<P_CaseComparison, SQLSelectQuery>>;

// Test: CASE WHEN with multiple conditions (WHEN...WHEN...ELSE)
type P_CaseMultiple = ParseSQL<
    `
    SELECT CASE 
        WHEN status = 'active' THEN 1 
        WHEN status = 'pending' THEN 2 
        ELSE 0 
    END AS status_code 
    FROM users
`
>;
type _PCW3 = RequireTrue<AssertExtends<P_CaseMultiple, SQLSelectQuery>>;

// Test: CASE WHEN with AND conditions
type P_CaseAnd = ParseSQL<
    `
    SELECT CASE 
        WHEN a > 0 AND b > 0 THEN a / b 
        ELSE NULL 
    END AS ratio 
    FROM t
`
>;
type _PCW4 = RequireTrue<AssertExtends<P_CaseAnd, SQLSelectQuery>>;

// Test: CASE WHEN with IS NOT NULL
type P_CaseIsNotNull = ParseSQL<
    `
    SELECT CASE 
        WHEN col IS NOT NULL THEN col 
        ELSE 'n/a' 
    END AS value 
    FROM t
`
>;
type _PCW5 = RequireTrue<AssertExtends<P_CaseIsNotNull, SQLSelectQuery>>;

// Test: Nested CASE WHEN
type P_CaseNested = ParseSQL<
    `
    SELECT CASE 
        WHEN a > 0 THEN 
            CASE WHEN b > 0 THEN 'both' ELSE 'a_only' END 
        ELSE 'neither' 
    END AS result 
    FROM t
`
>;
type _PCW6 = RequireTrue<AssertExtends<P_CaseNested, SQLSelectQuery>>;

// Test: CASE WHEN with arithmetic inside
type P_CaseArithmetic = ParseSQL<
    `
    SELECT ( 
        CASE WHEN commission > 0 
            THEN commission - COALESCE ( commission * rate , 0 ) 
        ELSE 0 
        END 
    )::float8 AS revenue 
    FROM orders
`
>;
type _PCW7 = RequireTrue<AssertExtends<P_CaseArithmetic, SQLSelectQuery>>;

// ============================================================================
// EXTRACT Expression Tests
// ============================================================================

// Test: EXTRACT epoch FROM timestamp difference
type P_ExtractEpoch = ParseSQL<
    "SELECT EXTRACT ( epoch FROM created_at - updated_at ) AS diff FROM t"
>;
type _PE1 = RequireTrue<AssertExtends<P_ExtractEpoch, SQLSelectQuery>>;

// Test: EXTRACT year FROM date
type P_ExtractYear = ParseSQL<
    "SELECT EXTRACT ( year FROM order_date ) AS year FROM orders"
>;
type _PE2 = RequireTrue<AssertExtends<P_ExtractYear, SQLSelectQuery>>;

// Test: EXTRACT month FROM date
type P_ExtractMonth = ParseSQL<
    "SELECT EXTRACT ( month FROM created_at ) AS month FROM t"
>;
type _PE3 = RequireTrue<AssertExtends<P_ExtractMonth, SQLSelectQuery>>;

// Test: EXTRACT with division (common pattern for days calculation)
type P_ExtractDivision = ParseSQL<
    "SELECT EXTRACT ( epoch FROM end_date - start_date ) / 86400 AS days FROM t"
>;
type _PE4 = RequireTrue<AssertExtends<P_ExtractDivision, SQLSelectQuery>>;

// Test: EXTRACT inside aggregate
type P_ExtractInAggregate = ParseSQL<
    "SELECT AVG ( EXTRACT ( epoch FROM duration ) ) AS avg_duration FROM t"
>;
type _PE5 = RequireTrue<AssertExtends<P_ExtractInAggregate, SQLSelectQuery>>;

// ============================================================================
// TO_CHAR Expression Tests
// ============================================================================

// Test: TO_CHAR with date format
type P_ToCharDate = ParseSQL<
    "SELECT TO_CHAR ( order_date , 'YYYY-MM-DD' ) AS formatted FROM orders"
>;
type _PTC1 = RequireTrue<AssertExtends<P_ToCharDate, SQLSelectQuery>>;

// Test: TO_CHAR with month format
type P_ToCharMonth = ParseSQL<
    "SELECT TO_CHAR ( created_at , 'YYYY-MM' ) AS month FROM t"
>;
type _PTC2 = RequireTrue<AssertExtends<P_ToCharMonth, SQLSelectQuery>>;

// Test: TO_CHAR with week format (ISO week)
type P_ToCharWeek = ParseSQL<
    "SELECT TO_CHAR ( order_date , 'IYYY-IW' ) AS week FROM orders"
>;
type _PTC3 = RequireTrue<AssertExtends<P_ToCharWeek, SQLSelectQuery>>;

// Test: TO_CHAR with year format
type P_ToCharYear = ParseSQL<
    "SELECT TO_CHAR ( created_at , 'YYYY' ) AS year FROM t"
>;
type _PTC4 = RequireTrue<AssertExtends<P_ToCharYear, SQLSelectQuery>>;

// ============================================================================
// Array Aggregate Function Tests
// ============================================================================

// Test: ARRAY_AGG simple
type P_ArrayAgg = ParseSQL<"SELECT ARRAY_AGG ( id ) AS ids FROM users">;
type _PAA1 = RequireTrue<AssertExtends<P_ArrayAgg, SQLSelectQuery>>;

// Test: ARRAY_AGG with concatenation expression
type P_ArrayAggConcat = ParseSQL<
    `SELECT ( ARRAY_AGG ( first_name || ' ' || last_name ) ) [ 1 ] AS first_name FROM users`
>;
type _PAA2 = RequireTrue<AssertExtends<P_ArrayAggConcat, SQLSelectQuery>>;

// Test: STRING_AGG
type P_StringAgg = ParseSQL<
    "SELECT STRING_AGG ( name , ', ' ) AS names FROM users"
>;
type _PSA1 = RequireTrue<AssertExtends<P_StringAgg, SQLSelectQuery>>;

// Test: JSON_AGG
type P_JsonAgg = ParseSQL<"SELECT JSON_AGG ( row ) AS json_data FROM t">;
type _PJA1 = RequireTrue<AssertExtends<P_JsonAgg, SQLSelectQuery>>;

// Test: JSONB_AGG
type P_JsonbAgg = ParseSQL<"SELECT JSONB_AGG ( data ) AS jsonb_data FROM t">;
type _PJA2 = RequireTrue<AssertExtends<P_JsonbAgg, SQLSelectQuery>>;

// ============================================================================
// Array Function Tests
// ============================================================================

// Test: ARRAY_TO_STRING
type P_ArrayToString = ParseSQL<
    "SELECT ARRAY_TO_STRING ( tags , ',' ) AS tag_list FROM posts"
>;
type _PATS1 = RequireTrue<AssertExtends<P_ArrayToString, SQLSelectQuery>>;

// Test: ARRAY_LENGTH
type P_ArrayLength = ParseSQL<
    "SELECT ARRAY_LENGTH ( items , 1 ) AS item_count FROM orders"
>;
type _PAL1 = RequireTrue<AssertExtends<P_ArrayLength, SQLSelectQuery>>;

// Test: REGEXP_SPLIT_TO_ARRAY
type P_RegexpSplit = ParseSQL<
    "SELECT REGEXP_SPLIT_TO_ARRAY ( path , '-' ) AS parts FROM t"
>;
type _PRS1 = RequireTrue<AssertExtends<P_RegexpSplit, SQLSelectQuery>>;

// Test: Array subscript access
type P_ArraySubscript = ParseSQL<"SELECT arr [ 1 ] AS first_element FROM t">;
type _PAS1 = RequireTrue<AssertExtends<P_ArraySubscript, SQLSelectQuery>>;

// Test: Array slice
type P_ArraySlice = ParseSQL<"SELECT arr [ 1 : 3 ] AS slice FROM t">;
type _PAS2 = RequireTrue<AssertExtends<P_ArraySlice, SQLSelectQuery>>;

// ============================================================================
// Type Casting Combinations Tests
// ============================================================================

// Test: Cast to float8
type P_CastFloat8 = ParseSQL<"SELECT amount::float8 AS amount FROM t">;
type _PCT1 = RequireTrue<AssertExtends<P_CastFloat8, SQLSelectQuery>>;

// Test: Cast to numeric
type P_CastNumeric = ParseSQL<"SELECT value::numeric AS value FROM t">;
type _PCT2 = RequireTrue<AssertExtends<P_CastNumeric, SQLSelectQuery>>;

// Test: Cast to date
type P_CastDate = ParseSQL<`SELECT created_at::date AS date FROM t`>;
type _PCT3 = RequireTrue<AssertExtends<P_CastDate, SQLSelectQuery>>;

// Test: Cast expression result
type P_CastExpr = ParseSQL<"SELECT ( a + b )::float8 AS sum FROM t">;
type _PCT4 = RequireTrue<AssertExtends<P_CastExpr, SQLSelectQuery>>;

// Test: Cast function result
type P_CastFunc = ParseSQL<"SELECT COALESCE ( a , 0 )::float8 AS val FROM t">;
type _PCT5 = RequireTrue<AssertExtends<P_CastFunc, SQLSelectQuery>>;

// Test: Multiple casts in expression
type P_MultiCast = ParseSQL<
    "SELECT ( amount::numeric / 100 )::float8 AS normalized FROM t"
>;
type _PCT6 = RequireTrue<AssertExtends<P_MultiCast, SQLSelectQuery>>;

// ============================================================================
// Arithmetic Expression Tests
// ============================================================================

// Test: Division by literal
type P_DivisionLiteral = ParseSQL<"SELECT seconds / 86400 AS days FROM t">;
type _PAR1 = RequireTrue<AssertExtends<P_DivisionLiteral, SQLSelectQuery>>;

// Test: Multiplication
type P_Multiplication = ParseSQL<"SELECT price * quantity AS total FROM items">;
type _PAR2 = RequireTrue<AssertExtends<P_Multiplication, SQLSelectQuery>>;

// Test: Complex arithmetic with parentheses
type P_ComplexArith = ParseSQL<
    "SELECT ( a + b ) * ( c - d ) / e AS result FROM t"
>;
type _PAR3 = RequireTrue<AssertExtends<P_ComplexArith, SQLSelectQuery>>;

// Test: Arithmetic with column and function
type P_ArithFunc = ParseSQL<
    "SELECT amount - COALESCE ( discount , 0 ) AS net FROM orders"
>;
type _PAR4 = RequireTrue<AssertExtends<P_ArithFunc, SQLSelectQuery>>;

// ============================================================================
// Custom/User-Defined Function Tests
// ============================================================================

// Test: Custom function with multiple arguments
type P_CustomFunc = ParseSQL<
    "SELECT convert_currency ( amount::numeric , currency , 'GBP'::text , order_date::date ) AS gbp_amount FROM orders"
>;
type _PCF1 = RequireTrue<AssertExtends<P_CustomFunc, SQLSelectQuery>>;

// Test: Nested custom functions
type P_NestedCustom = ParseSQL<
    "SELECT outer_func ( inner_func ( a , b ) , c ) AS result FROM t"
>;
type _PCF2 = RequireTrue<AssertExtends<P_NestedCustom, SQLSelectQuery>>;

// ============================================================================
// Boolean Expression Tests
// ============================================================================

// Test: IS NOT NULL as select column
type P_IsNotNull = ParseSQL<"SELECT id IS NOT NULL AS has_id FROM t">;
type _PBE1 = RequireTrue<AssertExtends<P_IsNotNull, SQLSelectQuery>>;

// Test: IS NULL as select column
type P_IsNull = ParseSQL<"SELECT deleted_at IS NULL AS active FROM users">;
type _PBE2 = RequireTrue<AssertExtends<P_IsNull, SQLSelectQuery>>;

// Test: Boolean expression with cast
type P_BoolCast = ParseSQL<
    "SELECT ( id IS NOT NULL )::boolean AS has_id FROM t"
>;
type _PBE3 = RequireTrue<AssertExtends<P_BoolCast, SQLSelectQuery>>;

// ============================================================================
// Complex Combined Expression Tests (Real-World Patterns)
// ============================================================================

// Test: Pattern from orders.ts - revenue calculation
type P_RevenueCalc = ParseSQL<
    `
    SELECT ( 
        CASE WHEN commission > 0 
            THEN commission - COALESCE ( commission * rate , 0 ) 
        ELSE 0 
        END 
    )::float8 AS revenue 
    FROM orders
`
>;
type _PRW1 = RequireTrue<AssertExtends<P_RevenueCalc, SQLSelectQuery>>;

// Test: Pattern from pseAgg.ts - extract with division
type P_CycleDays = ParseSQL<
    `
    SELECT EXTRACT ( epoch FROM MIN ( login_at - created_at ) ) / 86400 AS login_cycle_min 
    FROM users
`
>;
type _PRW2 = RequireTrue<AssertExtends<P_CycleDays, SQLSelectQuery>>;

// Test: Pattern from clicks.ts - nested COALESCE with CASE
type P_NestedCoalesceCase = ParseSQL<
    `
    SELECT COALESCE ( 
        link.retailer , 
        product.retailer , 
        CASE 
            WHEN ref.id IS NOT NULL THEN 'ref_retailer' 
            ELSE NULL 
        END 
    ) AS retailer 
    FROM clicks
`
>;
type _PRW3 = RequireTrue<AssertExtends<P_NestedCoalesceCase, SQLSelectQuery>>;

// Test: Pattern from psePayments.ts - array_agg with concatenation
type P_ArrayAggConcatPattern = ParseSQL<
    `
    SELECT ( ARRAY_AGG ( given_name || ' ' || family_name ) ) [ 1 ] AS pse_name 
    FROM users 
    GROUP BY team_id
`
>;
type _PRW4 = RequireTrue<
    AssertExtends<P_ArrayAggConcatPattern, SQLSelectQuery>
>;

// Test: Pattern from orders.ts - to_char for grouping
type P_ToCharGrouping = ParseSQL<
    `
    SELECT TO_CHAR ( order_date , 'YYYY-MM' ) AS month , SUM ( amount ) AS total 
    FROM orders 
    GROUP BY TO_CHAR ( order_date , 'YYYY-MM' )
`
>;
type _PRW5 = RequireTrue<AssertExtends<P_ToCharGrouping, SQLSelectQuery>>;

// Test: Pattern - commission rate calculation
type P_CommissionRate = ParseSQL<
    `
    SELECT ( 
        CASE WHEN commission > 0 AND sale > 0 
            THEN commission / sale 
        ELSE NULL 
        END 
    ) AS commission_rate 
    FROM orders
`
>;
type _PRW6 = RequireTrue<AssertExtends<P_CommissionRate, SQLSelectQuery>>;

// Test: Pattern - boolean aggregation with array_agg
type P_BoolAgg = ParseSQL<
    `
    SELECT ( ARRAY_AGG ( bank_id IS NOT NULL ) ) [ 1 ] AS has_bank_details 
    FROM users 
    GROUP BY team_id
`
>;
type _PRW7 = RequireTrue<AssertExtends<P_BoolAgg, SQLSelectQuery>>;

// ============================================================================
// NULLIF Expression Tests
// ============================================================================

// Test: NULLIF simple
type P_NullIf = ParseSQL<"SELECT NULLIF ( a , 0 ) AS safe_divisor FROM t">;
type _PNI1 = RequireTrue<AssertExtends<P_NullIf, SQLSelectQuery>>;

// Test: NULLIF in division (prevent division by zero)
type P_NullIfDiv = ParseSQL<
    "SELECT total / NULLIF ( count , 0 ) AS average FROM t"
>;
type _PNI2 = RequireTrue<AssertExtends<P_NullIfDiv, SQLSelectQuery>>;

// ============================================================================
// GREATEST/LEAST Expression Tests
// ============================================================================

// Test: GREATEST
type P_Greatest = ParseSQL<"SELECT GREATEST ( a , b , c ) AS max_val FROM t">;
type _PGL1 = RequireTrue<AssertExtends<P_Greatest, SQLSelectQuery>>;

// Test: LEAST
type P_Least = ParseSQL<"SELECT LEAST ( a , b , c ) AS min_val FROM t">;
type _PGL2 = RequireTrue<AssertExtends<P_Least, SQLSelectQuery>>;

// ============================================================================
// ROUND/FLOOR/CEIL Expression Tests
// ============================================================================

// Test: ROUND
type P_Round = ParseSQL<"SELECT ROUND ( amount , 2 ) AS rounded FROM t">;
type _PRF1 = RequireTrue<AssertExtends<P_Round, SQLSelectQuery>>;

// Test: FLOOR
type P_Floor = ParseSQL<"SELECT FLOOR ( price ) AS floor_price FROM t">;
type _PRF2 = RequireTrue<AssertExtends<P_Floor, SQLSelectQuery>>;

// Test: CEIL
type P_Ceil = ParseSQL<"SELECT CEIL ( value ) AS ceil_value FROM t">;
type _PRF3 = RequireTrue<AssertExtends<P_Ceil, SQLSelectQuery>>;

// ============================================================================
// Export for verification
// ============================================================================

export type ParserComplexTestsPass = true;
