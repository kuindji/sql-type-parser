/**
 * Matcher Examples
 * 
 * Comprehensive examples demonstrating schema matching and type inference.
 * Shows how parsed SQL queries are matched against database schemas to
 * produce result types.
 */

import type { QueryResult, ValidateSQL, MatchQuery, MatchError, DatabaseSchema } from "../matcher.js"
import type { ParseSQL } from "../parser.js"
import type { BlogSchema, ECommerceSchema, JsonSchema } from "./schema.js"

// ============================================================================
// 1. Basic Column Selection
// ============================================================================

/** Select all columns with * */
type SelectAllUsers = QueryResult<"SELECT * FROM users", BlogSchema>
// Result: { id: number; name: string; email: string; role: "admin" | "author" | "reader"; is_active: boolean; created_at: string }

/** Select specific columns */
type SelectSpecificColumns = QueryResult<"SELECT id, name, email FROM users", BlogSchema>
// Result: { id: number; name: string; email: string }

/** Select single column */
type SelectSingleColumn = QueryResult<"SELECT email FROM users", BlogSchema>
// Result: { email: string }

// ============================================================================
// 2. Column Aliases
// ============================================================================

/** Columns with aliases */
type ColumnsWithAliases = QueryResult<
  "SELECT id AS user_id, name AS display_name FROM users",
  BlogSchema
>
// Result: { user_id: number; display_name: string }

/** Mixed aliased and non-aliased */
type MixedAliases = QueryResult<
  "SELECT id AS pk, name, email AS mail FROM users",
  BlogSchema
>
// Result: { pk: number; name: string; mail: string }

// ============================================================================
// 3. Table Aliases
// ============================================================================

/** Table alias with qualified columns */
type TableAliasQualified = QueryResult<
  "SELECT u.id, u.name FROM users AS u",
  BlogSchema
>
// Result: { id: number; name: string }

/** Alias without AS keyword */
type TableAliasNoAS = QueryResult<
  "SELECT u.id, u.email FROM users u",
  BlogSchema
>
// Result: { id: number; email: string }

// ============================================================================
// 4. Table Wildcards (table.*)
// ============================================================================

/** Single table wildcard */
type SingleTableWildcard = QueryResult<
  "SELECT u.* FROM users AS u",
  BlogSchema
>
// Result: { id: number; name: string; email: string; role: ...; is_active: boolean; created_at: string }

/** Multiple table wildcards with JOIN */
type MultipleTableWildcards = QueryResult<
  "SELECT u.*, p.* FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
  BlogSchema
>
// Result: All columns from both users and posts

// ============================================================================
// 5. JOIN Operations - Type Merging
// ============================================================================

/** INNER JOIN - columns from both tables */
type InnerJoinResult = QueryResult<
  "SELECT u.name, p.title FROM users AS u INNER JOIN posts AS p ON u.id = p.author_id",
  BlogSchema
>
// Result: { name: string; title: string }

/** LEFT JOIN - preserves nullable relationships */
type LeftJoinResult = QueryResult<
  "SELECT u.name, p.title, p.views FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
  BlogSchema
>
// Result: { name: string; title: string; views: number }

/** Multiple JOINs */
type MultipleJoinsResult = QueryResult<`
  SELECT u.name, p.title, c.content AS comment_text
  FROM users AS u
  INNER JOIN posts AS p ON u.id = p.author_id
  LEFT JOIN comments AS c ON p.id = c.post_id
`, BlogSchema>
// Result: { name: string; title: string; comment_text: string }

// ============================================================================
// 6. Aggregate Functions
// ============================================================================

/** COUNT returns number */
type CountResult = QueryResult<
  "SELECT COUNT ( * ) AS total FROM users",
  BlogSchema
>
// Result: { total: number }

/** SUM returns number */
type SumResult = QueryResult<
  "SELECT SUM ( views ) AS total_views FROM posts",
  BlogSchema
>
// Result: { total_views: number }

/** AVG returns number */
type AvgResult = QueryResult<
  "SELECT AVG ( views ) AS avg_views FROM posts",
  BlogSchema
>
// Result: { avg_views: number }

/** MIN preserves column type */
type MinResult = QueryResult<
  "SELECT MIN ( views ) AS min_views FROM posts",
  BlogSchema
