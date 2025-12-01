/**
 * UPDATE Matcher Type Tests
 *
 * Tests for the UpdateResult type and related matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    UpdateResult,
    MatchUpdateQuery,
    ParseUpdateSQL,
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
// UpdateResult - No RETURNING (returns void)
// ============================================================================

// Test: UPDATE without RETURNING returns void
type UR_NoReturning = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1", TestSchema>
type _UR1 = RequireTrue<AssertEqual<UR_NoReturning, void>>

// Test: UPDATE all rows, no RETURNING
type UR_UpdateAll = UpdateResult<"UPDATE users SET active = FALSE", TestSchema>
type _UR2 = RequireTrue<AssertEqual<UR_UpdateAll, void>>

// Test: UPDATE with complex SET, no RETURNING
type UR_ComplexSet = UpdateResult<"UPDATE users SET name = 'John' , email = 'john@example.com' , active = TRUE WHERE id = 1", TestSchema>
type _UR3 = RequireTrue<AssertEqual<UR_ComplexSet, void>>

// ============================================================================
// UpdateResult - RETURNING *
// ============================================================================

// Test: RETURNING * returns full row type
type UR_ReturningStar = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING *", TestSchema>
type _UR4 = RequireTrue<AssertEqual<UR_ReturningStar, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: RETURNING * from schema-qualified table
type UR_SchemaReturningStar = UpdateResult<"UPDATE audit.logs SET action = 'updated' WHERE id = 1 RETURNING *", TestSchema>
type _UR5 = RequireTrue<AssertEqual<UR_SchemaReturningStar, {
    id: number
    user_id: number
    action: string
    timestamp: string
}>>

// Test: RETURNING * from different table
type UR_OrdersReturningStar = UpdateResult<"UPDATE orders SET status = 'shipped' WHERE id = 1 RETURNING *", TestSchema>
type _UR6 = RequireTrue<AssertEqual<UR_OrdersReturningStar, {
    id: number
    user_id: number
    total: number
    status: string
}>>

// ============================================================================
// UpdateResult - RETURNING specific columns
// ============================================================================

// Test: RETURNING single column
type UR_SingleColumn = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id", TestSchema>
type _UR7 = RequireTrue<AssertEqual<UR_SingleColumn, { id: number }>>

// Test: RETURNING multiple columns
type UR_MultiColumn = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name , email", TestSchema>
type _UR8 = RequireTrue<AssertEqual<UR_MultiColumn, { id: number; name: string; email: string }>>

// Test: RETURNING all columns explicitly
type UR_AllColumnsExplicit = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name , email , active , created_at", TestSchema>
type _UR9 = RequireTrue<AssertEqual<UR_AllColumnsExplicit, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: RETURNING columns from orders table
type UR_OrdersColumns = UpdateResult<"UPDATE orders SET status = 'shipped' WHERE id = 1 RETURNING id , total , status", TestSchema>
type _UR10 = RequireTrue<AssertEqual<UR_OrdersColumns, { id: number; total: number; status: string }>>

// ============================================================================
// UpdateResult - OLD/NEW Qualified References (PostgreSQL 17+)
// ============================================================================

// Test: RETURNING OLD.* returns pre-update values with old_ prefix
type UR_OldStar = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.*", TestSchema>
type _UR_Old1 = RequireTrue<AssertEqual<UR_OldStar, {
    old_id: number
    old_name: string
    old_email: string
    old_active: boolean
    old_created_at: string
}>>

// Test: RETURNING NEW.* returns post-update values with new_ prefix
type UR_NewStar = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.*", TestSchema>
type _UR_New1 = RequireTrue<AssertEqual<UR_NewStar, {
    new_id: number
    new_name: string
    new_email: string
    new_active: boolean
    new_created_at: string
}>>

// Test: RETURNING OLD.column returns single old value
type UR_OldCol = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING OLD.name", TestSchema>
type _UR_Old2 = RequireTrue<AssertEqual<UR_OldCol, { old_name: string }>>

// Test: RETURNING NEW.column returns single new value
type UR_NewCol = UpdateResult<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING NEW.name", TestSchema>
type _UR_New2 = RequireTrue<AssertEqual<UR_NewCol, { new_name: string }>>

// Test: Mixed OLD and NEW columns
type UR_MixedOldNew = UpdateResult<"UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING OLD.name , NEW.name , id", TestSchema>
type _UR_Mixed = RequireTrue<AssertEqual<UR_MixedOldNew, { old_name: string; new_name: string; id: number }>>

// Test: RETURNING OLD.* and NEW.* together
type UR_BothStar = UpdateResult<"UPDATE users SET name = 'Jane' WHERE id = 1 RETURNING OLD.* , NEW.*", TestSchema>
type _UR_Both = RequireTrue<AssertEqual<UR_BothStar, {
    old_id: number
    old_name: string
    old_email: string
    old_active: boolean
    old_created_at: string
    new_id: number
    new_name: string
    new_email: string
    new_active: boolean
    new_created_at: string
}>>

// Test: OLD and NEW with unqualified column
type UR_OldNewUnqualified = UpdateResult<"UPDATE users SET email = 'new@test.com' WHERE id = 1 RETURNING OLD.email , email , NEW.email", TestSchema>
type _UR_OldNewUQ = RequireTrue<AssertEqual<UR_OldNewUnqualified, { old_email: string; email: string; new_email: string }>>

// ============================================================================
// UpdateResult - Error Cases
// ============================================================================

// Test: Invalid table returns error
type UR_InvalidTable = UpdateResult<"UPDATE nonexistent SET name = 'John' RETURNING *", TestSchema>
type _UR11 = RequireTrue<AssertIsMatchError<UR_InvalidTable>>

// Test: Invalid RETURNING column returns error
type UR_InvalidColumn = UpdateResult<"UPDATE users SET name = 'John' RETURNING invalid_col", TestSchema>
type _UR12 = RequireTrue<AssertIsMatchError<UR_InvalidColumn>>

// Test: Invalid schema returns error
type UR_InvalidSchema = UpdateResult<"UPDATE invalid_schema.users SET name = 'John' RETURNING *", TestSchema>
type _UR13 = RequireTrue<AssertIsMatchError<UR_InvalidSchema>>

// ============================================================================
// UpdateResult with FROM clause
// ============================================================================

// Test: UPDATE with FROM, no RETURNING
type UR_FromNoReturn = UpdateResult<"UPDATE orders SET status = 'cancelled' FROM users WHERE orders.user_id = users.id", TestSchema>
type _UR14 = RequireTrue<AssertEqual<UR_FromNoReturn, void>>

// Test: UPDATE with FROM and RETURNING
type UR_FromWithReturn = UpdateResult<"UPDATE orders SET status = 'cancelled' FROM users WHERE orders.user_id = users.id RETURNING *", TestSchema>
type _UR15 = RequireTrue<AssertEqual<UR_FromWithReturn, {
    id: number
    user_id: number
    total: number
    status: string
}>>

// ============================================================================
// Complex Queries
// ============================================================================

// Test: Full UPDATE with SET, WHERE and RETURNING
type UR_Full = UpdateResult<`
    UPDATE users
    SET name = 'John' , email = 'john@example.com'
    WHERE active = FALSE
    RETURNING id , name , email
`, TestSchema>
type _UR16 = RequireTrue<AssertEqual<UR_Full, { id: number; name: string; email: string }>>

// Test: UPDATE order_items
type UR_OrderItems = UpdateResult<"UPDATE order_items SET quantity = 5 , price = 19.99 WHERE id = 1 RETURNING id , quantity , price", TestSchema>
type _UR17 = RequireTrue<AssertEqual<UR_OrderItems, { id: number; quantity: number; price: number }>>

// Test: UPDATE with table alias and RETURNING
type UR_WithAlias = UpdateResult<"UPDATE users AS u SET name = 'John' WHERE u.id = 1 RETURNING *", TestSchema>
type _UR18 = RequireTrue<AssertEqual<UR_WithAlias, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// ============================================================================
// MatchUpdateQuery direct usage
// ============================================================================

// Test: MatchUpdateQuery with parsed query
type Parsed = ParseUpdateSQL<"UPDATE users SET name = 'John' WHERE id = 1 RETURNING id , name">
type Matched = MatchUpdateQuery<Parsed, TestSchema>
type _M1 = RequireTrue<AssertEqual<Matched, { id: number; name: string }>>

// Test: MatchUpdateQuery without RETURNING
type ParsedNoReturn = ParseUpdateSQL<"UPDATE orders SET status = 'pending'">
type MatchedNoReturn = MatchUpdateQuery<ParsedNoReturn, TestSchema>
type _M2 = RequireTrue<AssertEqual<MatchedNoReturn, void>>

// ============================================================================
// Edge Cases
// ============================================================================

// Test: UPDATE with quoted table name
type UR_QuotedTable = UpdateResult<'UPDATE "users" SET name = \'John\' WHERE id = 1 RETURNING *', TestSchema>
type _UR19 = RequireTrue<AssertEqual<UR_QuotedTable, {
    id: number
    name: string
    email: string
    active: boolean
    created_at: string
}>>

// Test: UPDATE with quoted column in RETURNING
type UR_QuotedColumn = UpdateResult<'UPDATE users SET name = \'John\' WHERE id = 1 RETURNING "id" , "name"', TestSchema>
type _UR20 = RequireTrue<AssertEqual<UR_QuotedColumn, { id: number; name: string }>>

// ============================================================================
// Export for verification
// ============================================================================

export type UpdateMatcherTestsPass = true

