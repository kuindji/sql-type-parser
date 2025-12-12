/**
 * INTERVAL Expression Tests
 *
 * Tests for PostgreSQL INTERVAL expressions.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult } from "../../../src/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// INTERVAL Expression Tests
// ============================================================================

// Test: INTERVAL expression returns string
type M_Interval = QueryResult<
    "SELECT INTERVAL '1 day' AS duration FROM users",
    TestSchema
>;
type _INT1 = RequireTrue<AssertEqual<M_Interval, { duration: string; }>>;

// Test: INTERVAL with unit keyword
type M_IntervalUnit = QueryResult<
    "SELECT INTERVAL '1' DAY AS one_day FROM users",
    TestSchema
>;
type _INT2 = RequireTrue<AssertEqual<M_IntervalUnit, { one_day: string; }>>;

// Test: INTERVAL with complex value
type M_IntervalComplex = QueryResult<
    "SELECT INTERVAL '1 year 2 months' AS period FROM users",
    TestSchema
>;
type _INT3 = RequireTrue<AssertEqual<M_IntervalComplex, { period: string; }>>;

// Test: INTERVAL without alias defaults to "interval"
type M_IntervalNoAlias = QueryResult<
    "SELECT INTERVAL '1 hour' FROM users",
    TestSchema
>;
type _INT4 = RequireTrue<AssertEqual<M_IntervalNoAlias, { interval: string; }>>;

// Test: INTERVAL mixed with other columns
type M_IntervalMixed = QueryResult<
    "SELECT id, name, INTERVAL '30 days' AS month FROM users",
    TestSchema
>;
type _INT5 = RequireTrue<
    AssertEqual<M_IntervalMixed, { id: number; name: string; month: string; }>
>;

// Test: INTERVAL with TO keyword
type M_IntervalTo = QueryResult<
    "SELECT INTERVAL '1-2' YEAR TO MONTH AS range FROM users",
    TestSchema
>;
type _INT6 = RequireTrue<AssertEqual<M_IntervalTo, { range: string; }>>;

// Test: INTERVAL in WHERE clause - should not cause validation errors
type M_IntervalWhere = QueryResult<
    "SELECT id, name FROM users WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'",
    TestSchema
>;
type _INT7 = RequireTrue<
    AssertEqual<M_IntervalWhere, { id: number; name: string; }>
>;

// Test: INTERVAL in WHERE clause validates successfully
type M_IntervalWhere_1 = QueryResult<
    `SELECT *
    FROM users
    WHERE
    id > 10 and
    role = 'admin' and
    (
      created_at is null or
      now() - created_at > interval '17 days'
    )`,
    TestSchema
>;
type _INT7_1 = RequireTrue<
    AssertEqual<M_IntervalWhere, { id: number; name: string; }>
>;

// Test: Multiple INTERVALs in same query
type M_MultiInterval = QueryResult<
    "SELECT INTERVAL '1 day' AS day, INTERVAL '1 hour' AS hour FROM users",
    TestSchema
>;
type _INT8 = RequireTrue<
    AssertEqual<M_MultiInterval, { day: string; hour: string; }>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type IntervalTestsPass = true;
