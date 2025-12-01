/**
 * Type-Level Tests
 * 
 * Type assertions that verify the parser and matcher work correctly.
 * These tests run at compile time - if they compile without errors,
 * all tests pass.
 */

import type {
  ParseSQL,
  QueryResult,
  ValidateSQL,
  MatchError,
  SQLSelectQuery,
  SelectClause,
  ColumnRef,
  TableRef,
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  JoinClause,
  OrderByItem,
  AggregateExpr,
} from "../src/index.js"
import type { BlogSchema, ECommerceSchema, CamelCaseSchema } from "./schema.js"

// ============================================================================
// Type Assertion Helpers
// ============================================================================

/**
 * Assert two types are equal
 */
type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false

/**
 * Assert a type extends another
 */
type AssertExtends<T, U> = T extends U ? true : false

/**
 * Require assertion to be true (compile error if false)
 */
type RequireTrue<T extends true> = T

/**
 * Assert type is not an error
 */
type AssertNotError<T> = T extends { __error: true } ? false : true

/**
 * Assert type is an error
 */
type AssertIsError<T> = T extends { __error: true } ? true : false

// ============================================================================
// Parser Tests - Basic SELECT
// ============================================================================

// Test: SELECT * FROM table
type Test_SelectAll = ParseSQL<"SELECT * FROM users">
type _T1 = RequireTrue<AssertExtends<Test_SelectAll, SQLSelectQuery>>

// Test: SELECT columns FROM table
type Test_SelectColumns = ParseSQL<"SELECT id, name FROM users">
type _T2 = RequireTrue<AssertExtends<Test_SelectColumns, SQLSelectQuery>>

// Test: SELECT with column alias
type Test_ColumnAlias = ParseSQL<"SELECT id AS user_id FROM users">
type _T3 = RequireTrue<AssertExtends<Test_ColumnAlias, SQLSelectQuery>>

// Test: SELECT with table alias
type Test_TableAlias = ParseSQL<"SELECT u.id FROM users AS u">
type _T4 = RequireTrue<AssertExtends<Test_TableAlias, SQLSelectQuery>>

// Test: DISTINCT
type Test_Distinct = ParseSQL<"SELECT DISTINCT role FROM users">
type Test_Distinct_IsDistinct = Test_Distinct extends SQLSelectQuery<infer Q>
  ? Q extends { distinct: true } ? true : false
  : false
type _T5 = RequireTrue<Test_Distinct_IsDistinct>

// ============================================================================
// Parser Tests - WHERE Clause
// ============================================================================

// Test: Simple WHERE
type Test_Where = ParseSQL<"SELECT * FROM users WHERE id = 1">
type Test_Where_HasWhere = Test_Where extends SQLSelectQuery<infer Q>
  ? Q extends { where: object } ? true : false
  : false
type _T6 = RequireTrue<Test_Where_HasWhere>

// Test: WHERE with string literal
type Test_WhereString = ParseSQL<"SELECT * FROM users WHERE name = 'John'">
type _T7 = RequireTrue<AssertExtends<Test_WhereString, SQLSelectQuery>>

// Test: WHERE with boolean
type Test_WhereBool = ParseSQL<"SELECT * FROM users WHERE is_active = TRUE">
type _T8 = RequireTrue<AssertExtends<Test_WhereBool, SQLSelectQuery>>

// Test: WHERE IS NULL
type Test_WhereNull = ParseSQL<"SELECT * FROM users WHERE deleted_at IS NULL">
type _T9 = RequireTrue<AssertExtends<Test_WhereNull, SQLSelectQuery>>

// ============================================================================
// Parser Tests - JOINs
// ============================================================================

// Test: INNER JOIN
type Test_InnerJoin = ParseSQL<"SELECT u.id FROM users AS u INNER JOIN orders AS o ON u.id = o.user_id">
type Test_InnerJoin_HasJoin = Test_InnerJoin extends SQLSelectQuery<infer Q>
  ? Q extends { joins: JoinClause[] } ? true : false
  : false
type _T10 = RequireTrue<Test_InnerJoin_HasJoin>

// Test: LEFT JOIN
type Test_LeftJoin = ParseSQL<"SELECT * FROM users AS u LEFT JOIN orders AS o ON u.id = o.user_id">
type _T11 = RequireTrue<AssertExtends<Test_LeftJoin, SQLSelectQuery>>

