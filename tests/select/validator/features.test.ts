/**
 * Feature Validation Tests
 *
 * Tests for aggregates, multi-schema, wildcards, and JSON fields.
 * If this file compiles without errors, all tests pass.
 */

import type { ValidateSelectSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { JsonFieldSchema, TestSchema } from "./schemas.js";

// ============================================================================
// Aggregate Validation Tests
// ============================================================================

// Test: Valid aggregate returns true
type V_Agg = ValidateSelectSQL<
    "SELECT COUNT ( * ) AS total FROM users",
    TestSchema
>;
type _V29 = RequireTrue<AssertEqual<V_Agg, true>>;

// Test: Valid aggregate with column returns true
type V_AggCol = ValidateSelectSQL<
    "SELECT SUM ( views ) AS total FROM posts",
    TestSchema
>;
type _V30 = RequireTrue<AssertEqual<V_AggCol, true>>;

// ============================================================================
// Multi-Schema Validation Tests
// ============================================================================

// Test: Valid cross-schema query returns true
type V_CrossSchema = ValidateSelectSQL<
    "SELECT u.name, l.action FROM users AS u INNER JOIN audit.logs AS l ON u.id = l.user_id",
    TestSchema
>;
type _V31 = RequireTrue<AssertEqual<V_CrossSchema, true>>;

// Test: Invalid schema returns error
type V_InvalidSchema = ValidateSelectSQL<
    "SELECT * FROM bad_schema.users",
    TestSchema
>;
type _V32 = RequireTrue<AssertExtends<V_InvalidSchema, string>>;

// ============================================================================
// Table Wildcard Validation Tests
// ============================================================================

// Test: Valid table wildcard returns true
type V_TableWildcard = ValidateSelectSQL<
    "SELECT u.* FROM users AS u",
    TestSchema
>;
type _V33 = RequireTrue<AssertEqual<V_TableWildcard, true>>;

// Test: Invalid table wildcard returns error
type V_InvalidTableWildcard = ValidateSelectSQL<
    "SELECT bad.* FROM users AS u",
    TestSchema
>;
type _V34 = RequireTrue<AssertExtends<V_InvalidTableWildcard, string>>;

// ============================================================================
// JSON Field Validation Tests
// ============================================================================

// Test: Valid JSON field query returns true
type V_JsonField = ValidateSelectSQL<
    "SELECT metadata FROM items",
    JsonFieldSchema
>;
type _V35 = RequireTrue<AssertEqual<V_JsonField, true>>;

// Test: Valid deeply nested JSON field returns true
type V_DeepJsonField = ValidateSelectSQL<
    "SELECT config FROM items",
    JsonFieldSchema
>;
type _V36 = RequireTrue<AssertEqual<V_DeepJsonField, true>>;

// Test: Valid JSON accessor in WHERE returns true
type V_JsonWhere = ValidateSelectSQL<
    "SELECT id FROM items WHERE config->>'key' = 'value'",
    JsonFieldSchema
>;
type _V37 = RequireTrue<AssertEqual<V_JsonWhere, true>>;

// ============================================================================
// Export for verification
// ============================================================================

export type FeaturesValidatorTestsPass = true;
