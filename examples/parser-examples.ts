/**
 * Parser Examples
 * 
 * Comprehensive examples demonstrating all features supported by the SQL parser.
 * Each example shows the SQL query and the expected AST type.
 */

import type { ParseSQL, SQLQuery, SelectClause } from "../src/index.js"

// ============================================================================
// 1. Basic SELECT Queries
// ============================================================================

/** Simple SELECT * */
type BasicSelectAll = ParseSQL<"SELECT * FROM users">

/** SELECT specific columns */
type BasicSelectColumns = ParseSQL<"SELECT id, name, email FROM users">

/** SELECT with single column */
type BasicSelectSingle = ParseSQL<"SELECT id FROM users">

// ============================================================================
// 2. Column Aliases (AS keyword)
// ============================================================================

/** Column with alias using AS */
type AliasWithAS = ParseSQL<"SELECT id AS user_id, name AS user_name FROM users">

/** Multiple columns with mixed aliases */
type MixedAliases = ParseSQL<"SELECT id AS pk, name, email AS mail FROM users">

/** Alias with quoted identifier */
type QuotedAlias = ParseSQL<'SELECT id AS "User ID", name AS "Full Name" FROM users'>

// ============================================================================
// 3. Table Aliases
// ============================================================================

/** Table with alias using AS */
type TableAliasWithAS = ParseSQL<"SELECT u.id, u.name FROM users AS u">

/** Table with alias without AS */
type TableAliasNoAS = ParseSQL<"SELECT u.id, u.name FROM users u">

/** Quoted table name with alias */
type QuotedTableAlias = ParseSQL<'SELECT t."id" FROM "my-table" AS t'>

// ============================================================================
// 4. Table-Qualified Columns
// ============================================================================

/** Columns qualified with table name */
type QualifiedColumns = ParseSQL<"SELECT users.id, users.name FROM users">

/** Columns qualified with alias */
type QualifiedWithAlias = ParseSQL<"SELECT u.id, u.name, u.email FROM users AS u">

/** Mixed qualified and unqualified */
type MixedQualified = ParseSQL<"SELECT u.id, name, u.email FROM users AS u">

// ============================================================================
// 5. Table Wildcard (table.*)
// ============================================================================

/** Single table wildcard */
type SingleTableWildcard = ParseSQL<"SELECT u.* FROM users AS u">

/** Multiple table wildcards */
type MultiTableWildcard = ParseSQL<"SELECT u.*, p.* FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id">

/** Mixed wildcard and columns */
type MixedWildcard = ParseSQL<"SELECT u.*, p.title FROM users AS u LEFT JOIN posts AS p ON u.id = p.author_id">

// ============================================================================
// 6. DISTINCT Keyword
// ============================================================================

/** SELECT DISTINCT */
type SelectDistinct = ParseSQL<"SELECT DISTINCT role FROM users">

/** DISTINCT with multiple columns */
type DistinctMultiple = ParseSQL<"SELECT DISTINCT status, role FROM users">

/** DISTINCT with all columns */
type DistinctAll = ParseSQL<"SELECT DISTINCT * FROM users">

// ============================================================================
// 7. WHERE Clause - Comparison Operators
// ============================================================================

/** Equality comparison */
type WhereEquals = ParseSQL<"SELECT * FROM users WHERE id = 1">

/** Not equal */
type WhereNotEqual = ParseSQL<"SELECT * FROM users WHERE status != 'deleted'">

/** Not equal alternative */
type WhereNotEqualAlt = ParseSQL<"SELECT * FROM users WHERE status <> 'deleted'">

/** Greater than */
type WhereGreater = ParseSQL<"SELECT * FROM products WHERE price > 100">

/** Less than */
type WhereLess = ParseSQL<"SELECT * FROM products WHERE quantity < 10">

/** Greater than or equal */
type WhereGreaterEqual = ParseSQL<"SELECT * FROM orders WHERE total_amount >= 50">

/** Less than or equal */
type WhereLessEqual = ParseSQL<"SELECT * FROM inventory WHERE quantity <= 5">