// Test: RIGHT JOIN
type Test_RightJoin = ParseSQL<"SELECT * FROM users AS u RIGHT JOIN orders AS o ON u.id = o.user_id">
type _T12 = RequireTrue<AssertExtends<Test_RightJoin, SQLSelectQuery>>

// Test: Multiple JOINs
type Test_MultiJoin = ParseSQL<`
  SELECT u.id 
  FROM users AS u 
  LEFT JOIN orders AS o ON u.id = o.user_id
  LEFT JOIN posts AS p ON u.id = p.author_id
`>
type Test_MultiJoin_Count = Test_MultiJoin extends SQLSelectQuery<infer Q>
  ? Q extends { joins: [JoinClause, JoinClause] } ? true : false
  : false
type _T13 = RequireTrue<Test_MultiJoin_Count>

// ============================================================================
// Parser Tests - ORDER BY
// ============================================================================

// Test: ORDER BY default (ASC)
type Test_OrderBy = ParseSQL<"SELECT * FROM users ORDER BY name">
type Test_OrderBy_Has = Test_OrderBy extends SQLSelectQuery<infer Q>
  ? Q extends { orderBy: OrderByItem[] } ? true : false
  : false
type _T14 = RequireTrue<Test_OrderBy_Has>

// Test: ORDER BY DESC
type Test_OrderByDesc = ParseSQL<"SELECT * FROM users ORDER BY created_at DESC">
type _T15 = RequireTrue<AssertExtends<Test_OrderByDesc, SQLSelectQuery>>

// Test: Multiple ORDER BY
type Test_OrderByMulti = ParseSQL<"SELECT * FROM users ORDER BY role ASC, name DESC">
type Test_OrderByMulti_Count = Test_OrderByMulti extends SQLSelectQuery<infer Q>
  ? Q extends { orderBy: [OrderByItem, OrderByItem] } ? true : false
  : false
type _T16 = RequireTrue<Test_OrderByMulti_Count>

// ============================================================================
// Parser Tests - GROUP BY and HAVING
// ============================================================================

// Test: GROUP BY
type Test_GroupBy = ParseSQL<"SELECT role, COUNT ( * ) FROM users GROUP BY role">
type Test_GroupBy_Has = Test_GroupBy extends SQLSelectQuery<infer Q>
  ? Q extends { groupBy: object } ? true : false
  : false
type _T17 = RequireTrue<Test_GroupBy_Has>

// Test: GROUP BY with HAVING
type Test_Having = ParseSQL<"SELECT role, COUNT ( * ) FROM users GROUP BY role HAVING COUNT ( * ) > 5">
type Test_Having_Has = Test_Having extends SQLSelectQuery<infer Q>
  ? Q extends { having: object } ? true : false
  : false
type _T18 = RequireTrue<Test_Having_Has>

// ============================================================================
// Parser Tests - LIMIT and OFFSET
// ============================================================================

// Test: LIMIT
type Test_Limit = ParseSQL<"SELECT * FROM users LIMIT 10">
type Test_Limit_Has = Test_Limit extends SQLSelectQuery<infer Q>
  ? Q extends { limit: 10 } ? true : false
  : false
type _T19 = RequireTrue<Test_Limit_Has>

// Test: OFFSET
type Test_Offset = ParseSQL<"SELECT * FROM users LIMIT 10 OFFSET 20">
type Test_Offset_Has = Test_Offset extends SQLSelectQuery<infer Q>
  ? Q extends { offset: 20 } ? true : false
  : false
type _T20 = RequireTrue<Test_Offset_Has>

// ============================================================================
// Parser Tests - Aggregates
// ============================================================================

// Test: COUNT(*)
type Test_Count = ParseSQL<"SELECT COUNT ( * ) AS total FROM users">
type _T21 = RequireTrue<AssertExtends<Test_Count, SQLSelectQuery>>

// Test: SUM
type Test_Sum = ParseSQL<"SELECT SUM ( amount ) AS total FROM orders">
type _T22 = RequireTrue<AssertExtends<Test_Sum, SQLSelectQuery>>

// Test: AVG
type Test_Avg = ParseSQL<"SELECT AVG ( price ) AS average FROM products">
type _T23 = RequireTrue<AssertExtends<Test_Avg, SQLSelectQuery>>

