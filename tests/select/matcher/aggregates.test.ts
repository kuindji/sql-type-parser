/**
 * Aggregate Function Tests
 *
 * Tests for COUNT, SUM, AVG, MIN, MAX and multiple aggregates.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// Aggregate Function Tests
// ============================================================================

// Test: COUNT returns number
type M_Count = QueryResult<
    "SELECT COUNT ( * ) AS total FROM users",
    TestSchema
>;
type _M19 = RequireTrue<AssertEqual<M_Count, { total: number; }>>;

// Test: SUM returns number
type M_Sum = QueryResult<
    "SELECT SUM ( views ) AS total FROM posts",
    TestSchema
>;
type _M20 = RequireTrue<AssertEqual<M_Sum, { total: number; }>>;

// Test: AVG returns number
type M_Avg = QueryResult<
    "SELECT AVG ( views ) AS average FROM posts",
    TestSchema
>;
type _M21 = RequireTrue<AssertEqual<M_Avg, { average: number; }>>;

// Test: MIN preserves type
type M_Min = QueryResult<
    "SELECT MIN ( views ) AS lowest FROM posts",
    TestSchema
>;
type _M22 = RequireTrue<AssertEqual<M_Min, { lowest: number; }>>;

// Test: MAX preserves type
type M_Max = QueryResult<
    "SELECT MAX ( title ) AS last_title FROM posts",
    TestSchema
>;
type _M23 = RequireTrue<AssertEqual<M_Max, { last_title: string; }>>;

// Test: Multiple aggregates
type M_MultiAgg = QueryResult<
    "SELECT COUNT ( * ) AS count, SUM ( views ) AS total, AVG ( views ) AS avg FROM posts",
    TestSchema
>;
type _M24 = RequireTrue<
    AssertEqual<M_MultiAgg, { count: number; total: number; avg: number; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type AggregatesTestsPass = true;
