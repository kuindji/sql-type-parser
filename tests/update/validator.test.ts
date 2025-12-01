/**
 * UPDATE Validator Type Tests
 *
 * Tests for the ValidateUpdateSQL type and related validation functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ValidateUpdateSQL,
    UpdateResult,
    IsValidUpdate,
    GetUpdateTableColumns,
    MatchUpdateQuery,
    ParseUpdateSQL,
    SQLUpdateQuery,
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

// Test: Valid UPDATE on existing table
type V_ValidBasic = ValidateUpdateSQL<"UPDATE users SET name = 'John'", TestSchema>
type _V1 = RequireTrue<AssertEqual<V_ValidBasic, true>>

// Test: Valid UPDATE with WHERE
type V_ValidWithWhere = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1", TestSchema>
type _V2 = RequireTrue<AssertEqual<V_ValidWithWhere, true>>

// Test: Invalid table name
type V_InvalidTable = ValidateUpdateSQL<"UPDATE nonexistent SET name = 'John'", TestSchema>
type _V3 = V_InvalidTable extends `Table 'nonexistent' not found${string}` ? true : false
type _V3a = RequireTrue<_V3>

// Test: Invalid column in SET
type V_InvalidColumn = ValidateUpdateSQL<"UPDATE users SET invalid_col = 'value'", TestSchema>
type _V4 = V_InvalidColumn extends `Column 'invalid_col' not found${string}` ? true : false
type _V4a = RequireTrue<_V4>

// ============================================================================
// Schema-Qualified Table Tests
// ============================================================================

// Test: Valid UPDATE with schema prefix
type V_SchemaTable = ValidateUpdateSQL<"UPDATE public.users SET name = 'John' WHERE id = 1", TestSchema>
type _V5 = RequireTrue<AssertEqual<V_SchemaTable, true>>

// Test: Valid UPDATE in different schema
type V_AuditSchema = ValidateUpdateSQL<"UPDATE audit.logs SET action = 'updated' WHERE id = 1", TestSchema>
type _V6 = RequireTrue<AssertEqual<V_AuditSchema, true>>

// Test: Invalid schema name
type V_InvalidSchema = ValidateUpdateSQL<"UPDATE nonexistent.users SET name = 'John'", TestSchema>
type _V7 = V_InvalidSchema extends `Schema 'nonexistent' not found` ? true : false
type _V7a = RequireTrue<_V7>

// ============================================================================
// SET Clause Validation Tests
// ============================================================================

// Test: Valid SET with multiple columns
type V_MultiSet = ValidateUpdateSQL<"UPDATE users SET name = 'John' , email = 'john@example.com' , active = TRUE", TestSchema>
type _V8 = RequireTrue<AssertEqual<V_MultiSet, true>>

// Test: SET with one invalid column
type V_OneInvalid = ValidateUpdateSQL<"UPDATE users SET name = 'John' , invalid = 'value'", TestSchema>
type _V9 = V_OneInvalid extends `Column 'invalid' not found${string}` ? true : false
type _V9a = RequireTrue<_V9>

// ============================================================================
// RETURNING Clause Validation Tests
// ============================================================================

// Test: RETURNING * is valid
type V_ReturningStar = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING *", TestSchema>
type _V10 = RequireTrue<AssertEqual<V_ReturningStar, true>>

// Test: RETURNING valid columns
type V_ReturningValid = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name", TestSchema>
type _V11 = RequireTrue<AssertEqual<V_ReturningValid, true>>

// Test: RETURNING invalid column
type V_ReturningInvalid = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING invalid_col", TestSchema>
type _V12 = V_ReturningInvalid extends `Column 'invalid_col' not found${string}` ? true : false
type _V12a = RequireTrue<_V12>

// ============================================================================
// RETURNING with OLD/NEW Validation (PostgreSQL 17+)
// ============================================================================

// Test: RETURNING OLD.* is valid
type V_OldStar = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.*", TestSchema>
type _V12b = RequireTrue<AssertEqual<V_OldStar, true>>

// Test: RETURNING NEW.* is valid
type V_NewStar = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.*", TestSchema>
type _V12c = RequireTrue<AssertEqual<V_NewStar, true>>

// Test: RETURNING OLD.column is valid for existing column
type V_OldCol = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.name", TestSchema>
type _V12d = RequireTrue<AssertEqual<V_OldCol, true>>

// Test: RETURNING NEW.column is valid for existing column
type V_NewCol = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.name", TestSchema>
type _V12e = RequireTrue<AssertEqual<V_NewCol, true>>

// Test: Mixed OLD, NEW and unqualified columns
type V_Mixed = ValidateUpdateSQL<"UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING OLD.name , NEW.name , id", TestSchema>
type _V12f = RequireTrue<AssertEqual<V_Mixed, true>>

// Test: RETURNING OLD.invalid_column fails
type V_OldInvalid = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.nonexistent", TestSchema>
type _V12g = V_OldInvalid extends `Column 'nonexistent' not found${string}` ? true : false
type _V12ga = RequireTrue<_V12g>

// Test: RETURNING NEW.invalid_column fails
type V_NewInvalid = ValidateUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.nonexistent", TestSchema>
type _V12h = V_NewInvalid extends `Column 'nonexistent' not found${string}` ? true : false
type _V12ha = RequireTrue<_V12h>

// ============================================================================
// IsValidUpdate Tests
// ============================================================================

// Test: IsValidUpdate for valid query
type IV_Valid = IsValidUpdate<"UPDATE users SET name = 'John' WHERE id = 1", TestSchema>
type _IV1 = RequireTrue<AssertEqual<IV_Valid, true>>

// Test: IsValidUpdate for invalid query
type IV_Invalid = IsValidUpdate<"UPDATE nonexistent SET name = 'John'", TestSchema>
type _IV2 = RequireTrue<AssertEqual<IV_Invalid, false>>

// ============================================================================
// UpdateResult Tests (RETURNING clause result type)
// ============================================================================

// Test: UpdateResult without RETURNING returns void
type UR_NoReturning = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1", TestSchema>
type _UR1 = RequireTrue<AssertEqual<UR_NoReturning, void>>

// Test: UpdateResult with RETURNING * returns full row
type UR_ReturningStar = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING *", TestSchema>
type _UR2 = RequireTrue<AssertEqual<UR_ReturningStar, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: UpdateResult with specific columns
type UR_ReturningCols = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name , email", TestSchema>
type _UR3 = RequireTrue<AssertEqual<UR_ReturningCols, { id: number; name: string; email: string }>>

// Test: UpdateResult from schema-qualified table
type UR_SchemaTable = UpdateResult<"UPDATE audit.logs SET action = 'updated' WHERE id = 1 RETURNING *", TestSchema>
type _UR4 = RequireTrue<AssertEqual<UR_SchemaTable, {
    id: number
    user_id: number
    action: string
    timestamp: string
}>>

// ============================================================================
// GetUpdateTableColumns Tests
// ============================================================================

// Test: Get table columns for UPDATE
type GTC_Users = GetUpdateTableColumns<"UPDATE users SET name = 'John'", TestSchema>
type _GTC1 = RequireTrue<AssertExtends<GTC_Users, { id: number; name: string; email: string; active: boolean; created_at: string }>>

// Test: Get table columns for schema-qualified UPDATE
type GTC_Audit = GetUpdateTableColumns<"UPDATE audit.logs SET action = 'test'", TestSchema>
type _GTC2 = RequireTrue<AssertExtends<GTC_Audit, { id: number; user_id: number; action: string; timestamp: string }>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Full complex UPDATE
type V_Complex = ValidateUpdateSQL<`
    UPDATE users
    SET name = 'John' , email = 'john@example.com' , active = TRUE
    WHERE id = 1 AND active = FALSE
    RETURNING id , name , email
`, TestSchema>
type _V13 = RequireTrue<AssertEqual<V_Complex, true>>

// Test: UPDATE all (no WHERE)
type V_UpdateAll = ValidateUpdateSQL<"UPDATE users SET active = FALSE", TestSchema>
type _V14 = RequireTrue<AssertEqual<V_UpdateAll, true>>

// ============================================================================
// WITH Clause (CTE) Validation Tests
// ============================================================================

// Test: WITH ... UPDATE is valid
// Note: CTE validation requires the CTE to be properly parsed, which may have simplified validation
type V_WithUpdate = ValidateUpdateSQL<"WITH target AS ( SELECT id FROM users WHERE active = FALSE ) UPDATE users SET active = TRUE WHERE id = 1", TestSchema>
type _V15 = RequireTrue<AssertEqual<V_WithUpdate, true>>

// Test: WITH ... UPDATE with RETURNING
type V_WithReturning = ValidateUpdateSQL<"WITH target AS ( SELECT id FROM users ) UPDATE users SET name = 'test' WHERE id = 1 RETURNING id , name", TestSchema>
type _V16 = RequireTrue<AssertEqual<V_WithReturning, true>>

// ============================================================================
// FROM with JOIN Validation Tests
// ============================================================================

// Test: UPDATE FROM with JOIN
type V_FromJoin = ValidateUpdateSQL<"UPDATE orders SET total = 100 FROM users JOIN products ON users.id = products.id WHERE orders.user_id = users.id", TestSchema>
type _V17 = RequireTrue<AssertEqual<V_FromJoin, true>>

// ============================================================================
// Export for verification
// ============================================================================

export type UpdateValidatorTestsPass = true

