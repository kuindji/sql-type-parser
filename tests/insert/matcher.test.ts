/**
 * INSERT Matcher Type Tests
 *
 * Tests for the InsertResult type and related matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    InsertResult,
    InsertInput,
    MatchInsertQuery,
    ParseInsertSQL,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsMatchError } from "../helpers.js"

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
// InsertResult - No RETURNING (returns void)
// ============================================================================

// Test: INSERT without RETURNING returns void
type IR_NoReturning = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' )", TestSchema>
type _IR1 = RequireTrue<AssertEqual<IR_NoReturning, void>>

// Test: INSERT with multiple rows, no RETURNING
type IR_MultiRowNoReturning = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) , ( 2 , 'Jane' )", TestSchema>
type _IR2 = RequireTrue<AssertEqual<IR_MultiRowNoReturning, void>>

// ============================================================================
// InsertResult - RETURNING *
// ============================================================================

// Test: RETURNING * returns full row type
type IR_ReturningStar = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING *", TestSchema>
type _IR3 = RequireTrue<AssertEqual<IR_ReturningStar, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: RETURNING * from schema-qualified table
type IR_SchemaReturningStar = InsertResult<"INSERT INTO audit.logs ( id , user_id , action ) VALUES ( 1 , 1 , 'login' ) RETURNING *", TestSchema>
type _IR4 = RequireTrue<AssertEqual<IR_SchemaReturningStar, {
    id: number
    user_id: number
    action: string
    timestamp: string
}>>

// ============================================================================
// InsertResult - RETURNING specific columns
// ============================================================================

// Test: RETURNING single column
type IR_SingleColumn = InsertResult<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING id", TestSchema>
type _IR5 = RequireTrue<AssertEqual<IR_SingleColumn, { id: number }>>

// Test: RETURNING multiple columns
type IR_MultiColumn = InsertResult<"INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' ) RETURNING id , name", TestSchema>
type _IR6 = RequireTrue<AssertEqual<IR_MultiColumn, { id: number; name: string }>>

// Test: RETURNING all columns explicitly
type IR_AllColumnsExplicit = InsertResult<"INSERT INTO users ( id ) VALUES ( 1 ) RETURNING id , name , email , active , created_at", TestSchema>
type _IR7 = RequireTrue<AssertEqual<IR_AllColumnsExplicit, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// ============================================================================
// InsertResult - Error Cases
// ============================================================================

// Test: Invalid table returns error
type IR_InvalidTable = InsertResult<"INSERT INTO nonexistent ( id ) VALUES ( 1 ) RETURNING *", TestSchema>
type _IR8 = RequireTrue<AssertIsMatchError<IR_InvalidTable>>

// Test: Invalid RETURNING column returns error
type IR_InvalidColumn = InsertResult<"INSERT INTO users ( id ) VALUES ( 1 ) RETURNING invalid_col", TestSchema>
type _IR9 = RequireTrue<AssertIsMatchError<IR_InvalidColumn>>

// ============================================================================
// InsertInput - Expected input type
// ============================================================================

// Test: Input type with explicit column list
type II_ExplicitCols = InsertInput<"INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' )", TestSchema>
type _II1 = RequireTrue<AssertEqual<II_ExplicitCols, { id: number; name: string; email: string }>>

// Test: Input type with single column
type II_SingleCol = InsertInput<"INSERT INTO users ( id ) VALUES ( 1 )", TestSchema>
type _II2 = RequireTrue<AssertEqual<II_SingleCol, { id: number }>>

// Test: Input type from schema-qualified table
type II_SchemaTable = InsertInput<"INSERT INTO audit.logs ( id , user_id ) VALUES ( 1 , 1 )", TestSchema>
type _II3 = RequireTrue<AssertEqual<II_SchemaTable, { id: number; user_id: number }>>

// ============================================================================
// Complex Queries
// ============================================================================

// Test: Full INSERT with ON CONFLICT and RETURNING
type IR_Full = InsertResult<`
    INSERT INTO users ( id , name , email )
    VALUES ( 1 , 'John' , 'john@example.com' )
    ON CONFLICT ( id ) DO UPDATE SET name = 'Updated'
    RETURNING id , name , email
`, TestSchema>
type _IR10 = RequireTrue<AssertEqual<IR_Full, { id: number; name: string; email: string }>>

// Test: INSERT with ON CONFLICT DO NOTHING and RETURNING *
type IR_ConflictNothing = InsertResult<`
    INSERT INTO orders ( id , user_id , total , status )
    VALUES ( 1 , 1 , 99.99 , 'pending' )
    ON CONFLICT DO NOTHING
    RETURNING *
`, TestSchema>
type _IR11 = RequireTrue<AssertEqual<IR_ConflictNothing, {
    id: number
    user_id: number
    total: number
    status: string
}>>

// ============================================================================
// Export for verification
// ============================================================================

export type InsertMatcherTestsPass = true

