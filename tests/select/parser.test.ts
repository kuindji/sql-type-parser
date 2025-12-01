/**
 * Parser Type Tests
 *
 * Tests for the ParseSQL type and related parsing functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    SelectClause,
    ColumnRef,
    TableRef,
    DerivedTableRef,
    TableColumnRef,
    UnboundColumnRef,
    TableWildcard,
    ComplexExpr,
    SubqueryExpr,
    JoinClause,
    OrderByItem,
    AggregateExpr,
    CTEDefinition,
    UnparsedExpr,
    ParsedCondition,
    ParseError,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsParseError } from "../helpers.js"

// ============================================================================
// Basic SELECT Tests
// ============================================================================

// Test: SELECT * FROM table
type P_SelectAll = ParseSQL<"SELECT * FROM users">
type _P1 = RequireTrue<AssertExtends<P_SelectAll, SQLSelectQuery>>

// Test: SELECT * has columns: "*"
type P_SelectAll_Columns = P_SelectAll extends SQLSelectQuery<infer Q>
    ? Q extends { columns: "*" }
        ? true
        : false
    : false
type _P1a = RequireTrue<P_SelectAll_Columns>

// Test: Single column SELECT
type P_SingleCol = ParseSQL<"SELECT id FROM users">
type _P2 = RequireTrue<AssertExtends<P_SingleCol, SQLSelectQuery>>

// Test: Multiple columns SELECT
type P_MultiCol = ParseSQL<"SELECT id, name, email FROM users">
type P_MultiCol_Columns = P_MultiCol extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef, ColumnRef, ColumnRef] }
        ? true
        : false
    : false
type _P3 = RequireTrue<P_MultiCol_Columns>

// Test: SELECT with column alias (AS)
type P_ColAlias = ParseSQL<"SELECT id AS user_id FROM users">
type P_ColAlias_Check = P_ColAlias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<UnboundColumnRef<"id">, "user_id">] }
        ? true
        : false
    : false
type _P4 = RequireTrue<P_ColAlias_Check>

// Test: SELECT with table alias
type P_TableAlias = ParseSQL<"SELECT u.id FROM users AS u">
type P_TableAlias_Check = P_TableAlias extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"users", "u", undefined> }
        ? true
        : false
    : false
type _P5 = RequireTrue<P_TableAlias_Check>

// Test: SELECT with table.column reference
type P_TableCol = ParseSQL<"SELECT u.id FROM users AS u">
type P_TableCol_Check = P_TableCol extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<TableColumnRef<"u", "id", undefined>, "id">] }
        ? true
        : false
    : false
type _P6 = RequireTrue<P_TableCol_Check>

// ============================================================================
// DISTINCT Tests
// ============================================================================

// Test: DISTINCT sets distinct: true
type P_Distinct = ParseSQL<"SELECT DISTINCT role FROM users">
type P_Distinct_Check = P_Distinct extends SQLSelectQuery<infer Q>
    ? Q extends { distinct: true }
        ? true
        : false
    : false
type _P7 = RequireTrue<P_Distinct_Check>

// Test: Without DISTINCT has distinct: false
type P_NoDistinct = ParseSQL<"SELECT role FROM users">
type P_NoDistinct_Check = P_NoDistinct extends SQLSelectQuery<infer Q>
    ? Q extends { distinct: false }
        ? true
        : false
    : false
type _P8 = RequireTrue<P_NoDistinct_Check>

// ============================================================================
// Table Reference Tests
// ============================================================================

// Test: Simple table reference
type P_SimpleTable = ParseSQL<"SELECT * FROM products">
type P_SimpleTable_Check = P_SimpleTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"products", "products", undefined> }
        ? true
        : false
    : false
type _P9 = RequireTrue<P_SimpleTable_Check>

// Test: Table with schema prefix
type P_SchemaTable = ParseSQL<"SELECT * FROM public.users">
type P_SchemaTable_Check = P_SchemaTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"users", "users", "public"> }
        ? true
        : false
    : false
type _P10 = RequireTrue<P_SchemaTable_Check>

// Test: Quoted table name
type P_QuotedTable = ParseSQL<'SELECT * FROM "UserAccounts"'>
type P_QuotedTable_Check = P_QuotedTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"UserAccounts", "UserAccounts", undefined> }
        ? true
        : false
    : false
type _P11 = RequireTrue<P_QuotedTable_Check>

// Test: Quoted table with schema
type P_QuotedSchemaTable = ParseSQL<'SELECT * FROM "mySchema"."MyTable"'>
type P_QuotedSchemaTable_Check = P_QuotedSchemaTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: TableRef<"MyTable", "MyTable", "mySchema"> }
        ? true
        : false
    : false
type _P12 = RequireTrue<P_QuotedSchemaTable_Check>

// ============================================================================
// JOIN Tests
// ============================================================================

// Test: INNER JOIN
type P_InnerJoin = ParseSQL<"SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id">
type P_InnerJoin_Check = P_InnerJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"INNER", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P13 = RequireTrue<P_InnerJoin_Check>

// Test: LEFT JOIN
type P_LeftJoin = ParseSQL<"SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id">
type P_LeftJoin_Check = P_LeftJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"LEFT", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P14 = RequireTrue<P_LeftJoin_Check>

// Test: RIGHT JOIN
type P_RightJoin = ParseSQL<"SELECT * FROM users RIGHT JOIN orders ON users.id = orders.user_id">
type P_RightJoin_Check = P_RightJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"RIGHT", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P15 = RequireTrue<P_RightJoin_Check>

// Test: FULL OUTER JOIN
type P_FullJoin = ParseSQL<"SELECT * FROM users FULL OUTER JOIN orders ON users.id = orders.user_id">
type P_FullJoin_Check = P_FullJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"FULL OUTER", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P16 = RequireTrue<P_FullJoin_Check>

// Test: LEFT OUTER JOIN
type P_LeftOuterJoin = ParseSQL<"SELECT * FROM users LEFT OUTER JOIN orders ON users.id = orders.user_id">
type P_LeftOuterJoin_Check = P_LeftOuterJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"LEFT OUTER", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P17 = RequireTrue<P_LeftOuterJoin_Check>

// Test: Multiple JOINs
type P_MultiJoin = ParseSQL<`
  SELECT u.id 
  FROM users AS u 
  LEFT JOIN orders AS o ON u.id = o.user_id
  LEFT JOIN products AS p ON o.product_id = p.id
`>
type P_MultiJoin_Check = P_MultiJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause, JoinClause] }
        ? true
        : false
    : false
type _P18 = RequireTrue<P_MultiJoin_Check>

// Test: Plain JOIN (treated as INNER)
type P_PlainJoin = ParseSQL<"SELECT * FROM users JOIN orders ON users.id = orders.user_id">
type P_PlainJoin_Check = P_PlainJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"INNER", TableRef, ParsedCondition>] }
        ? true
        : false
    : false
type _P19 = RequireTrue<P_PlainJoin_Check>

// ============================================================================
// WHERE Clause Tests
// ============================================================================

// Test: WHERE clause is parsed
type P_Where = ParseSQL<"SELECT * FROM users WHERE id = 1">
type P_Where_Check = P_Where extends SQLSelectQuery<infer Q>
    ? Q extends { where: object }
        ? true
        : false
    : false
type _P20 = RequireTrue<P_Where_Check>

// Test: Without WHERE
type P_NoWhere = ParseSQL<"SELECT * FROM users">
type P_NoWhere_Check = P_NoWhere extends SQLSelectQuery<infer Q>
    ? Q extends { where: undefined }
        ? true
        : false
    : false
type _P21 = RequireTrue<P_NoWhere_Check>

// ============================================================================
// ORDER BY Tests
// ============================================================================

// Test: ORDER BY default (ASC)
type P_OrderBy = ParseSQL<"SELECT * FROM users ORDER BY name">
type P_OrderBy_Check = P_OrderBy extends SQLSelectQuery<infer Q>
    ? Q extends { orderBy: [OrderByItem<any, "ASC">] }
        ? true
        : false
    : false
type _P22 = RequireTrue<P_OrderBy_Check>

// Test: ORDER BY DESC
type P_OrderByDesc = ParseSQL<"SELECT * FROM users ORDER BY created_at DESC">
type P_OrderByDesc_Check = P_OrderByDesc extends SQLSelectQuery<infer Q>
    ? Q extends { orderBy: [OrderByItem<any, "DESC">] }
        ? true
        : false
    : false
type _P23 = RequireTrue<P_OrderByDesc_Check>

// Test: ORDER BY ASC explicit
type P_OrderByAsc = ParseSQL<"SELECT * FROM users ORDER BY name ASC">
type P_OrderByAsc_Check = P_OrderByAsc extends SQLSelectQuery<infer Q>
    ? Q extends { orderBy: [OrderByItem<any, "ASC">] }
        ? true
        : false
    : false
type _P24 = RequireTrue<P_OrderByAsc_Check>

// Test: Multiple ORDER BY columns
type P_MultiOrder = ParseSQL<"SELECT * FROM users ORDER BY role DESC, name ASC">
type P_MultiOrder_Check = P_MultiOrder extends SQLSelectQuery<infer Q>
    ? Q extends { orderBy: [OrderByItem<any, "DESC">, OrderByItem<any, "ASC">] }
        ? true
        : false
    : false
type _P25 = RequireTrue<P_MultiOrder_Check>

// Test: Without ORDER BY
type P_NoOrderBy = ParseSQL<"SELECT * FROM users">
type P_NoOrderBy_Check = P_NoOrderBy extends SQLSelectQuery<infer Q>
    ? Q extends { orderBy: undefined }
        ? true
        : false
    : false
type _P26 = RequireTrue<P_NoOrderBy_Check>

// ============================================================================
// GROUP BY Tests
// ============================================================================

// Test: GROUP BY single column
type P_GroupBy = ParseSQL<"SELECT role, COUNT ( * ) FROM users GROUP BY role">
type P_GroupBy_Check = P_GroupBy extends SQLSelectQuery<infer Q>
    ? Q extends { groupBy: [UnboundColumnRef<"role">] }
        ? true
        : false
    : false
type _P27 = RequireTrue<P_GroupBy_Check>

// Test: GROUP BY multiple columns
type P_GroupByMulti = ParseSQL<"SELECT role, status FROM users GROUP BY role, status">
type P_GroupByMulti_Check = P_GroupByMulti extends SQLSelectQuery<infer Q>
    ? Q extends { groupBy: [UnboundColumnRef<"role">, UnboundColumnRef<"status">] }
        ? true
        : false
    : false
type _P28 = RequireTrue<P_GroupByMulti_Check>

// Test: Without GROUP BY
type P_NoGroupBy = ParseSQL<"SELECT * FROM users">
type P_NoGroupBy_Check = P_NoGroupBy extends SQLSelectQuery<infer Q>
    ? Q extends { groupBy: undefined }
        ? true
        : false
    : false
type _P29 = RequireTrue<P_NoGroupBy_Check>

// ============================================================================
// HAVING Tests
// ============================================================================

// Test: HAVING clause
type P_Having = ParseSQL<"SELECT role, COUNT ( * ) FROM users GROUP BY role HAVING COUNT ( * ) > 5">
type P_Having_Check = P_Having extends SQLSelectQuery<infer Q>
    ? Q extends { having: object }
        ? true
        : false
    : false
type _P30 = RequireTrue<P_Having_Check>

// Test: Without HAVING
type P_NoHaving = ParseSQL<"SELECT * FROM users GROUP BY role">
type P_NoHaving_Check = P_NoHaving extends SQLSelectQuery<infer Q>
    ? Q extends { having: undefined }
        ? true
        : false
    : false
type _P31 = RequireTrue<P_NoHaving_Check>

// ============================================================================
// LIMIT / OFFSET Tests
// ============================================================================

// Test: LIMIT
type P_Limit = ParseSQL<"SELECT * FROM users LIMIT 10">
type P_Limit_Check = P_Limit extends SQLSelectQuery<infer Q>
    ? Q extends { limit: 10 }
        ? true
        : false
    : false
type _P32 = RequireTrue<P_Limit_Check>

// Test: LIMIT and OFFSET
type P_LimitOffset = ParseSQL<"SELECT * FROM users LIMIT 10 OFFSET 20">
type P_LimitOffset_Limit = P_LimitOffset extends SQLSelectQuery<infer Q>
    ? Q extends { limit: 10 }
        ? true
        : false
    : false
type P_LimitOffset_Offset = P_LimitOffset extends SQLSelectQuery<infer Q>
    ? Q extends { offset: 20 }
        ? true
        : false
    : false
type _P33 = RequireTrue<P_LimitOffset_Limit>
type _P34 = RequireTrue<P_LimitOffset_Offset>

// Test: Only OFFSET (without LIMIT)
type P_OnlyOffset = ParseSQL<"SELECT * FROM users OFFSET 5">
type P_OnlyOffset_Offset = P_OnlyOffset extends SQLSelectQuery<infer Q>
    ? Q extends { offset: 5 }
        ? true
        : false
    : false
type P_OnlyOffset_Limit = P_OnlyOffset extends SQLSelectQuery<infer Q>
    ? Q extends { limit: undefined }
        ? true
        : false
    : false
type _P35 = RequireTrue<P_OnlyOffset_Offset>
type _P36 = RequireTrue<P_OnlyOffset_Limit>

// Test: Without LIMIT/OFFSET
type P_NoLimitOffset = ParseSQL<"SELECT * FROM users">
type P_NoLimitOffset_Check = P_NoLimitOffset extends SQLSelectQuery<infer Q>
    ? Q extends { limit: undefined; offset: undefined }
        ? true
        : false
    : false
type _P37 = RequireTrue<P_NoLimitOffset_Check>

// ============================================================================
// Aggregate Function Tests
// ============================================================================

// Test: COUNT(*)
type P_Count = ParseSQL<"SELECT COUNT ( * ) AS total FROM users">
type P_Count_Check = P_Count extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"COUNT", "*", "total">] }
        ? true
        : false
    : false
type _P38 = RequireTrue<P_Count_Check>

// Test: SUM
type P_Sum = ParseSQL<"SELECT SUM ( amount ) AS total FROM orders">
type P_Sum_Check = P_Sum extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"SUM", any, "total">] }
        ? true
        : false
    : false
type _P39 = RequireTrue<P_Sum_Check>

// Test: AVG
type P_Avg = ParseSQL<"SELECT AVG ( price ) AS average FROM products">
type P_Avg_Check = P_Avg extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"AVG", any, "average">] }
        ? true
        : false
    : false
type _P40 = RequireTrue<P_Avg_Check>

// Test: MIN
type P_Min = ParseSQL<"SELECT MIN ( price ) AS lowest FROM products">
type P_Min_Check = P_Min extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"MIN", any, "lowest">] }
        ? true
        : false
    : false
type _P41 = RequireTrue<P_Min_Check>

// Test: MAX
type P_Max = ParseSQL<"SELECT MAX ( price ) AS highest FROM products">
type P_Max_Check = P_Max extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"MAX", any, "highest">] }
        ? true
        : false
    : false
type _P42 = RequireTrue<P_Max_Check>

// Test: COUNT without alias gets default name
type P_CountNoAlias = ParseSQL<"SELECT COUNT ( * ) FROM users">
type P_CountNoAlias_Check = P_CountNoAlias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"COUNT", "*", "COUNT_result">] }
        ? true
        : false
    : false
type _P43 = RequireTrue<P_CountNoAlias_Check>

// ============================================================================
// Table Wildcard Tests
// ============================================================================

// Test: table.*
type P_TableWildcard = ParseSQL<"SELECT u.* FROM users AS u">
type P_TableWildcard_Check = P_TableWildcard extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [TableWildcard<"u", undefined>] }
        ? true
        : false
    : false
type _P44 = RequireTrue<P_TableWildcard_Check>

// Test: schema.table.*
type P_SchemaTableWildcard = ParseSQL<"SELECT public.users.* FROM public.users">
type P_SchemaTableWildcard_Check = P_SchemaTableWildcard extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [TableWildcard<"users", "public">] }
        ? true
        : false
    : false
type _P45 = RequireTrue<P_SchemaTableWildcard_Check>

// ============================================================================
// CTE (WITH clause) Tests
// ============================================================================

// Test: Simple CTE
type P_CTE = ParseSQL<`
  WITH active_users AS (
    SELECT id, name FROM users WHERE active = TRUE
  )
  SELECT * FROM active_users
`>
type P_CTE_Check = P_CTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: [CTEDefinition<"active_users", SelectClause>] }
        ? true
        : false
    : false
type _P46 = RequireTrue<P_CTE_Check>

// Test: Multiple CTEs
type P_MultiCTE = ParseSQL<`
  WITH 
    cte1 AS ( SELECT id FROM users ),
    cte2 AS ( SELECT id FROM orders )
  SELECT * FROM cte1 LEFT JOIN cte2 ON cte1.id = cte2.id
`>
type P_MultiCTE_Check = P_MultiCTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: [CTEDefinition<"cte1", SelectClause>, CTEDefinition<"cte2", SelectClause>] }
        ? true
        : false
    : false
type _P47 = RequireTrue<P_MultiCTE_Check>

// Test: Without CTE
type P_NoCTE = ParseSQL<"SELECT * FROM users">
type P_NoCTE_Check = P_NoCTE extends SQLSelectQuery<infer Q>
    ? Q extends { ctes: undefined }
        ? true
        : false
    : false
type _P48 = RequireTrue<P_NoCTE_Check>

// ============================================================================
// Derived Table (Subquery in FROM) Tests
// ============================================================================

// Test: Derived table
type P_DerivedTable = ParseSQL<`
  SELECT sub.total
  FROM ( SELECT COUNT ( * ) AS total FROM users ) AS sub
`>
type P_DerivedTable_Check = P_DerivedTable extends SQLSelectQuery<infer Q>
    ? Q extends { from: DerivedTableRef<SelectClause, "sub"> }
        ? true
        : false
    : false
type _P49 = RequireTrue<P_DerivedTable_Check>

// ============================================================================
// Type Casting Tests
// ============================================================================

// Test: Column with type cast
type P_TypeCast = ParseSQL<"SELECT id::text AS id_str FROM users">
type P_TypeCast_Check = P_TypeCast extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<any, "id_str">] }
        ? true
        : false
    : false
type _P50 = RequireTrue<P_TypeCast_Check>

// ============================================================================
// Complex Expression Tests
// ============================================================================

// Test: JSON operator expression
type P_JsonOp = ParseSQL<"SELECT data->>'name' AS name FROM documents">
type P_JsonOp_Check = P_JsonOp extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "name">] }
        ? true
        : false
    : false
type _P51 = RequireTrue<P_JsonOp_Check>

// ============================================================================
// Scalar Subquery Tests
// ============================================================================

// Test: Scalar subquery in SELECT
type P_ScalarSubquery = ParseSQL<`
  SELECT 
    id,
    ( SELECT COUNT ( * ) FROM orders WHERE user_id = users.id ) AS order_count
  FROM users
`>
type P_ScalarSubquery_Check = P_ScalarSubquery extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [ColumnRef, ColumnRef<SubqueryExpr<SelectClause, undefined>, "order_count">]
    }
        ? true
        : false
    : false
type _P52 = RequireTrue<P_ScalarSubquery_Check>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted column names
type P_QuotedCol = ParseSQL<'SELECT "firstName", "lastName" FROM users'>
type P_QuotedCol_Check = P_QuotedCol extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [
            ColumnRef<UnboundColumnRef<"firstName">, "firstName">,
            ColumnRef<UnboundColumnRef<"lastName">, "lastName">,
        ]
    }
        ? true
        : false
    : false
type _P53 = RequireTrue<P_QuotedCol_Check>

// Test: Quoted table and column
type P_QuotedBoth = ParseSQL<'SELECT u."firstName" FROM "Users" AS u'>
type P_QuotedBoth_Check = P_QuotedBoth extends SQLSelectQuery<infer Q>
    ? Q extends {
        from: TableRef<"Users", "u", undefined>
        columns: [ColumnRef<TableColumnRef<"u", "firstName", undefined>, "firstName">]
    }
        ? true
        : false
    : false
type _P54 = RequireTrue<P_QuotedBoth_Check>

// ============================================================================
// Three-part Identifier Tests
// ============================================================================

// Test: schema.table.column
type P_ThreePart = ParseSQL<"SELECT public.users.id FROM public.users">
type P_ThreePart_Check = P_ThreePart extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<TableColumnRef<"users", "id", "public">, "id">] }
        ? true
        : false
    : false
type _P55 = RequireTrue<P_ThreePart_Check>

// ============================================================================
// Mixed Columns Test
// ============================================================================

// Test: Mix of regular columns, aggregates, and wildcards
type P_MixedCols = ParseSQL<`
  SELECT 
    u.*,
    COUNT ( p.id ) AS post_count,
    MAX ( p.created_at ) AS last_post
  FROM users AS u
  LEFT JOIN posts AS p ON u.id = p.author_id
  GROUP BY u.id
`>
type P_MixedCols_Check = P_MixedCols extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [
            TableWildcard<"u", undefined>,
            AggregateExpr<"COUNT", any, "post_count">,
            AggregateExpr<"MAX", any, "last_post">,
        ]
    }
        ? true
        : false
    : false
type _P56 = RequireTrue<P_MixedCols_Check>

// ============================================================================
// Complete Query Tests
// ============================================================================

// Test: Full complex query
type P_Full = ParseSQL<`
  WITH recent_orders AS (
    SELECT user_id, SUM ( total ) AS total
    FROM orders
    WHERE created_at > '2024-01-01'
    GROUP BY user_id
  )
  SELECT DISTINCT
    u.id,
    u.name,
    u.email,
    ro.total
  FROM users AS u
  LEFT JOIN recent_orders AS ro ON u.id = ro.user_id
  WHERE u.status = 'active'
  ORDER BY ro.total DESC
  LIMIT 100
  OFFSET 0
`>
type P_Full_Check = P_Full extends SQLSelectQuery<infer Q>
    ? Q extends {
        distinct: true
        columns: [ColumnRef, ColumnRef, ColumnRef, ColumnRef]
        from: TableRef<"users", "u", undefined>
        joins: [JoinClause<"LEFT", TableRef, ParsedCondition>]
        where: ParsedCondition
        orderBy: [OrderByItem<any, "DESC">]
        limit: 100
        offset: 0
        ctes: [CTEDefinition<"recent_orders", SelectClause>]
    }
        ? true
        : false
    : false
type _P57 = RequireTrue<P_Full_Check>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Empty query returns error
type P_Empty = ParseSQL<"">
type _P58 = RequireTrue<AssertIsParseError<P_Empty>>

// Test: Missing FROM returns error
type P_NoFrom = ParseSQL<"SELECT id">
type _P59 = RequireTrue<AssertIsParseError<P_NoFrom>>

// Test: Invalid keyword start returns error (UPDATE not yet implemented)
type P_InvalidStart = ParseSQL<"UPDATE users SET name = 'John'">
type _P60 = RequireTrue<AssertIsParseError<P_InvalidStart>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are normalized
type P_ExtraSpaces = ParseSQL<"SELECT    id   FROM    users">
type _P61 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLSelectQuery>>

// Test: Newlines are handled
type P_Newlines = ParseSQL<`
SELECT
    id,
    name
FROM
    users
`>
type _P62 = RequireTrue<AssertExtends<P_Newlines, SQLSelectQuery>>

// Test: Tabs are handled
type P_Tabs = ParseSQL<"SELECT\tid\tFROM\tusers">
type _P63 = RequireTrue<AssertExtends<P_Tabs, SQLSelectQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseSQL<"select id from users">
type _P64 = RequireTrue<AssertExtends<P_Lowercase, SQLSelectQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseSQL<"Select Id From Users Where Active = True">
type _P65 = RequireTrue<AssertExtends<P_MixedCase, SQLSelectQuery>>

// ============================================================================
// Export for verification
// ============================================================================

export type ParserTestsPass = true