// Test: MIN/MAX
type Test_MinMax = ParseSQL<"SELECT MIN ( price ) AS low, MAX ( price ) AS high FROM products">
type _T24 = RequireTrue<AssertExtends<Test_MinMax, SQLSelectQuery>>

// ============================================================================
// Parser Tests - CTEs
// ============================================================================

// Test: Simple CTE
type Test_CTE = ParseSQL<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = TRUE
  )
  SELECT * FROM active_users
`>
type Test_CTE_Has = Test_CTE extends SQLSelectQuery<infer Q>
  ? Q extends { ctes: object } ? true : false
  : false
type _T25 = RequireTrue<Test_CTE_Has>

// Test: Multiple CTEs
type Test_MultipleCTEs = ParseSQL<`
  WITH 
    cte1 AS ( SELECT id FROM users ),
    cte2 AS ( SELECT id FROM posts )
  SELECT * FROM cte1 LEFT JOIN cte2 ON cte1.id = cte2.id
`>
type _T26 = RequireTrue<AssertExtends<Test_MultipleCTEs, SQLSelectQuery>>

// ============================================================================
// Parser Tests - Derived Tables
// ============================================================================

// Test: Subquery in FROM
type Test_DerivedTable = ParseSQL<`
  SELECT sub.count
  FROM ( SELECT COUNT ( * ) AS count FROM users ) AS sub
`>
type _T27 = RequireTrue<AssertExtends<Test_DerivedTable, SQLSelectQuery>>

// ============================================================================
// Parser Tests - Table Wildcard
// ============================================================================

// Test: table.*
type Test_TableWildcard = ParseSQL<"SELECT u.* FROM users AS u">
type _T28 = RequireTrue<AssertExtends<Test_TableWildcard, SQLSelectQuery>>

// ============================================================================
// Matcher Tests - Basic Type Inference
// ============================================================================

// Test: Column types are inferred correctly
type Match_Basic = QueryResult<"SELECT id, name FROM users", BlogSchema>
type _M1 = RequireTrue<AssertEqual<Match_Basic, { id: number; name: string }>>

// Test: All columns with *
type Match_Star = QueryResult<"SELECT * FROM users", BlogSchema>
type _M2 = RequireTrue<AssertExtends<Match_Star, { id: number; name: string; email: string }>>

// Test: Column alias changes key name
type Match_Alias = QueryResult<"SELECT id AS user_id, name AS display_name FROM users", BlogSchema>
type _M3 = RequireTrue<AssertEqual<Match_Alias, { user_id: number; display_name: string }>>

// ============================================================================
// Matcher Tests - Union Types
// ============================================================================

// Test: Union type preserved
type Match_Union = QueryResult<"SELECT role FROM users", BlogSchema>
type _M4 = RequireTrue<AssertEqual<Match_Union, { role: "admin" | "author" | "reader" }>>

// Test: Union type in posts
type Match_UnionPosts = QueryResult<"SELECT status FROM posts", BlogSchema>
type _M5 = RequireTrue<AssertEqual<Match_UnionPosts, { status: "draft" | "published" | "archived" }>>

// ============================================================================
// Matcher Tests - Nullable Types
// ============================================================================

// Test: Nullable column preserved
type Match_Nullable = QueryResult<"SELECT published_at FROM posts", BlogSchema>
type _M6 = RequireTrue<AssertEqual<Match_Nullable, { published_at: string | null }>>

// Test: Non-nullable column
type Match_NonNullable = QueryResult<"SELECT title FROM posts", BlogSchema>
type _M7 = RequireTrue<AssertEqual<Match_NonNullable, { title: string }>>

// ============================================================================
// Matcher Tests - JOINs
// ============================================================================

// Test: JOIN merges columns from both tables
type Match_Join = QueryResult<
  "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
  BlogSchema
>
type _M8 = RequireTrue<AssertEqual<Match_Join, { name: string; title: string }>>

// Test: Multiple JOINs
type Match_MultiJoin = QueryResult<`
  SELECT u.name, p.title, c.content
  FROM users AS u
  INNER JOIN posts AS p ON u.id = p.author_id
  INNER JOIN comments AS c ON p.id = c.post_id
