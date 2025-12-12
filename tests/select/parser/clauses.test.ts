/**
 * SQL Clauses Parser Tests
 *
 * Tests for WHERE, ORDER BY, GROUP BY, HAVING, LIMIT/OFFSET clauses.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    OrderByItem,
    UnboundColumnRef,
    ParseOrderByItems,
    ParseWhereClause,
    ParsedCondition,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

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
// Fragment Parser Exports (builder support)
// ============================================================================

// WHERE fragment parser should accept a full query tail and return where/rest
type P_WhereFragment = ParseWhereClause<"WHERE id = 1 ORDER BY name">
type P_WhereFragment_Check = P_WhereFragment extends {
    where: ParsedCondition
    rest: string
}
    ? true
    : false
type _PWhereFragment = RequireTrue<P_WhereFragment_Check>

// ORDER BY items parser should produce an array of OrderByItem
type P_OrderByItems = ParseOrderByItems<["name ASC", "created_at DESC"]>
type P_OrderByItems_Check = P_OrderByItems extends OrderByItem[]
    ? true
    : false
type _POrderByItems = RequireTrue<P_OrderByItems_Check>

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
type P_Having = ParseSQL<"SELECT ((role)), COUNT ( * ) FROM users GROUP BY role HAVING COUNT ( * ) > 5">
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
// Export for verification
// ============================================================================

export type ClausesParserTestsPass = true
