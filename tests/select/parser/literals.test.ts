/**
 * Literal Value and SQL Constants Parser Tests
 *
 * Tests for parsing literal values, SQL constants, and parameter placeholders.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    ColumnRef,
    ComplexExpr,
    LiteralExpr,
    SQLConstantExpr,
} from "../../../src/index.js"
import type { AssertExtends, RequireTrue } from "../../helpers.js"

// ============================================================================
// Literal Value Tests
// ============================================================================

// Test: Numeric literal with alias
type P_NumericLiteral = ParseSQL<"SELECT 1 AS num FROM users">
type P_NumericLiteral_Check = P_NumericLiteral extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<1>, "num">] }
    ? true
    : false
    : false
type _P69 = RequireTrue<P_NumericLiteral_Check>

// Test: String literal with alias
type P_StringLiteral = ParseSQL<"SELECT 'hello' AS greeting FROM users">
type P_StringLiteral_Check = P_StringLiteral extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<"hello">, "greeting">] }
    ? true
    : false
    : false
type _P70 = RequireTrue<P_StringLiteral_Check>

// Test: NULL literal with alias
type P_NullLiteral = ParseSQL<"SELECT NULL AS nothing FROM users">
type P_NullLiteral_Check = P_NullLiteral extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<null>, "nothing">] }
    ? true
    : false
    : false
type _P71 = RequireTrue<P_NullLiteral_Check>

// Test: TRUE literal with alias
type P_TrueLiteral = ParseSQL<"SELECT TRUE AS flag FROM users">
type P_TrueLiteral_Check = P_TrueLiteral extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<true>, "flag">] }
    ? true
    : false
    : false
type _P72 = RequireTrue<P_TrueLiteral_Check>

// Test: FALSE literal with alias
type P_FalseLiteral = ParseSQL<"SELECT FALSE AS inactive FROM users">
type P_FalseLiteral_Check = P_FalseLiteral extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<false>, "inactive">] }
    ? true
    : false
    : false
type _P73 = RequireTrue<P_FalseLiteral_Check>

// Test: Numeric literal without alias (gets default alias)
type P_NumericNoAlias = ParseSQL<"SELECT 42 FROM users">
type P_NumericNoAlias_Check = P_NumericNoAlias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<LiteralExpr<42>, "int4">] }
    ? true
    : false
    : false
type _P74 = RequireTrue<P_NumericNoAlias_Check>

// Test: Mix of literals and columns
type P_MixedLiteralsCols = ParseSQL<"SELECT id, 1 AS one, name, 'test' AS str FROM users">
type _P75 = RequireTrue<AssertExtends<P_MixedLiteralsCols, SQLSelectQuery>>

// ============================================================================
// Parameter Placeholder Tests
// ============================================================================

// Test: Parameter placeholder with alias
type P_ParamPlaceholder = ParseSQL<"SELECT $1 AS field_name FROM users">
type P_ParamPlaceholder_Check = P_ParamPlaceholder extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "field_name">] }
    ? true
    : false
    : false
type _P76 = RequireTrue<P_ParamPlaceholder_Check>

// Test: Named parameter placeholder
type P_NamedParam = ParseSQL<"SELECT :user_id AS uid FROM users">
type P_NamedParam_Check = P_NamedParam extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "uid">] }
    ? true
    : false
    : false
type _P77 = RequireTrue<P_NamedParam_Check>

// Test: Multiple parameter placeholders
type P_MultiParams = ParseSQL<"SELECT $1 AS first, $2 AS second FROM users">
type _P78 = RequireTrue<AssertExtends<P_MultiParams, SQLSelectQuery>>

// ============================================================================
// SQL Constants Parser Tests
// ============================================================================

// Test: CURRENT_DATE parses to SQLConstantExpr
type P_CurrentDate = ParseSQL<"SELECT CURRENT_DATE FROM users">
type P_CurrentDate_Check = P_CurrentDate extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<SQLConstantExpr<"CURRENT_DATE">, "current_date">] }
    ? true
    : false
    : false
type _PSC1 = RequireTrue<P_CurrentDate_Check>

// Test: CURRENT_TIMESTAMP parses to SQLConstantExpr
type P_CurrentTimestamp = ParseSQL<"SELECT CURRENT_TIMESTAMP FROM users">
type P_CurrentTimestamp_Check = P_CurrentTimestamp extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<SQLConstantExpr<"CURRENT_TIMESTAMP">, "current_timestamp">] }
    ? true
    : false
    : false
type _PSC2 = RequireTrue<P_CurrentTimestamp_Check>

// Test: CURRENT_DATE with alias
type P_CurrentDateAlias = ParseSQL<"SELECT CURRENT_DATE AS today FROM users">
type P_CurrentDateAlias_Check = P_CurrentDateAlias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<SQLConstantExpr<"CURRENT_DATE">, "today">] }
    ? true
    : false
    : false
type _PSC3 = RequireTrue<P_CurrentDateAlias_Check>

// Test: Multiple SQL constants
type P_MultiConstants = ParseSQL<"SELECT CURRENT_DATE AS dt, CURRENT_TIME AS tm FROM users">
type P_MultiConstants_Check = P_MultiConstants extends SQLSelectQuery<infer Q>
    ? Q extends {
        columns: [
            ColumnRef<SQLConstantExpr<"CURRENT_DATE">, "dt">,
            ColumnRef<SQLConstantExpr<"CURRENT_TIME">, "tm">
        ]
    }
    ? true
    : false
    : false
type _PSC4 = RequireTrue<P_MultiConstants_Check>

// Test: SQL constants mixed with columns
type P_MixedSQLConst = ParseSQL<"SELECT id, CURRENT_DATE AS dt FROM users">
type _PSC5 = RequireTrue<AssertExtends<P_MixedSQLConst, SQLSelectQuery>>

// ============================================================================
// Export for verification
// ============================================================================

export type LiteralsParserTestsPass = true
