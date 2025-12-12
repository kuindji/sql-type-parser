/**
 * Complex Object / JSON Field Tests
 *
 * Tests for JSON fields and nested object types.
 * If this file compiles without errors, all tests pass.
 */

import type { QueryResult, ValidateSQL } from "../../../src/index.js";
import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";
import type { JsonFieldSchema } from "./schemas.js";

// ============================================================================
// Complex Object / JSON Field Tests
// ============================================================================

// Test: Query with nested object field returns correct type (not never)
type M_JsonField = QueryResult<"SELECT metadata FROM items", JsonFieldSchema>;
type _M47 = RequireTrue<
    AssertEqual<M_JsonField, { metadata: { foo: string; bar: number; }; }>
>;

// Test: Query with deeply nested object field
type M_DeepJsonField = QueryResult<"SELECT config FROM items", JsonFieldSchema>;
type _M48 = RequireTrue<
    AssertEqual<
        M_DeepJsonField,
        {
            config: {
                settings: { enabled: boolean; values: number[]; };
                tags: string[];
            };
        }
    >
>;

// Test: JSON field accessor returns unknown (no type cast)
type M_DeepJsonFieldProperty = QueryResult<
    "SELECT config->>'settings' FROM items",
    JsonFieldSchema
>;
type _M48_1 = RequireTrue<
    AssertEqual<M_DeepJsonFieldProperty, { settings: unknown; }>
>;

// Test: JSON field accessor with type cast returns casted type
type M_JsonFieldWithCast = QueryResult<
    `SELECT (config)->>'settings'::text as "userSettings" FROM items`,
    JsonFieldSchema
>;
type _M48_2 = RequireTrue<
    AssertEqual<M_JsonFieldWithCast, { userSettings: string; }>
>;

// Test: Query with nullable object field
type M_NullableJsonField = QueryResult<
    "SELECT extra FROM items",
    JsonFieldSchema
>;
type _M49 = RequireTrue<
    AssertEqual<M_NullableJsonField, { extra: { key: string; } | null; }>
>;

// Test: Query with Record type field
type M_RecordField = QueryResult<"SELECT data FROM items", JsonFieldSchema>;
type _M50 = RequireTrue<
    AssertEqual<M_RecordField, { data: Record<string, unknown>; }>
>;

// Test: ValidateSQL returns true for JSON field queries (not never)
type V_JsonValid = ValidateSQL<"SELECT metadata FROM items", JsonFieldSchema>;
type _V6 = RequireTrue<AssertEqual<V_JsonValid, true>>;

// Test: ValidateSQL returns true for deeply nested JSON field queries
type V_DeepJsonValid = ValidateSQL<"SELECT config FROM items", JsonFieldSchema>;
type _V7 = RequireTrue<AssertEqual<V_DeepJsonValid, true>>;

// Test: Multiple JSON fields in one query
type M_MultiJsonFields = QueryResult<
    "SELECT id, metadata, config FROM items",
    JsonFieldSchema
>;
type _M51 = RequireTrue<
    AssertEqual<
        M_MultiJsonFields,
        {
            id: number;
            metadata: { foo: string; bar: number; };
            config: {
                settings: { enabled: boolean; values: number[]; };
                tags: string[];
            };
        }
    >
>;

// Test: SELECT * with JSON fields
type M_StarWithJson = QueryResult<"SELECT * FROM items", JsonFieldSchema>;
type _M52 = RequireTrue<
    AssertExtends<
        M_StarWithJson,
        { id: number; metadata: { foo: string; bar: number; }; }
    >
>;

// Test: ValidateSQL for SELECT * with JSON fields returns true
type V_StarJsonValid = ValidateSQL<"SELECT * FROM items", JsonFieldSchema>;
type _V8 = RequireTrue<AssertEqual<V_StarJsonValid, true>>;

// ============================================================================
// Export for verification
// ============================================================================

export type JsonTestsPass = true;
