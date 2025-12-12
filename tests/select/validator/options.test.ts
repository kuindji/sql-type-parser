/**
 * ValidateSelectOptions Tests
 *
 * Tests for validation options behavior (e.g., validateAllFields).
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { TestSchema } from "./schemas.js";

// ============================================================================
// ValidateSelectOptions Tests
// ============================================================================

// Test: Invalid WHERE passes with validateAllFields: false
type V_InvalidWhereNoCheck = ValidateSelectSQL<
    "SELECT id FROM users WHERE bad_column = 1",
    TestSchema,
    { validateAllFields: false; }
>;
type _V20 = RequireTrue<AssertEqual<V_InvalidWhereNoCheck, true>>;

// Test: Invalid ORDER BY passes with validateAllFields: false
type V_InvalidOrderByNoCheck = ValidateSelectSQL<
    "SELECT id FROM users ORDER BY bad_column",
    TestSchema,
    { validateAllFields: false; }
>;
type _V21 = RequireTrue<AssertEqual<V_InvalidOrderByNoCheck, true>>;

// Test: Invalid GROUP BY passes with validateAllFields: false
type V_InvalidGroupByNoCheck = ValidateSelectSQL<
    "SELECT id FROM users GROUP BY bad_column",
    TestSchema,
    { validateAllFields: false; }
>;
type _V22 = RequireTrue<AssertEqual<V_InvalidGroupByNoCheck, true>>;

// Test: Invalid HAVING passes with validateAllFields: false
type V_InvalidHavingNoCheck = ValidateSelectSQL<
    "SELECT author_id FROM posts GROUP BY author_id HAVING bad_column > 0",
    TestSchema,
    { validateAllFields: false; }
>;
type _V23 = RequireTrue<AssertEqual<V_InvalidHavingNoCheck, true>>;

// Test: Invalid JOIN ON passes with validateAllFields: false
type V_InvalidJoinOnNoCheck = ValidateSelectSQL<
    "SELECT u.id FROM users AS u INNER JOIN posts AS p ON u.bad_column = p.author_id",
    TestSchema,
    { validateAllFields: false; }
>;
type _V24 = RequireTrue<AssertEqual<V_InvalidJoinOnNoCheck, true>>;

// Test: Invalid SELECT column still fails with validateAllFields: false
type V_InvalidSelectNoCheck = ValidateSelectSQL<
    "SELECT bad_column FROM users",
    TestSchema,
    { validateAllFields: false; }
>;
type _V25 = RequireTrue<AssertExtends<V_InvalidSelectNoCheck, string>>;

// ============================================================================
// Export for verification
// ============================================================================

export type OptionsValidatorTestsPass = true;
