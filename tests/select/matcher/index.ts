/**
 * Matcher Type Tests Index
 *
 * Re-exports all matcher tests.
 * If this file compiles without errors, all tests pass.
 */

export type {
    CamelCaseTestSchema,
    JsonFieldSchema,
    TestSchema,
} from "./schemas.js";

export type { AggregatesTestsPass } from "./aggregates.test.js";
export type { BasicTestsPass } from "./basic.test.js";
export type { CastingTestsPass } from "./casting.test.js";
export type {
    ComplexTestsPass,
    MatcherComplexTestsPass,
} from "./complex.test.js";
export type { DynamicTestsPass } from "./dynamic.test.js";
export type { ExistsTestsPass } from "./exists.test.js";
export type { ExpressionsTestsPass } from "./expressions.test.js";
export type { FunctionsTestsPass } from "./functions.test.js";
export type { IntervalTestsPass } from "./interval.test.js";
export type { JsonTestsPass } from "./json.test.js";
export type { OrderByTestsPass } from "./orderby.test.js";
export type { SubqueriesTestsPass } from "./subqueries.test.js";
export type { TablesTestsPass } from "./tables.test.js";
export type { ValidationTestsPass } from "./validation.test.js";

// ============================================================================
// Export for verification
// ============================================================================

export type MatcherTestsPass = true;