`, BlogSchema>
type _M9 = RequireTrue<AssertEqual<Match_MultiJoin, { name: string; title: string; content: string }>>

// ============================================================================
// Matcher Tests - Aggregates
// ============================================================================

// Test: COUNT returns number
type Match_Count = QueryResult<"SELECT COUNT ( * ) AS total FROM users", BlogSchema>
type _M10 = RequireTrue<AssertEqual<Match_Count, { total: number }>>

// Test: SUM returns number
type Match_Sum = QueryResult<"SELECT SUM ( views ) AS total FROM posts", BlogSchema>
type _M11 = RequireTrue<AssertEqual<Match_Sum, { total: number }>>

// Test: AVG returns number
type Match_Avg = QueryResult<"SELECT AVG ( views ) AS average FROM posts", BlogSchema>
type _M12 = RequireTrue<AssertEqual<Match_Avg, { average: number }>>

// Test: MIN preserves type
type Match_Min = QueryResult<"SELECT MIN ( views ) AS lowest FROM posts", BlogSchema>
type _M13 = RequireTrue<AssertEqual<Match_Min, { lowest: number }>>

// Test: MAX preserves type
type Match_Max = QueryResult<"SELECT MAX ( created_at ) AS latest FROM posts", BlogSchema>
type _M14 = RequireTrue<AssertEqual<Match_Max, { latest: string }>>

// ============================================================================
// Matcher Tests - CTEs
// ============================================================================

// Test: CTE columns are accessible
type Match_CTE = QueryResult<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = TRUE
  )
  SELECT id, name FROM active_users
`, BlogSchema>
type _M15 = RequireTrue<AssertEqual<Match_CTE, { id: number; name: string }>>

// Test: CTE with JOIN
type Match_CTEJoin = QueryResult<`
  WITH post_authors AS (
    SELECT DISTINCT author_id FROM posts
  )
  SELECT u.name
  FROM post_authors AS pa
  INNER JOIN users AS u ON pa.author_id = u.id
`, BlogSchema>
type _M16 = RequireTrue<AssertEqual<Match_CTEJoin, { name: string }>>

// ============================================================================
// Matcher Tests - Derived Tables
// ============================================================================

// Test: Derived table columns accessible
type Match_Derived = QueryResult<`
  SELECT sub.total
  FROM ( SELECT COUNT ( * ) AS total FROM users ) AS sub
`, BlogSchema>
type _M17 = RequireTrue<AssertEqual<Match_Derived, { total: number }>>

// ============================================================================
// Matcher Tests - Table Wildcards
// ============================================================================

// Test: table.* expands to all columns
type Match_Wildcard = QueryResult<"SELECT u.* FROM users AS u", BlogSchema>
type _M18 = RequireTrue<AssertExtends<Match_Wildcard, { id: number; name: string; email: string }>>

// ============================================================================
// Matcher Tests - Type Casting
// ============================================================================

// Test: Type cast returns the cast type, not the underlying column type
type Match_CastText = QueryResult<"SELECT id::text AS id_str FROM users", BlogSchema>
type _M19 = RequireTrue<AssertExtends<Match_CastText, { id_str: string }>>

// ============================================================================
// Matcher Tests - Error Detection
// ============================================================================

// Test: Unknown column produces error
type Match_UnknownCol = QueryResult<"SELECT unknown_col FROM users", BlogSchema>
type Match_UnknownCol_IsError = Match_UnknownCol extends { unknown_col: MatchError<string> } ? true : false
type _M20 = RequireTrue<Match_UnknownCol_IsError>

// Test: Unknown table produces error
type Match_UnknownTable = QueryResult<"SELECT * FROM unknown_table", BlogSchema>
type _M21 = RequireTrue<AssertIsError<Match_UnknownTable>>

// Test: Wrong table qualifier produces error
type Match_WrongQualifier = QueryResult<"SELECT wrong.id FROM users AS u", BlogSchema>
type Match_WrongQualifier_IsError = Match_WrongQualifier extends { id: MatchError<string> } ? true : false
type _M22 = RequireTrue<Match_WrongQualifier_IsError>

// ============================================================================
// Validation Tests
// ============================================================================

// Test: Valid query returns true
type Validate_Valid = ValidateSQL<"SELECT id, name FROM users", BlogSchema>
type _V1 = RequireTrue<AssertEqual<Validate_Valid, true>>