>
// Result: { min_views: number }

/** MAX preserves column type */
type MaxResult = QueryResult<
  "SELECT MAX ( created_at ) AS latest FROM posts",
  BlogSchema
>
// Result: { latest: string }

/** Multiple aggregates */
type MultiAggregates = QueryResult<`
  SELECT 
    COUNT ( * ) AS count,
    SUM ( views ) AS total_views,
    AVG ( views ) AS avg_views,
    MIN ( views ) AS min_views,
    MAX ( views ) AS max_views
  FROM posts
`, BlogSchema>
// Result: { count: number; total_views: number; avg_views: number; min_views: number; max_views: number }

// ============================================================================
// 7. GROUP BY with Aggregates
// ============================================================================

/** Group by with aggregate */
type GroupByAggregate = QueryResult<`
  SELECT author_id, COUNT ( * ) AS post_count
  FROM posts
  GROUP BY author_id
`, BlogSchema>
// Result: { author_id: number; post_count: number }

/** Group by multiple columns */
type GroupByMultiple = QueryResult<`
  SELECT status, author_id, COUNT ( * ) AS count
  FROM posts
  GROUP BY status, author_id
`, BlogSchema>
// Result: { status: "draft" | "published" | "archived"; author_id: number; count: number }

// ============================================================================
// 8. PostgreSQL Type Casting
// ============================================================================

/** Cast to text - returns string */
type CastToText = QueryResult<
  "SELECT id::text AS id_str FROM users",
  BlogSchema
>
// Result: { id_str: string } - cast type determines result type

/** Cast in complex expression with parentheses */
type CastInExpr = QueryResult<
  "SELECT ( id ) ::text AS id_str FROM users",
  BlogSchema
>
// Result: { id_str: string } - cast type is preserved

/** Cast to integer - returns number */
type CastToInt = QueryResult<
  "SELECT views::integer AS int_views FROM posts",
  BlogSchema
>
// Result: { int_views: number } - cast to integer returns number

// ============================================================================
// 9. Union Types (Enum-like columns)
// ============================================================================

/** Union type preserved */
type UnionTypePreserved = QueryResult<
  "SELECT role FROM users",
  BlogSchema
>
// Result: { role: "admin" | "author" | "reader" }

/** Multiple union type columns */
type MultipleUnionTypes = QueryResult<
  "SELECT u.role, p.status FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id",
  BlogSchema
>
// Result: { role: "admin" | "author" | "reader"; status: "draft" | "published" | "archived" }

// ============================================================================
// 10. Nullable Columns
// ============================================================================

/** Nullable column preserved */
type NullableColumn = QueryResult<
  "SELECT published_at FROM posts",
  BlogSchema
>
// Result: { published_at: string | null }

/** Mix of nullable and non-nullable */
type MixedNullable = QueryResult<
  "SELECT title, published_at FROM posts",
  BlogSchema
>
// Result: { title: string; published_at: string | null }

// ============================================================================
// 11. Common Table Expressions (CTEs)
// ============================================================================

/** Simple CTE */
type SimpleCTE = QueryResult<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = TRUE
  )
  SELECT * FROM active_users
`, BlogSchema>
// Result: { id: number; name: string }

/** CTE with JOIN to regular table */
type CTEWithJoin = QueryResult<`
  WITH published_posts AS (
    SELECT id, author_id, title FROM posts WHERE status = 'published'
  )
  SELECT u.name, pp.title
  FROM users AS u
  INNER JOIN published_posts AS pp ON u.id = pp.author_id
`, BlogSchema>
// Result: { name: string; title: string }

/** Multiple CTEs */
type MultipleCTEs = QueryResult<`
  WITH 
    active_users AS (
      SELECT id, name FROM users WHERE is_active = TRUE
    ),
    post_counts AS (
      SELECT author_id, COUNT ( * ) AS post_count FROM posts GROUP BY author_id
    )
  SELECT au.name, pc.post_count
  FROM active_users AS au
  LEFT JOIN post_counts AS pc ON au.id = pc.author_id