/** LIKE operator */
type WhereLike = ParseSQL<"SELECT * FROM users WHERE email LIKE '%@gmail.com'">

/** ILIKE operator (case insensitive) */
type WhereILike = ParseSQL<"SELECT * FROM users WHERE name ILIKE '%john%'">

/** IS NULL */
type WhereIsNull = ParseSQL<"SELECT * FROM users WHERE last_login_at IS NULL">

/** IS NOT NULL */
type WhereIsNotNull = ParseSQL<"SELECT * FROM users WHERE email_verified IS NOT NULL">

/** Boolean comparison */
type WhereBoolTrue = ParseSQL<"SELECT * FROM users WHERE is_active = TRUE">

/** Boolean false */
type WhereBoolFalse = ParseSQL<"SELECT * FROM products WHERE is_featured = FALSE">

// ============================================================================
// 8. WHERE Clause - Logical Operators
// ============================================================================

/** AND operator */
type WhereAnd = ParseSQL<"SELECT * FROM users WHERE role = 'admin' AND is_active = TRUE">

/** OR operator */
type WhereOr = ParseSQL<"SELECT * FROM users WHERE role = 'admin' OR role = 'moderator'">

/** Combined AND/OR */
type WhereAndOr = ParseSQL<"SELECT * FROM users WHERE status = 'active' AND role = 'admin' OR role = 'moderator'">

/** Multiple conditions */
type WhereMultiple = ParseSQL<"SELECT * FROM products WHERE price > 10 AND price < 100 AND status = 'active'">

// ============================================================================
// 9. JOIN Types
// ============================================================================

/** INNER JOIN */
type InnerJoin = ParseSQL<"SELECT u.name, o.total_amount FROM users AS u INNER JOIN orders AS o ON u.id = o.user_id">

/** LEFT JOIN */
type LeftJoin = ParseSQL<"SELECT u.name, o.total_amount FROM users AS u LEFT JOIN orders AS o ON u.id = o.user_id">

/** RIGHT JOIN */
type RightJoin = ParseSQL<"SELECT u.name, o.total_amount FROM users AS u RIGHT JOIN orders AS o ON u.id = o.user_id">

/** FULL JOIN */
type FullJoin = ParseSQL<"SELECT u.name, o.total_amount FROM users AS u FULL JOIN orders AS o ON u.id = o.user_id">

/** CROSS JOIN */
type CrossJoin = ParseSQL<"SELECT p.name, c.name AS category FROM products AS p CROSS JOIN categories AS c">

/** LEFT OUTER JOIN */
type LeftOuterJoin = ParseSQL<"SELECT u.name, o.id FROM users AS u LEFT OUTER JOIN orders AS o ON u.id = o.user_id">

/** RIGHT OUTER JOIN */
type RightOuterJoin = ParseSQL<"SELECT u.name, o.id FROM users AS u RIGHT OUTER JOIN orders AS o ON u.id = o.user_id">

/** FULL OUTER JOIN */
type FullOuterJoin = ParseSQL<"SELECT u.name, o.id FROM users AS u FULL OUTER JOIN orders AS o ON u.id = o.user_id">

/** Plain JOIN (treated as INNER) */
type PlainJoin = ParseSQL<"SELECT u.name, o.id FROM users AS u JOIN orders AS o ON u.id = o.user_id">

// ============================================================================
// 10. Multiple JOINs
// ============================================================================

/** Two JOINs */
type TwoJoins = ParseSQL<`
  SELECT u.name, o.order_number, p.name AS product_name
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
  LEFT JOIN order_items AS oi ON o.id = oi.order_id
`>

/** Three JOINs */
type ThreeJoins = ParseSQL<`
  SELECT u.name, o.total_amount, p.name, oi.quantity
  FROM users AS u
  INNER JOIN orders AS o ON u.id = o.user_id
  INNER JOIN order_items AS oi ON o.id = oi.order_id
  INNER JOIN products AS p ON oi.product_id = p.id
`>

/** Mixed JOIN types */
type MixedJoins = ParseSQL<`
  SELECT u.name, o.id, r.rating
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
  INNER JOIN reviews AS r ON u.id = r.user_id
`>

