/**
 * Aggregate Function Parser Tests
 *
 * Tests for parsing aggregate functions (COUNT, SUM, AVG, MIN, MAX).
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    AggregateExpr,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// Aggregate Function Tests
// ============================================================================

// Test: COUNT(*) with spaces
type P_Count = ParseSQL<"SELECT COUNT ( * ) AS total FROM users">
type P_Count_Check = P_Count extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"COUNT", "*", "total">] }
    ? true
    : false
    : false
type _P38 = RequireTrue<P_Count_Check>

// Test: COUNT(*) without spaces - tokenizer normalizes parentheses
type P_CountNoSpaces = ParseSQL<"SELECT COUNT(*) AS total FROM users">
type P_CountNoSpaces_Check = P_CountNoSpaces extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [AggregateExpr<"COUNT", "*", "total">] }
    ? true
    : false
    : false
type _P38b = RequireTrue<P_CountNoSpaces_Check>

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
// Export for verification
// ============================================================================

export type AggregatesParserTestsPass = true
