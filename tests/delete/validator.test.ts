/**
 * DELETE Validator Type Tests
 *
 * Tests for the ValidateDeleteSQL type and related validation functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ValidateDeleteSQL,
    DeleteResult,
    IsValidDelete,
    GetDeleteTableColumns,
    MatchDeleteQuery,
    ParseDeleteSQL,
    SQLDeleteQuery,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, RequireFalse, AssertIsMatchError } from "../helpers.js"

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            users: {
                id: number
                name: string
                email: string
                active: boolean
                created_at: string
            }
            orders: {
                id: number
                user_id: number
                total: number
                status: string
            }
            products: {
                id: number
                name: string
                price: number
                quantity: number
            }
        }
        audit: {
            logs: {
                id: number
                user_id: number
                action: string
                timestamp: string
            }
        }
    }
}

// ============================================================================
// Basic Validation Tests
// ============================================================================

// Test: Valid DELETE from existing table
type V_ValidBasic = ValidateDeleteSQL<"DELETE FROM users", TestSchema>
type _V1 = RequireTrue<AssertEqual<V_ValidBasic, true>>

// Test: Valid DELETE with WHERE
type V_ValidWithWhere = ValidateDeleteSQL<"DELETE FROM users WHERE id = 1", TestSchema>
type _V2 = RequireTrue<AssertEqual<V_ValidWithWhere, true>>

// Test: Invalid table name
type V_InvalidTable = ValidateDeleteSQL<"DELETE FROM nonexistent", TestSchema>
type _V3 = V_InvalidTable extends `Table 'nonexistent' not found${string}` ? true : false
type _V3a = RequireTrue<_V3>

// ============================================================================
// Schema-Qualified Table Tests
// ============================================================================

// Test: Valid DELETE with schema prefix
type V_SchemaTable = ValidateDeleteSQL<"DELETE FROM public.users WHERE id = 1", TestSchema>
type _V4 = RequireTrue<AssertEqual<V_SchemaTable, true>>

// Test: Valid DELETE from different schema
type V_AuditSchema = ValidateDeleteSQL<"DELETE FROM audit.logs WHERE id = 1", TestSchema>
type _V5 = RequireTrue<AssertEqual<V_AuditSchema, true>>

// Test: Invalid schema name
type V_InvalidSchema = ValidateDeleteSQL<"DELETE FROM nonexistent.users WHERE id = 1", TestSchema>
type _V6 = V_InvalidSchema extends `Schema 'nonexistent' not found` ? true : false
type _V6a = RequireTrue<_V6>

// ============================================================================
// RETURNING Clause Validation Tests
// ============================================================================

// Test: RETURNING * is valid
type V_ReturningStar = ValidateDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING *", TestSchema>
type _V7 = RequireTrue<AssertEqual<V_ReturningStar, true>>

// Test: RETURNING valid columns
type V_ReturningValid = ValidateDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING id , name", TestSchema>
type _V8 = RequireTrue<AssertEqual<V_ReturningValid, true>>

// Test: RETURNING invalid column
type V_ReturningInvalid = ValidateDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING invalid_col", TestSchema>
type _V9 = V_ReturningInvalid extends `Column 'invalid_col' not found${string}` ? true : false
type _V9a = RequireTrue<_V9>

// ============================================================================
// IsValidDelete Tests
// ============================================================================

// Test: IsValidDelete for valid query
type IV_Valid = IsValidDelete<"DELETE FROM users WHERE id = 1", TestSchema>
type _IV1 = RequireTrue<AssertEqual<IV_Valid, true>>

// Test: IsValidDelete for invalid query
type IV_Invalid = IsValidDelete<"DELETE FROM nonexistent WHERE id = 1", TestSchema>
type _IV2 = RequireTrue<AssertEqual<IV_Invalid, false>>

// ============================================================================
// DeleteResult Tests (RETURNING clause result type)
// ============================================================================

// Test: DeleteResult without RETURNING returns void
type DR_NoReturning = DeleteResult<"DELETE FROM users WHERE id = 1", TestSchema>
type _DR1 = RequireTrue<AssertEqual<DR_NoReturning, void>>

// Test: DeleteResult with RETURNING * returns full row
type DR_ReturningStar = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING *", TestSchema>
type _DR2 = RequireTrue<AssertEqual<DR_ReturningStar, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: DeleteResult with specific columns
type DR_ReturningCols = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING id , name", TestSchema>
type _DR3 = RequireTrue<AssertEqual<DR_ReturningCols, { id: number; name: string }>>

// Test: DeleteResult from schema-qualified table
type DR_SchemaTable = DeleteResult<"DELETE FROM audit.logs WHERE id = 1 RETURNING *", TestSchema>
type _DR4 = RequireTrue<AssertEqual<DR_SchemaTable, {
    id: number
    user_id: number
    action: string
    timestamp: string
}>>

// ============================================================================
// GetDeleteTableColumns Tests
// ============================================================================

// Test: Get table columns for DELETE
type GTC_Users = GetDeleteTableColumns<"DELETE FROM users WHERE id = 1", TestSchema>
type _GTC1 = RequireTrue<AssertExtends<GTC_Users, { id: number; name: string; email: string; active: boolean; created_at: string }>>

// Test: Get table columns for schema-qualified DELETE
type GTC_Audit = GetDeleteTableColumns<"DELETE FROM audit.logs WHERE id = 1", TestSchema>
type _GTC2 = RequireTrue<AssertExtends<GTC_Audit, { id: number; user_id: number; action: string; timestamp: string }>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Full complex DELETE
type V_Complex = ValidateDeleteSQL<`
    DELETE FROM users
    WHERE active = FALSE AND created_at < '2024-01-01'
    RETURNING id , name , email
`, TestSchema>
type _V10 = RequireTrue<AssertEqual<V_Complex, true>>

// Test: DELETE all (no WHERE)
type V_DeleteAll = ValidateDeleteSQL<"DELETE FROM users", TestSchema>
type _V11 = RequireTrue<AssertEqual<V_DeleteAll, true>>

// ============================================================================
// Export for verification
// ============================================================================

export type DeleteValidatorTestsPass = true