// ============================================================================
// 11. ORDER BY Clause
// ============================================================================

/** Simple ORDER BY (default ASC) */
type OrderByDefault = ParseSQL<"SELECT * FROM users ORDER BY name">

/** ORDER BY ASC explicit */
type OrderByAsc = ParseSQL<"SELECT * FROM products ORDER BY price ASC">

/** ORDER BY DESC */
type OrderByDesc = ParseSQL<"SELECT * FROM products ORDER BY price DESC">

/** Multiple ORDER BY columns */
type OrderByMultiple = ParseSQL<"SELECT * FROM users ORDER BY role ASC, name DESC">

/** ORDER BY with table qualifier */
type OrderByQualified = ParseSQL<"SELECT u.* FROM users AS u ORDER BY u.created_at DESC">

// ============================================================================
// 12. GROUP BY Clause
// ============================================================================

/** Simple GROUP BY */
type GroupBySimple = ParseSQL<"SELECT role, COUNT ( * ) AS count FROM users GROUP BY role">

/** GROUP BY multiple columns */
type GroupByMultiple = ParseSQL<"SELECT status, role, COUNT ( * ) FROM users GROUP BY status, role">

/** GROUP BY with qualified column */
type GroupByQualified = ParseSQL<"SELECT u.role, COUNT ( * ) FROM users AS u GROUP BY u.role">

// ============================================================================
// 13. HAVING Clause
// ============================================================================

/** GROUP BY with HAVING */
type GroupByHaving = ParseSQL<"SELECT role, COUNT ( * ) AS cnt FROM users GROUP BY role HAVING COUNT ( * ) > 5">

/** HAVING with column alias (not standard but common) */
type HavingCondition = ParseSQL<"SELECT category_id, AVG ( price ) AS avg_price FROM products GROUP BY category_id HAVING AVG ( price ) > 100">

// ============================================================================
// 14. LIMIT and OFFSET
// ============================================================================

/** LIMIT only */
type LimitOnly = ParseSQL<"SELECT * FROM products LIMIT 10">

/** LIMIT and OFFSET */
type LimitOffset = ParseSQL<"SELECT * FROM products LIMIT 10 OFFSET 20">

/** OFFSET only (PostgreSQL style) */
type OffsetOnly = ParseSQL<"SELECT * FROM products OFFSET 5">

/** With ORDER BY and LIMIT */
type OrderByLimit = ParseSQL<"SELECT * FROM products ORDER BY price DESC LIMIT 5">

/** Full pagination */
type FullPagination = ParseSQL<"SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 40">

// ============================================================================
// 15. Aggregate Functions
// ============================================================================

/** COUNT(*) */
type AggCount = ParseSQL<"SELECT COUNT ( * ) AS total FROM users">

/** COUNT with column */
type AggCountColumn = ParseSQL<"SELECT COUNT ( email ) AS email_count FROM users">

/** SUM */
type AggSum = ParseSQL<"SELECT SUM ( total_amount ) AS revenue FROM orders">

/** AVG */
type AggAvg = ParseSQL<"SELECT AVG ( price ) AS average_price FROM products">

/** MIN */
type AggMin = ParseSQL<"SELECT MIN ( price ) AS lowest_price FROM products">

/** MAX */
type AggMax = ParseSQL<"SELECT MAX ( price ) AS highest_price FROM products">

/** Multiple aggregates */
type AggMultiple = ParseSQL<`
  SELECT 
    COUNT ( * ) AS total_orders,
    SUM ( total_amount ) AS total_revenue,
    AVG ( total_amount ) AS avg_order,
    MIN ( total_amount ) AS min_order,
    MAX ( total_amount ) AS max_order
  FROM orders
`>

/** Aggregate with GROUP BY */
type AggWithGroupBy = ParseSQL<`
  SELECT 
    user_id,
    COUNT ( * ) AS order_count,
    SUM ( total_amount ) AS total_spent
  FROM orders
  GROUP BY user_id
`>

// ============================================================================
// 16. PostgreSQL Type Casting (::type)
// ============================================================================

