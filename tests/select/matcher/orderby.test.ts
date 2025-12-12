/**
 * ORDER BY NULLS FIRST/LAST Tests
 *
 * Tests for ORDER BY with NULLS FIRST and NULLS LAST.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// ORDER BY NULLS FIRST/LAST Tests
// ============================================================================

// Test: ORDER BY with NULLS FIRST
type M_NullsFirst = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at NULLS FIRST",
    TestSchema
>;
type _NF1 = RequireTrue<
    AssertEqual<M_NullsFirst, { id: number; name: string; }>
>;

// Test: ORDER BY with NULLS LAST
type M_NullsLast = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at NULLS LAST",
    TestSchema
>;
type _NF2 = RequireTrue<
    AssertEqual<M_NullsLast, { id: number; name: string; }>
>;

// Test: ORDER BY DESC NULLS FIRST
type M_DescNullsFirst = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at DESC NULLS FIRST",
    TestSchema
>;
type _NF3 = RequireTrue<
    AssertEqual<M_DescNullsFirst, { id: number; name: string; }>
>;

// Test: ORDER BY ASC NULLS LAST
type M_AscNullsLast = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at ASC NULLS LAST",
    TestSchema
>;
type _NF4 = RequireTrue<
    AssertEqual<M_AscNullsLast, { id: number; name: string; }>
>;

// Test: Multiple ORDER BY columns with NULLS
type M_MultiNulls = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at DESC NULLS FIRST, created_at ASC NULLS LAST",
    TestSchema
>;
type _NF5 = RequireTrue<
    AssertEqual<M_MultiNulls, { id: number; name: string; }>
>;

// Test: ORDER BY with lowercase nulls first
type M_LowerNulls = QueryResult<
    "SELECT id, name FROM users ORDER BY deleted_at nulls first",
    TestSchema
>;
type _NF6 = RequireTrue<
    AssertEqual<M_LowerNulls, { id: number; name: string; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type OrderByTestsPass = true;
