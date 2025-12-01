/**
 * DELETE Matcher Type Tests
 *
 * Tests for the DeleteResult type and related matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    DeleteResult,
    MatchDeleteQuery,
    ParseDeleteSQL,
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
            order_items: {
                id: number
                order_id: number
                product_id: number
                quantity: number
                price: number
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
// DeleteResult - No RETURNING (returns void)
// ============================================================================

// Test: DELETE without RETURNING returns void
type DR_NoReturning = DeleteResult<"DELETE FROM users WHERE id = 1", TestSchema>
type _DR1 = RequireTrue<AssertEqual<DR_NoReturning, void>>

// Test: DELETE all rows, no RETURNING
type DR_DeleteAll = DeleteResult<"DELETE FROM users", TestSchema>
type _DR2 = RequireTrue<AssertEqual<DR_DeleteAll, void>>

// Test: DELETE with complex WHERE, no RETURNING
type DR_ComplexWhere = DeleteResult<"DELETE FROM users WHERE active = FALSE AND created_at < '2024-01-01'", TestSchema>
type _DR3 = RequireTrue<AssertEqual<DR_ComplexWhere, void>>

// ============================================================================
// DeleteResult - RETURNING *
// ============================================================================

// Test: RETURNING * returns full row type
type DR_ReturningStar = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING *", TestSchema>
type _DR4 = RequireTrue<AssertEqual<DR_ReturningStar, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: RETURNING * from schema-qualified table
type DR_SchemaReturningStar = DeleteResult<"DELETE FROM audit.logs WHERE id = 1 RETURNING *", TestSchema>
type _DR5 = RequireTrue<AssertEqual<DR_SchemaReturningStar, {
    id: number
    user_id: number
    action: string
    timestamp: string
}>>

// Test: RETURNING * from different table
type DR_OrdersReturningStar = DeleteResult<"DELETE FROM orders WHERE status = 'cancelled' RETURNING *", TestSchema>
type _DR6 = RequireTrue<AssertEqual<DR_OrdersReturningStar, {
    id: number
    user_id: number
    total: number
    status: string
}>>

// ============================================================================
// DeleteResult - RETURNING specific columns
// ============================================================================

// Test: RETURNING single column
type DR_SingleColumn = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING id", TestSchema>
type _DR7 = RequireTrue<AssertEqual<DR_SingleColumn, { id: number }>>

// Test: RETURNING multiple columns
type DR_MultiColumn = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING id , name , email", TestSchema>
type _DR8 = RequireTrue<AssertEqual<DR_MultiColumn, { id: number; name: string; email: string }>>

// Test: RETURNING all columns explicitly
type DR_AllColumnsExplicit = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING id , name , email , active , created_at", TestSchema>
type _DR9 = RequireTrue<AssertEqual<DR_AllColumnsExplicit, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: RETURNING columns from orders table
type DR_OrdersColumns = DeleteResult<"DELETE FROM orders WHERE id = 1 RETURNING id , total , status", TestSchema>
type _DR10 = RequireTrue<AssertEqual<DR_OrdersColumns, { id: number; total: number; status: string }>>

// ============================================================================
// DeleteResult - Error Cases
// ============================================================================

// Test: Invalid table returns error
type DR_InvalidTable = DeleteResult<"DELETE FROM nonexistent WHERE id = 1 RETURNING *", TestSchema>
type _DR11 = RequireTrue<AssertIsMatchError<DR_InvalidTable>>

// Test: Invalid RETURNING column returns error
type DR_InvalidColumn = DeleteResult<"DELETE FROM users WHERE id = 1 RETURNING invalid_col", TestSchema>
type _DR12 = RequireTrue<AssertIsMatchError<DR_InvalidColumn>>

// Test: Invalid schema returns error
type DR_InvalidSchema = DeleteResult<"DELETE FROM invalid_schema.users WHERE id = 1 RETURNING *", TestSchema>
type _DR13 = RequireTrue<AssertIsMatchError<DR_InvalidSchema>>

// ============================================================================
// DeleteResult with USING clause
// ============================================================================

// Test: DELETE with USING, no RETURNING
type DR_UsingNoReturn = DeleteResult<"DELETE FROM orders USING users WHERE orders.user_id = users.id", TestSchema>
type _DR14 = RequireTrue<AssertEqual<DR_UsingNoReturn, void>>

// Test: DELETE with USING and RETURNING
type DR_UsingWithReturn = DeleteResult<"DELETE FROM orders USING users WHERE orders.user_id = users.id RETURNING *", TestSchema>
type _DR15 = RequireTrue<AssertEqual<DR_UsingWithReturn, {
    id: number
    user_id: number
    total: number
    status: string
}>>

// ============================================================================
// Complex Queries
// ============================================================================

// Test: Full DELETE with WHERE and RETURNING
type DR_Full = DeleteResult<`
    DELETE FROM users
    WHERE active = FALSE
    RETURNING id , name , email
`, TestSchema>
type _DR16 = RequireTrue<AssertEqual<DR_Full, { id: number; name: string; email: string }>>

// Test: DELETE from order_items
type DR_OrderItems = DeleteResult<"DELETE FROM order_items WHERE order_id = 1 RETURNING id , quantity , price", TestSchema>
type _DR17 = RequireTrue<AssertEqual<DR_OrderItems, { id: number; quantity: number; price: number }>>

// Test: DELETE with table alias and RETURNING
type DR_WithAlias = DeleteResult<"DELETE FROM users AS u WHERE u.active = FALSE RETURNING *", TestSchema>
type _DR18 = RequireTrue<AssertEqual<DR_WithAlias, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// ============================================================================
// MatchDeleteQuery direct usage
// ============================================================================

// Test: MatchDeleteQuery with parsed query
type Parsed = ParseDeleteSQL<"DELETE FROM users WHERE id = 1 RETURNING id , name">
type Matched = MatchDeleteQuery<Parsed, TestSchema>
type _M1 = RequireTrue<AssertEqual<Matched, { id: number; name: string }>>

// Test: MatchDeleteQuery without RETURNING
type ParsedNoReturn = ParseDeleteSQL<"DELETE FROM orders">
type MatchedNoReturn = MatchDeleteQuery<ParsedNoReturn, TestSchema>
type _M2 = RequireTrue<AssertEqual<MatchedNoReturn, void>>

// ============================================================================
// Edge Cases
// ============================================================================

// Test: DELETE with quoted table name
type DR_QuotedTable = DeleteResult<'DELETE FROM "users" WHERE id = 1 RETURNING *', TestSchema>
type _DR19 = RequireTrue<AssertEqual<DR_QuotedTable, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: DELETE with quoted column in RETURNING
type DR_QuotedColumn = DeleteResult<'DELETE FROM users WHERE id = 1 RETURNING "id" , "name"', TestSchema>
type _DR20 = RequireTrue<AssertEqual<DR_QuotedColumn, { id: number; name: string }>>

// ============================================================================
// JSON Operator Tests
// ============================================================================

// Schema with JSON fields
type JsonSchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            items: {
                id: number
                data: { settings: { enabled: boolean }; tags: string[] }
            }
        }
    }
}

// Test: JSON accessor in WHERE clause validates base column
type DR_JsonWhere = DeleteResult<"DELETE FROM items WHERE data->>'key' = 'value' RETURNING id", JsonSchema>
type _DR21 = RequireTrue<AssertEqual<DR_JsonWhere, { id: number }>>

// Test: Nested JSON accessor in WHERE validates base column
type DR_JsonWhereNested = DeleteResult<"DELETE FROM items WHERE data->'settings'->>'enabled' = 'true' RETURNING id", JsonSchema>
type _DR22 = RequireTrue<AssertEqual<DR_JsonWhereNested, { id: number }>>

// ============================================================================
// Export for verification
// ============================================================================

export type DeleteMatcherTestsPass = true