/** Simple cast - strips cast, uses column type */
type SimpleCast = ParseSQL<"SELECT id::text AS id_text FROM users">

/** Cast in parenthesized expression - preserves cast type */
type CastInParens = ParseSQL<"SELECT ( id ) ::text AS id_text FROM users">

/** Cast to integer */
type CastToInt = ParseSQL<"SELECT price::integer AS int_price FROM products">

/** Cast to boolean */
type CastToBool = ParseSQL<"SELECT is_active::boolean AS active FROM users">

/** Cast in expression context */
type CastInExpr = ParseSQL<"SELECT created_at::date AS created_date FROM orders">

// ============================================================================
// 17. JSON Operators (PostgreSQL)
// ============================================================================

/** JSON arrow operator (->) */
type JsonArrow = ParseSQL<"SELECT data->'name' AS name FROM documents">

/** JSON double arrow operator (->>) */
type JsonDoubleArrow = ParseSQL<"SELECT data->>'email' AS email FROM documents">

/** JSON path operator (#>) */
type JsonPath = ParseSQL<"SELECT metadata#>'{user,preferences}' AS prefs FROM events">

/** JSON path text operator (#>>) */
type JsonPathText = ParseSQL<"SELECT metadata#>>'{user,name}' AS user_name FROM events">

/** Nested JSON with cast */
type JsonWithCast = ParseSQL<"SELECT ( data->'count' ) ::integer AS count FROM documents">

// ============================================================================
// 18. Complex Expressions
// ============================================================================

/** Parenthesized expression */
type ParenExpr = ParseSQL<"SELECT ( price * quantity ) AS total FROM order_items">

/** Function call */
type FunctionCall = ParseSQL<"SELECT COALESCE ( first_name, username ) AS display_name FROM users">

/** Nested function */
type NestedFunction = ParseSQL<"SELECT UPPER ( TRIM ( name ) ) AS clean_name FROM products">

/** CASE expression (complex expr) */
type CaseExpr = ParseSQL<"SELECT CASE WHEN price > 100 THEN 'expensive' ELSE 'cheap' END AS price_tier FROM products">

// ============================================================================
// 19. WITH Clause (Common Table Expressions / CTEs)
// ============================================================================

/** Simple CTE */
type SimpleCTE = ParseSQL<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = TRUE
  )
  SELECT * FROM active_users
`>

/** CTE with join */
type CTEWithJoin = ParseSQL<`
  WITH recent_orders AS (
    SELECT * FROM orders WHERE created_at > '2024-01-01'
  )
  SELECT u.name, ro.total_amount
  FROM users AS u
  INNER JOIN recent_orders AS ro ON u.id = ro.user_id
`>

/** Multiple CTEs */
type MultipleCTEs = ParseSQL<`
  WITH 
    active_users AS (
      SELECT id, name FROM users WHERE is_active = TRUE
    ),
    user_orders AS (
      SELECT user_id, COUNT ( * ) AS order_count FROM orders GROUP BY user_id
    )
  SELECT au.name, uo.order_count
  FROM active_users AS au
  LEFT JOIN user_orders AS uo ON au.id = uo.user_id
`>

// ============================================================================
// 20. Derived Tables (Subqueries in FROM)
// ============================================================================

/** Simple derived table */
type DerivedTable = ParseSQL<`
  SELECT sub.name, sub.order_count
  FROM (
    SELECT u.name, COUNT ( o.id ) AS order_count
    FROM users AS u
    LEFT JOIN orders AS o ON u.id = o.user_id
    GROUP BY u.name
  ) AS sub
`>

/** Derived table with filtering */
type DerivedTableFiltered = ParseSQL<`
  SELECT top_customers.name
  FROM (
    SELECT user_id, SUM ( total_amount ) AS total
    FROM orders
    GROUP BY user_id
  ) AS top_customers
  LEFT JOIN users ON users.id = top_customers.user_id
  WHERE top_customers.total > 1000