`, BlogSchema>
// Result: { name: string; post_count: number }

// ============================================================================
// 12. Derived Tables (Subqueries in FROM)
// ============================================================================

/** Simple derived table */
type DerivedTableSimple = QueryResult<`
  SELECT sub.user_name, sub.post_count
  FROM (
    SELECT u.name AS user_name, COUNT ( p.id ) AS post_count
    FROM users AS u
    LEFT JOIN posts AS p ON u.id = p.author_id
    GROUP BY u.name
  ) AS sub
`, BlogSchema>
// Result: { user_name: string; post_count: number }

/** Derived table with filter */
type DerivedTableFiltered = QueryResult<`
  SELECT top_authors.name
  FROM (
    SELECT author_id, COUNT ( * ) AS cnt
    FROM posts
    GROUP BY author_id
  ) AS counts
  LEFT JOIN users AS top_authors ON top_authors.id = counts.author_id
  WHERE counts.cnt > 5
`, BlogSchema>
// Result: { name: string }

// ============================================================================
// 13. E-Commerce Schema Examples
// ============================================================================

/** Order with customer info */
type OrderWithCustomer = QueryResult<`
  SELECT 
    o.order_number,
    o.total_amount,
    u.email AS customer_email,
    u.first_name,
    u.last_name
  FROM orders AS o
  INNER JOIN users AS u ON o.user_id = u.id
`, ECommerceSchema>
// Result: { order_number: string; total_amount: number; customer_email: string; first_name: string | null; last_name: string | null }

/** Product with category and brand */
type ProductWithDetails = QueryResult<`
  SELECT 
    p.name AS product_name,
    p.price,
    p.status,
    c.name AS category_name,
    b.name AS brand_name
  FROM products AS p
  INNER JOIN categories AS c ON p.category_id = c.id
  LEFT JOIN brands AS b ON p.brand_id = b.id
`, ECommerceSchema>
// Result: { product_name: string; price: number; status: "draft" | "active" | "archived"; category_name: string; brand_name: string }

/** Order summary with aggregates */
type OrderSummary = QueryResult<`
  SELECT 
    user_id,
    COUNT ( * ) AS order_count,
    SUM ( total_amount ) AS total_spent,
    AVG ( total_amount ) AS avg_order,
    MAX ( created_at ) AS last_order
  FROM orders
  GROUP BY user_id
`, ECommerceSchema>
// Result: { user_id: number; order_count: number; total_spent: number; avg_order: number; last_order: string }

/** Review statistics */
type ReviewStats = QueryResult<`
  SELECT 
    product_id,
    COUNT ( * ) AS review_count,
    AVG ( rating ) AS avg_rating,
    MIN ( rating ) AS min_rating,
    MAX ( rating ) AS max_rating
  FROM reviews
  WHERE is_approved = TRUE
  GROUP BY product_id
  HAVING COUNT ( * ) >= 3
`, ECommerceSchema>
// Result: { product_id: number; review_count: number; avg_rating: number; min_rating: number; max_rating: number }

// ============================================================================
// 14. Error Detection
// ============================================================================

/** Unknown column produces error */
type UnknownColumnError = QueryResult<
  "SELECT unknown_column FROM users",
  BlogSchema
>
// Result: { unknown_column: MatchError<"Column 'unknown_column' not found in any table"> }

/** Unknown table produces error */
type UnknownTableError = QueryResult<
  "SELECT * FROM nonexistent_table",
  BlogSchema
>
// Result: MatchError<"Table 'nonexistent_table' not found in schema">

/** Wrong table qualifier */
type WrongQualifierError = QueryResult<
  "SELECT wrong_alias.id FROM users AS u",
  BlogSchema
>
// Result: { id: MatchError<"Table or alias 'wrong_alias' not found"> }

// ============================================================================
// 15. Query Validation
// ============================================================================

/** Valid query returns true */
type ValidQuery = ValidateSQL<"SELECT id, name FROM users", BlogSchema>
// Result: true

/** Invalid column returns error message */
type InvalidColumnValidation = ValidateSQL<
  "SELECT bad_column FROM users",
  BlogSchema
>
// Result: "Column 'bad_column' not found in any table"

/** Invalid table returns error message */
type InvalidTableValidation = ValidateSQL<
  "SELECT * FROM bad_table",
  BlogSchema
>
// Result: "Table 'bad_table' not found in schema"

// ============================================================================
// 16. Complex Real-World Queries
// ============================================================================

/** Customer order history */
type CustomerOrderHistory = QueryResult<`
  WITH customer_orders AS (
    SELECT 
      user_id,
      COUNT ( * ) AS total_orders,
      SUM ( total_amount ) AS lifetime_value,
      MAX ( created_at ) AS last_order_date
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY user_id
  )
  SELECT 
    u.email,
    u.first_name,
    u.last_name,
    u.status AS account_status,
    co.total_orders,
    co.lifetime_value,
    co.last_order_date
  FROM users AS u
  LEFT JOIN customer_orders AS co ON u.id = co.user_id
  WHERE u.role = 'customer'
  ORDER BY co.lifetime_value DESC
  LIMIT 100