// Test: Invalid column returns error string
type Validate_InvalidCol = ValidateSQL<"SELECT bad_col FROM users", BlogSchema>
type _V2 = RequireTrue<AssertExtends<Validate_InvalidCol, string>>

// Test: Invalid table returns error string
type Validate_InvalidTable = ValidateSQL<"SELECT * FROM bad_table", BlogSchema>
type _V3 = RequireTrue<AssertExtends<Validate_InvalidTable, string>>

// ============================================================================
// E-Commerce Schema Tests
// ============================================================================

// Test: Product with category
type Match_Product = QueryResult<`
  SELECT p.name, p.price, c.name AS category
  FROM products AS p
  INNER JOIN categories AS c ON p.category_id = c.id
`, ECommerceSchema>
type _E1 = RequireTrue<AssertEqual<Match_Product, { name: string; price: number; category: string }>>

// Test: Order with items
type Match_Order = QueryResult<`
  SELECT o.order_number, oi.quantity, oi.unit_price
  FROM orders AS o
  INNER JOIN order_items AS oi ON o.id = oi.order_id
`, ECommerceSchema>
type _E2 = RequireTrue<AssertEqual<Match_Order, { order_number: string; quantity: number; unit_price: number }>>

// Test: Union type - order status
type Match_OrderStatus = QueryResult<"SELECT status FROM orders", ECommerceSchema>
type _E3 = RequireTrue<
  AssertEqual<
    Match_OrderStatus,
    { status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" }
  >
>

// Test: User role union
type Match_UserRole = QueryResult<"SELECT role FROM users", ECommerceSchema>
type _E4 = RequireTrue<AssertEqual<Match_UserRole, { role: "admin" | "moderator" | "customer" }>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Full complex query compiles and types correctly
type Match_Complex = QueryResult<`
  WITH user_orders AS (
    SELECT user_id, COUNT ( * ) AS order_count, SUM ( total_amount ) AS total
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY user_id
  )
  SELECT 
    u.email,
    u.first_name,
    u.last_name,
    uo.order_count,
    uo.total
  FROM users AS u
  LEFT JOIN user_orders AS uo ON u.id = uo.user_id
  WHERE u.status = 'active'
  ORDER BY uo.total DESC
  LIMIT 100
`, ECommerceSchema>
type _C1 = RequireTrue<
  AssertEqual<
    Match_Complex,
    {
      email: string
      first_name: string | null
      last_name: string | null
      order_count: number
      total: number
    }
  >
>

// ============================================================================
// camelCase Identifier Tests (quoted to preserve case)
// ============================================================================

// Note: In SQL, identifiers with uppercase letters must be quoted to preserve case.

// Test: camelCased columns preserve case (quoted)
type Match_CamelCase = QueryResult<'SELECT "firstName", "lastName" FROM "userAccounts"', CamelCaseSchema>
type _CC1 = RequireTrue<AssertEqual<Match_CamelCase, { firstName: string; lastName: string }>>

// Test: camelCased table with alias
type Match_CamelCaseAlias = QueryResult<'SELECT ua."firstName", ua."isActive" FROM "userAccounts" AS ua', CamelCaseSchema>
type _CC2 = RequireTrue<AssertEqual<Match_CamelCaseAlias, { firstName: string; isActive: boolean }>>

// Test: Mixed_Case columns
type Match_MixedCase = QueryResult<'SELECT "Account_Status", "Last_Login_Date" FROM "userAccounts"', CamelCaseSchema>
type _CC3 = RequireTrue<AssertEqual<Match_MixedCase, { Account_Status: "active" | "suspended" | "deleted"; Last_Login_Date: string | null }>>

// Test: PascalCase table name
type Match_PascalTable = QueryResult<'SELECT id, "unitPrice", "Item_Status" FROM "OrderItems"', CamelCaseSchema>
type _CC4 = RequireTrue<AssertEqual<Match_PascalTable, { id: number; unitPrice: number; Item_Status: "pending" | "shipped" | "delivered" }>>

// Test: Mixed_Case table name
type Match_MixedTable = QueryResult<'SELECT "categoryName", "Is_Active" FROM "Product_Categories"', CamelCaseSchema>
type _CC5 = RequireTrue<AssertEqual<Match_MixedTable, { categoryName: string; Is_Active: boolean }>>

// Test: Alias case is preserved (not normalized)
type Match_AliasCase = QueryResult<'SELECT "firstName" AS "FirstName", "lastName" AS last_name FROM "userAccounts"', CamelCaseSchema>
type _CC6 = RequireTrue<AssertEqual<Match_AliasCase, { FirstName: string; last_name: string }>>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted table with hyphen
type Match_QuotedTable = QueryResult<'SELECT id, userId, sessionToken FROM "user-sessions"', CamelCaseSchema>
type _QI1 = RequireTrue<AssertEqual<Match_QuotedTable, { id: number; userId: number; sessionToken: string }>>

// Test: Quoted columns with hyphens
type Match_QuotedCols = QueryResult<'SELECT "ip-address", "user-agent" FROM "user-sessions"', CamelCaseSchema>
type _QI2 = RequireTrue<AssertEqual<Match_QuotedCols, { "ip-address": string; "user-agent": string | null }>>

// Note: Quoted identifiers with spaces (e.g., "audit logs") are not currently supported
// because the tokenizer splits on spaces. Use identifiers with hyphens or underscores instead.

// Test: Validation for quoted table with hyphen
type Validate_QuotedHyphen = ValidateSQL<'SELECT id, userId FROM "user-sessions"', CamelCaseSchema>
type _QI3 = RequireTrue<AssertEqual<Validate_QuotedHyphen, true>>

// Test: Validation for quoted columns with hyphen
type Validate_QuotedColsHyphen = ValidateSQL<'SELECT "ip-address" FROM "user-sessions"', CamelCaseSchema>
type _QI4 = RequireTrue<AssertEqual<Validate_QuotedColsHyphen, true>>

// Test: Quoted alias with spaces
type Match_QuotedAlias = QueryResult<'SELECT "firstName" AS "First Name" FROM "userAccounts"', CamelCaseSchema>
type _QI5 = RequireTrue<AssertEqual<Match_QuotedAlias, { "First Name": string }>>

// ============================================================================
// camelCase JOIN Tests
// ============================================================================

// Test: JOIN with camelCase tables (quoted)
type Match_CamelJoin = QueryResult<`
  SELECT ua."firstName", oi."unitPrice"
  FROM "userAccounts" AS ua
  INNER JOIN "OrderItems" AS oi ON ua.id = oi."orderId"
`, CamelCaseSchema>
type _CJ1 = RequireTrue<AssertEqual<Match_CamelJoin, { firstName: string; unitPrice: number }>>

// Test: JOIN with Mixed_Case table (quoted)
type Match_MixedJoin = QueryResult<`
  SELECT ua."firstName", pc."Display_Name"
  FROM "userAccounts" AS ua
  LEFT JOIN "Product_Categories" AS pc ON ua.id = pc.id
`, CamelCaseSchema>
type _CJ2 = RequireTrue<AssertEqual<Match_MixedJoin, { firstName: string; Display_Name: string }>>

// ============================================================================
// camelCase Aggregate Tests
// ============================================================================

// Test: GROUP BY with camelCase (quoted)
type Match_CamelGroupBy = QueryResult<`
  SELECT "Account_Status", COUNT ( * ) AS "statusCount"
  FROM "userAccounts"
  GROUP BY "Account_Status"
`, CamelCaseSchema>
type _CA1 = RequireTrue<AssertEqual<Match_CamelGroupBy, { Account_Status: "active" | "suspended" | "deleted"; statusCount: number }>>

// Test: Aggregate on camelCase column (quoted)
type Match_CamelAgg = QueryResult<'SELECT MIN ( "createdAt" ) AS "firstCreated" FROM "userAccounts"', CamelCaseSchema>
type _CA2 = RequireTrue<AssertEqual<Match_CamelAgg, { firstCreated: string }>>

// ============================================================================
// Export for verification
// ============================================================================

/**
 * If this file compiles without errors, all tests pass!
 * 
 * Test coverage:
 * - Parser: SELECT, FROM, WHERE, JOIN, ORDER BY, GROUP BY, HAVING, LIMIT, OFFSET, DISTINCT, CTEs
 * - Matcher: Column resolution, type inference, union types, nullable types, aggregates, errors
 * - Validation: ValidateSQL for compile-time query checking
 * - camelCase: camelCased and Mixed_Case table/column names
 * - Quoted: Quoted identifiers with spaces and special characters
 */
export type TestsPass = true

