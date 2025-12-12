/**
 * Expression Parser Tests
 *
 * Tests for parsing complex expressions, type casting, JSON operators,
 * function calls, and arithmetic expressions.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    ColumnRef,
    ComplexExpr,
} from "../../../src/index.js"
import type { AssertExtends, RequireTrue } from "../../helpers.js"

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
// PostgreSQL Concatenation Operator Tests
// ============================================================================

// Test: Simple string concatenation with || operator
type P_Concat = ParseSQL<"SELECT first_name || ' ' || last_name AS full_name FROM users">
type P_Concat_Check = P_Concat extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "full_name">] }
    ? true
    : false
    : false
type _P66 = RequireTrue<P_Concat_Check>

// Test: Concatenation with table-qualified columns
type P_ConcatQualified = ParseSQL<"SELECT u.first_name || u.last_name FROM users u">
type P_ConcatQualified_Check = P_ConcatQualified extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, string>] }
    ? true
    : false
    : false
type _P67 = RequireTrue<P_ConcatQualified_Check>

// Test: Concatenation without alias (should still be recognized as complex expression)
type P_ConcatNoAlias = ParseSQL<"SELECT first_name || last_name FROM users">
type _P68 = RequireTrue<AssertExtends<P_ConcatNoAlias, SQLSelectQuery>>

// ============================================================================
// Function Call Tests
// ============================================================================

// Test: Function call with no arguments (now())
type P_FuncNoArgs = ParseSQL<"SELECT now ( ) AS created_at FROM users">
type P_FuncNoArgs_Check = P_FuncNoArgs extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "created_at">] }
    ? true
    : false
    : false
type _P79 = RequireTrue<P_FuncNoArgs_Check>

// Test: Function call with string arguments
type P_FuncConcat = ParseSQL<"SELECT concat ( 'hello' , ' ' , 'world' ) AS greeting FROM users">
type P_FuncConcat_Check = P_FuncConcat extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "greeting">] }
    ? true
    : false
    : false
type _P80 = RequireTrue<P_FuncConcat_Check>

// Test: Function call with column argument
type P_FuncWithCol = ParseSQL<"SELECT upper ( name ) AS upper_name FROM users">
type P_FuncWithCol_Check = P_FuncWithCol extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "upper_name">] }
    ? true
    : false
    : false
type _P81 = RequireTrue<P_FuncWithCol_Check>

// Test: Nested function calls
type P_NestedFuncs = ParseSQL<"SELECT lower ( trim ( name ) ) AS cleaned FROM users">
type _P82 = RequireTrue<AssertExtends<P_NestedFuncs, SQLSelectQuery>>

// ============================================================================
// Arithmetic Expression Tests
// ============================================================================

// Test: Simple addition
type P_Addition = ParseSQL<"SELECT 1 + 1 AS two FROM users">
type P_Addition_Check = P_Addition extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "two">] }
    ? true
    : false
    : false
type _P83 = RequireTrue<P_Addition_Check>

// Test: Column arithmetic
type P_ColArith = ParseSQL<"SELECT price * quantity AS total FROM orders">
type P_ColArith_Check = P_ColArith extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ColumnRef<ComplexExpr, "total">] }
    ? true
    : false
    : false
type _P84 = RequireTrue<P_ColArith_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type ExpressionsParserTestsPass = true