`, ECommerceSchema>
// Result: { email: string; first_name: string | null; last_name: string | null; account_status: "active" | "suspended" | "deleted"; total_orders: number; lifetime_value: number; last_order_date: string }

/** Inventory report */
type InventoryReport = QueryResult<`
  SELECT 
    p.sku,
    p.name AS product_name,
    c.name AS category,
    w.name AS warehouse,
    i.quantity,
    i.reserved_quantity,
    i.reorder_level
  FROM inventory AS i
  INNER JOIN products AS p ON i.product_id = p.id
  INNER JOIN categories AS c ON p.category_id = c.id
  INNER JOIN warehouses AS w ON i.warehouse_id = w.id
  WHERE p.status = 'active' AND w.is_active = TRUE
  ORDER BY i.quantity ASC
`, ECommerceSchema>
// Result: { sku: string; product_name: string; category: string; warehouse: string; quantity: number; reserved_quantity: number; reorder_level: number | null }

// ============================================================================
// 17. camelCase Identifiers (quoted to preserve case)
// ============================================================================

import type { CamelCaseSchema } from "./schema.js"

// Note: In SQL, identifiers with uppercase letters must be quoted to preserve case.

/** camelCased columns - quoted to preserve case */
type CamelCaseColumns = QueryResult<
  'SELECT "firstName", "lastName", "emailAddress" FROM "userAccounts"',
  CamelCaseSchema
>
// Result: { firstName: string; lastName: string; emailAddress: string }

/** camelCased table with alias */
type CamelCaseWithAlias = QueryResult<
  'SELECT ua."firstName", ua."lastName", ua."isActive" FROM "userAccounts" AS ua',
  CamelCaseSchema
>
// Result: { firstName: string; lastName: string; isActive: boolean }

/** Mixed_Case columns */
type MixedCaseColumns = QueryResult<
  'SELECT "Account_Status", "Last_Login_Date" FROM "userAccounts"',
  CamelCaseSchema
>
// Result: { Account_Status: "active" | "suspended" | "deleted"; Last_Login_Date: string | null }

/** PascalCase table name */
type PascalCaseTable = QueryResult<
  'SELECT id, "unitPrice", "totalPrice", "Item_Status" FROM "OrderItems"',
  CamelCaseSchema
>
// Result: { id: number; unitPrice: number; totalPrice: number; Item_Status: "pending" | "shipped" | "delivered" }

/** Mixed_Case table name */
type MixedCaseTable = QueryResult<
  'SELECT "categoryName", "Display_Name", "Is_Active" FROM "Product_Categories"',
  CamelCaseSchema
>
// Result: { categoryName: string; Display_Name: string; Is_Active: boolean }

// ============================================================================
// 18. Quoted Identifiers
// ============================================================================

/** Quoted table with hyphen */
type QuotedTableHyphen = QueryResult<
  'SELECT id, userId, sessionToken FROM "user-sessions"',
  CamelCaseSchema
>
// Result: { id: number; userId: number; sessionToken: string }

/** Quoted columns with hyphens */
type QuotedColumnsHyphen = QueryResult<
  'SELECT "ip-address", "user-agent" FROM "user-sessions"',
  CamelCaseSchema
>
// Result: { "ip-address": string; "user-agent": string | null }

/** Quoted table with underscores */
type QuotedTableUnderscore = QueryResult<
  'SELECT id, action FROM "audit_logs"',
  CamelCaseSchema
>
// Result: { id: number; action: string }

/** Quoted columns with underscores */
type QuotedColumnsUnderscore = QueryResult<
  'SELECT "user_id", "entity_type" FROM "audit_logs"',
  CamelCaseSchema
>
// Result: { "user_id": number | null; "entity_type": string }

// Note: Quoted identifiers with spaces (e.g., "audit logs") are not supported
// because the tokenizer splits on spaces. Use hyphens or underscores instead.

// ============================================================================
// 19. camelCase with Aliases
// ============================================================================

/** Alias preserves case */
type AliasPreservesCase = QueryResult<
  'SELECT "firstName" AS "FirstName", "lastName" AS last_name FROM "userAccounts"',
  CamelCaseSchema
>
// Result: { FirstName: string; last_name: string }

/** Quoted alias with spaces */
type QuotedAliasSpaces = QueryResult<
  'SELECT "firstName" AS "First Name", "lastName" AS "Last Name" FROM "userAccounts"',
  CamelCaseSchema
>
// Result: { "First Name": string; "Last Name": string }

// ============================================================================
// 20. camelCase JOINs
// ============================================================================

/** JOIN with camelCase tables */
type CamelCaseJoin = QueryResult<`
  SELECT ua."firstName", ua."lastName", oi."unitPrice", oi."Item_Status"
  FROM "userAccounts" AS ua
  INNER JOIN "OrderItems" AS oi ON ua.id = oi."orderId"