`>

// ============================================================================
// 21. Scalar Subqueries (in SELECT)
// ============================================================================

/** Scalar subquery */
type ScalarSubquery = ParseSQL<`
  SELECT 
    name,
    ( SELECT COUNT ( * ) FROM orders WHERE orders.user_id = users.id ) AS order_count
  FROM users
`>

/** Scalar subquery with cast */
type ScalarSubqueryCast = ParseSQL<`
  SELECT 
    name,
    ( SELECT MAX ( total_amount ) FROM orders WHERE orders.user_id = users.id )::numeric AS max_order
  FROM users
`>

// ============================================================================
// 22. Complex Real-World Queries
// ============================================================================

/** E-commerce order summary */
type EcommerceOrderSummary = ParseSQL<`
  SELECT 
    u.name AS customer_name,
    u.email,
    COUNT ( o.id ) AS total_orders,
    SUM ( o.total_amount ) AS lifetime_value,
    MAX ( o.created_at ) AS last_order_date
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
  WHERE u.status = 'active'
  GROUP BY u.id, u.name, u.email
  HAVING COUNT ( o.id ) > 0
  ORDER BY lifetime_value DESC
  LIMIT 100
`>

/** Product inventory report */
type InventoryReport = ParseSQL<`
  SELECT 
    p.name AS product_name,
    p.sku,
    c.name AS category,
    SUM ( i.quantity ) AS total_stock,
    MIN ( i.quantity ) AS min_stock
  FROM products AS p
  INNER JOIN categories AS c ON p.category_id = c.id
  LEFT JOIN inventory AS i ON p.id = i.product_id
  WHERE p.status = 'active'
  GROUP BY p.id, p.name, p.sku, c.name
  ORDER BY total_stock ASC
  LIMIT 50
`>

/** User activity dashboard */
type UserActivityDashboard = ParseSQL<`
  WITH user_stats AS (
    SELECT 
      user_id,
      COUNT ( * ) AS order_count,
      SUM ( total_amount ) AS total_spent
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY user_id
  )
  SELECT 
    u.name,
    u.email,
    u.role,
    us.order_count,
    us.total_spent,
    r.rating AS latest_review_rating
  FROM users AS u
  LEFT JOIN user_stats AS us ON u.id = us.user_id
  LEFT JOIN reviews AS r ON u.id = r.user_id
  WHERE u.status = 'active'
  ORDER BY us.total_spent DESC
  LIMIT 20
  OFFSET 0
