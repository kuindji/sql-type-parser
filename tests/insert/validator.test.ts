/**
 * INSERT Validator Type Tests
 *
 * Tests for the ValidateInsertSQL type and related validation functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ValidateInsertSQL,
    InsertResult,
    InsertInput,
    IsValidInsert,
    GetInsertTableColumns,
    MatchInsertQuery,
    ParseInsertSQL,
    SQLInsertQuery,
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

// Test: Valid INSERT into existing table
type V_ValidBasic = ValidateInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' )", TestSchema>
type _V1 = RequireTrue<AssertEqual<V_ValidBasic, true>>

// Test: Invalid table name
type V_InvalidTable = ValidateInsertSQL<"INSERT INTO nonexistent ( id ) VALUES ( 1 )", TestSchema>
type _V2 = V_InvalidTable extends `Table 'nonexistent' not found${string}` ? true : false
type _V2a = RequireTrue<_V2>

// Test: Invalid column name
type V_InvalidColumn = ValidateInsertSQL<"INSERT INTO users ( nonexistent ) VALUES ( 'test' )", TestSchema>
type _V3 = V_InvalidColumn extends `Column 'nonexistent' not found${string}` ? true : false
type _V3a = RequireTrue<_V3>

// ============================================================================
// Schema-Qualified Table Tests
// ============================================================================

// Test: Valid INSERT with schema prefix
type V_SchemaTable = ValidateInsertSQL<"INSERT INTO public.users ( id ) VALUES ( 1 )", TestSchema>
type _V4 = RequireTrue<AssertEqual<V_SchemaTable, true>>

// Test: Valid INSERT into different schema
type V_AuditSchema = ValidateInsertSQL<"INSERT INTO audit.logs ( id , user_id , action ) VALUES ( 1 , 1 , 'login' )", TestSchema>
type _V5 = RequireTrue<AssertEqual<V_AuditSchema, true>>

// Test: Invalid schema name
type V_InvalidSchema = ValidateInsertSQL<"INSERT INTO nonexistent.users ( id ) VALUES ( 1 )", TestSchema>
type _V6 = V_InvalidSchema extends `Schema 'nonexistent' not found` ? true : false
type _V6a = RequireTrue<_V6>

// ============================================================================
// Column Validation Tests
// ============================================================================

// Test: All columns valid
type V_AllColumnsValid = ValidateInsertSQL<
    "INSERT INTO users ( id , name , email , active ) VALUES ( 1 , 'John' , 'john@example.com' , TRUE )",
    TestSchema
>
type _V7 = RequireTrue<AssertEqual<V_AllColumnsValid, true>>

// Test: Multiple invalid columns (reports first)
type V_MultipleInvalid = ValidateInsertSQL<"INSERT INTO users ( invalid1 , invalid2 ) VALUES ( 1 , 2 )", TestSchema>
type _V8 = V_MultipleInvalid extends `Column 'invalid1' not found${string}` ? true : false
type _V8a = RequireTrue<_V8>

// ============================================================================
// RETURNING Clause Validation Tests
// ============================================================================

// Test: RETURNING * is valid
type V_ReturningStar = ValidateInsertSQL<"INSERT INTO users ( id ) VALUES ( 1 ) RETURNING *", TestSchema>
type _V9 = RequireTrue<AssertEqual<V_ReturningStar, true>>

// Test: RETURNING valid columns
type V_ReturningValid = ValidateInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING id , name", TestSchema>
type _V10 = RequireTrue<AssertEqual<V_ReturningValid, true>>

// Test: RETURNING invalid column
type V_ReturningInvalid = ValidateInsertSQL<"INSERT INTO users ( id ) VALUES ( 1 ) RETURNING invalid_col", TestSchema>
type _V11 = V_ReturningInvalid extends `Column 'invalid_col' not found${string}` ? true : false
type _V11a = RequireTrue<_V11>

// ============================================================================
// ON CONFLICT Validation Tests
// ============================================================================

// Test: ON CONFLICT DO NOTHING is valid
type V_ConflictNothing = ValidateInsertSQL<
    "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT DO NOTHING",
    TestSchema
>
type _V12 = RequireTrue<AssertEqual<V_ConflictNothing, true>>

// Test: ON CONFLICT with valid column target
type V_ConflictTarget = ValidateInsertSQL<
    "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT ( id ) DO NOTHING",
    TestSchema
>
type _V13 = RequireTrue<AssertEqual<V_ConflictTarget, true>>

// Test: ON CONFLICT DO UPDATE with valid SET
type V_ConflictUpdate = ValidateInsertSQL<
    "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT ( id ) DO UPDATE SET name = 'Updated'",
    TestSchema
>
type _V14 = RequireTrue<AssertEqual<V_ConflictUpdate, true>>

// ============================================================================
// IsValidInsert Tests
// ============================================================================

// Test: IsValidInsert for valid query
type IV_Valid = IsValidInsert<"INSERT INTO users ( id ) VALUES ( 1 )", TestSchema>
type _IV1 = RequireTrue<AssertEqual<IV_Valid, true>>

// Test: IsValidInsert for invalid query
type IV_Invalid = IsValidInsert<"INSERT INTO nonexistent ( id ) VALUES ( 1 )", TestSchema>
type _IV2 = RequireTrue<AssertEqual<IV_Invalid, false>>

// ============================================================================
// InsertResult Tests (RETURNING clause result type)
// ============================================================================

// Test: InsertResult without RETURNING returns void
type IR_NoReturning = InsertResult<"INSERT INTO users ( id ) VALUES ( 1 )", TestSchema>
type _IR1 = RequireTrue<AssertEqual<IR_NoReturning, void>>

// Test: InsertResult with RETURNING * returns full row
type IR_ReturningStar = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING *", TestSchema>
type _IR2 = RequireTrue<AssertExtends<IR_ReturningStar, { id: number; name: string; email: string; active: boolean; created_at: string }>>

// Test: InsertResult with specific columns
type IR_ReturningCols = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING id , name", TestSchema>
type _IR3 = RequireTrue<AssertExtends<IR_ReturningCols, { id: number; name: string }>>

// ============================================================================
// InsertInput Tests (expected input type)
// ============================================================================

// Test: InsertInput with column list
type II_WithCols = InsertInput<"INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' )", TestSchema>
type _II1 = RequireTrue<AssertExtends<II_WithCols, { id: number; name: string; email: string }>>

// ============================================================================
// GetInsertTableColumns Tests
// ============================================================================

// Test: Get table columns for INSERT
type GTC_Users = GetInsertTableColumns<"INSERT INTO users ( id ) VALUES ( 1 )", TestSchema>
type _GTC1 = RequireTrue<AssertExtends<GTC_Users, { id: number; name: string; email: string; active: boolean; created_at: string }>>

// Test: Get table columns for schema-qualified INSERT
type GTC_Audit = GetInsertTableColumns<"INSERT INTO audit.logs ( id ) VALUES ( 1 )", TestSchema>
type _GTC2 = RequireTrue<AssertExtends<GTC_Audit, { id: number; user_id: number; action: string; timestamp: string }>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Full complex INSERT
type V_Complex = ValidateInsertSQL<`
    INSERT INTO users ( id , name , email , active )
    VALUES ( 1 , 'John' , 'john@example.com' , TRUE )
    ON CONFLICT ( id ) DO UPDATE SET name = 'Updated'
    RETURNING id , name , email
`, TestSchema>
type _V15 = RequireTrue<AssertEqual<V_Complex, true>>

// Test: INSERT with multiple rows
type V_MultiRow = ValidateInsertSQL<
    "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) , ( 2 , 'Jane' )",
    TestSchema
>
type _V16 = RequireTrue<AssertEqual<V_MultiRow, true>>

// ============================================================================
// Value Count Validation Tests
// ============================================================================

// Note: Value count validation is best-effort at compile time
// and may not catch all mismatches without runtime checks

// Test: Correct value count
type V_CorrectCount = ValidateInsertSQL<
    "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' )",
    TestSchema
>
type _V17 = RequireTrue<AssertEqual<V_CorrectCount, true>>

// ============================================================================
// Export for verification
// ============================================================================

export type InsertValidatorTestsPass = true