`, CamelCaseSchema>
// Result: { firstName: string; lastName: string; unitPrice: number; Item_Status: "pending" | "shipped" | "delivered" }

/** JOIN with Mixed_Case table */
type MixedCaseJoin = QueryResult<`
  SELECT ua."firstName", pc."categoryName", pc."Display_Name"
  FROM "userAccounts" AS ua
  LEFT JOIN "Product_Categories" AS pc ON ua.id = pc.id
`, CamelCaseSchema>
// Result: { firstName: string; categoryName: string; Display_Name: string }

// ============================================================================
// 21. camelCase Aggregates
// ============================================================================

/** GROUP BY with camelCase */
type CamelCaseGroupBy = QueryResult<`
  SELECT "Account_Status", COUNT ( * ) AS "statusCount"
  FROM "userAccounts"
  GROUP BY "Account_Status"
`, CamelCaseSchema>
// Result: { Account_Status: "active" | "suspended" | "deleted"; statusCount: number }

/** Aggregate on camelCase column */
type CamelCaseAggregate = QueryResult<`
  SELECT 
    COUNT ( * ) AS "totalUsers",
    MIN ( "createdAt" ) AS "firstCreated",
    MAX ( "updatedAt" ) AS "lastUpdated"
  FROM "userAccounts"
`, CamelCaseSchema>
// Result: { totalUsers: number; firstCreated: string; lastUpdated: string }

// ============================================================================
// 22. Complex camelCase Queries
// ============================================================================

/** Full query with mixed identifiers (all properly quoted) */
type ComplexCamelCase = QueryResult<`
  SELECT 
    ua."firstName",
    ua."lastName",
    ua."Account_Status",
    ua."Last_Login_Date",
    oi."unitPrice",
    oi."Item_Status",
    pc."Display_Name" AS "categoryDisplay"
  FROM "userAccounts" AS ua
  LEFT JOIN "OrderItems" AS oi ON ua.id = oi."orderId"
  LEFT JOIN "Product_Categories" AS pc ON oi."productId" = pc.id
  WHERE ua."isActive" = TRUE
  ORDER BY ua."lastName" ASC
  LIMIT 20
`, CamelCaseSchema>
// Result: { firstName: string; lastName: string; Account_Status: "active" | "suspended" | "deleted"; Last_Login_Date: string | null; unitPrice: number; Item_Status: "pending" | "shipped" | "delivered"; categoryDisplay: string }

// ============================================================================
// Type Verification
// ============================================================================

// Ensure results are proper object types
type _AssertObject1 = SelectSpecificColumns extends { id: number; name: string; email: string } ? true : false
type _AssertObject2 = UnionTypePreserved extends { role: "admin" | "author" | "reader" } ? true : false

// Ensure validation works
type _AssertValid = ValidQuery extends true ? true : false

// Export for type checking
export type {
  SelectAllUsers,
  SelectSpecificColumns,
  ColumnsWithAliases,
  InnerJoinResult,
  CountResult,
  SimpleCTE,
  OrderWithCustomer,
  CustomerOrderHistory,
}