`>

// ============================================================================
// 23. Edge Cases
// ============================================================================

/** Empty column list edge case - should error */
// type EmptyColumns = ParseSQL<"SELECT FROM users"> // Would produce error

/** Reserved words as identifiers (quoted) */
type ReservedWordsQuoted = ParseSQL<'SELECT "select", "from", "where" FROM "table"'>

/** Numeric column names (quoted) */
type NumericColumnNames = ParseSQL<'SELECT "123", "456" AS col FROM data'>

/** Very long column alias */
type LongAlias = ParseSQL<"SELECT id AS this_is_a_very_long_alias_name_for_testing FROM users">

/** Mixed case keywords (normalized) */
type MixedCaseKeywords = ParseSQL<"select id from users where name = 'test' order by id limit 10">

// ============================================================================
// 24. camelCase and Mixed_Case Identifiers
// ============================================================================

// Note: In SQL, identifiers with uppercase letters must be quoted to preserve case.
// Unquoted identifiers are typically lowercased by the database.

/** camelCased column names (quoted to preserve case) */
type CamelCaseColumns = ParseSQL<'SELECT "firstName", "lastName", "emailAddress" FROM "userAccounts"'>

/** camelCased table and column names */
type CamelCaseTableAndColumns = ParseSQL<'SELECT ua."firstName", ua."lastName" FROM "userAccounts" AS ua'>

/** Mixed_Case column names */
type MixedCaseColumns = ParseSQL<'SELECT "Account_Status", "Last_Login_Date" FROM "userAccounts"'>

/** Mixed_Case table name */
type MixedCaseTable = ParseSQL<'SELECT id, "categoryName" FROM "Product_Categories"'>

/** PascalCase table name */
type PascalCaseTable = ParseSQL<'SELECT oi."unitPrice", oi."Item_Status" FROM "OrderItems" AS oi'>

/** Mixed identifiers with aliases (preserves alias case) */
type MixedWithAliases = ParseSQL<'SELECT "firstName" AS "FirstName", "lastName" AS last_name FROM "userAccounts"'>

// ============================================================================
// 25. Quoted Identifiers
// ============================================================================

/** Quoted column names */
type QuotedColumns = ParseSQL<'SELECT "firstName", "lastName" FROM users'>

/** Quoted table name */
type QuotedTable = ParseSQL<'SELECT id, name FROM "user-sessions"'>

/** Quoted table and columns */
type QuotedTableAndColumns = ParseSQL<'SELECT "ip-address", "user-agent" FROM "user-sessions"'>

/** Quoted identifiers with underscores */
type QuotedWithUnderscores = ParseSQL<'SELECT "user_id", action, "entity_type" FROM "audit_logs"'>

// Note: Quoted identifiers with spaces (e.g., "audit logs") are not supported
// because the tokenizer splits on spaces. Use hyphens or underscores instead.

/** Quoted alias with spaces */
type QuotedAliasWithSpaces = ParseSQL<'SELECT firstName AS "First Name", lastName AS "Last Name" FROM userAccounts'>

/** Mixed quoted and unquoted */
type MixedQuoted = ParseSQL<'SELECT id, "firstName", lastName AS "family name" FROM userAccounts'>

/** Quoted table alias reference */
type QuotedTableAliasRef = ParseSQL<'SELECT u."firstName" FROM userAccounts AS "u"'>

/** Quoted with table qualifier */
type QuotedQualified = ParseSQL<'SELECT "userAccounts"."firstName", "userAccounts"."lastName" FROM "userAccounts"'>

// ============================================================================
// 26. Complex camelCase Queries (with proper quoting)
// ============================================================================

/** JOIN with camelCase */
type CamelCaseJoin = ParseSQL<`
  SELECT ua."firstName", ua."lastName", oi."unitPrice", oi."totalPrice"
  FROM "userAccounts" AS ua
  INNER JOIN "OrderItems" AS oi ON ua.id = oi."orderId"
`>

/** GROUP BY with camelCase */
type CamelCaseGroupBy = ParseSQL<`
  SELECT "Account_Status", COUNT ( * ) AS "statusCount"
  FROM "userAccounts"
  GROUP BY "Account_Status"
`>

/** ORDER BY with camelCase */
type CamelCaseOrderBy = ParseSQL<'SELECT "firstName", "lastName" FROM "userAccounts" ORDER BY "lastName" ASC, "firstName" DESC'>

/** CTE with camelCase */
type CamelCaseCTE = ParseSQL<`
  WITH "activeUsers" AS (
    SELECT id, "firstName", "lastName" FROM "userAccounts" WHERE "isActive" = TRUE
  )
  SELECT "firstName", "lastName" FROM "activeUsers"
`>

/** Complex query with mixed case */
type ComplexMixedCase = ParseSQL<`
  SELECT 
    ua."firstName",
    ua."lastName",
    ua."Account_Status",
    pc."categoryName",
    pc."Display_Name"
  FROM "userAccounts" AS ua
  LEFT JOIN "Product_Categories" AS pc ON ua.id = pc.id
  WHERE ua."isActive" = TRUE AND pc."Is_Active" = TRUE
  ORDER BY ua."lastName" ASC
  LIMIT 10
`>

// ============================================================================
// Type Verification Helpers
// ============================================================================

/**
 * Helper to verify a query parses successfully
 */
type AssertParses<T extends SQLQuery> = T

/**
 * Helper to verify a query parses to a specific select clause
 */
type AssertSelectClause<T extends SQLQuery<SelectClause>> = T

// Verify some queries parse correctly
type _Verify1 = AssertParses<BasicSelectAll>
type _Verify2 = AssertParses<WhereEquals>
type _Verify3 = AssertParses<LeftJoin>
type _Verify4 = AssertParses<AggWithGroupBy>
type _Verify5 = AssertParses<SimpleCTE>

