/**
 * DELETE Matcher Type Tests
 *
 * Tests for the DeleteResult type and schema matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
  DeleteResult,
  MatchDeleteQuery,
  ParseDeleteSQL,
  DatabaseSchema,
} from "../../src/index.js"
import type { AssertEqual, RequireTrue, AssertIsMatchError } from "../helpers.js"

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
      }
      posts: {
        id: number
        title: string
        content: string
        author_id: number
      }
      accounts: {
        id: number
        user_id: number
        status: string
      }
    }
    admin: {
      settings: {
        key: string
        value: string
      }
    }
  }
}

// ============================================================================
// Basic DELETE Result Tests (without RETURNING)
// ============================================================================

// Test: DELETE without RETURNING returns void
type M_NoReturning = DeleteResult<"DELETE FROM users WHERE id = 1", TestSchema>
type _M1 = RequireTrue<AssertEqual<M_NoReturning, void>>

// Test: DELETE with complex WHERE without RETURNING
type M_ComplexWhere = DeleteResult<
  "DELETE FROM users WHERE id = 1 AND active = FALSE",
  TestSchema
>
type _M2 = RequireTrue<AssertEqual<M_ComplexWhere, void>>

// Test: DELETE with USING without RETURNING
type M_UsingNoReturning = DeleteResult<
  "DELETE FROM users USING accounts WHERE users.account_id = accounts.id",
  TestSchema
>
type _M3 = RequireTrue<AssertEqual<M_UsingNoReturning, void>>

// ============================================================================
// RETURNING * Tests
// ============================================================================

// Test: RETURNING * returns full table row
type M_ReturningStar = DeleteResult<
  "DELETE FROM users WHERE id = 1 RETURNING *",
  TestSchema
>
type _M4 = RequireTrue<
  AssertEqual<M_ReturningStar, { id: number; name: string; email: string; active: boolean }>
>

// Test: RETURNING * from posts table
type M_ReturningStarPosts = DeleteResult<
  "DELETE FROM posts WHERE id = 1 RETURNING *",
  TestSchema
>
type _M5 = RequireTrue<
  AssertEqual<M_ReturningStarPosts, { id: number; title: string; content: string; author_id: number }>
>

// ============================================================================
// RETURNING Specific Columns Tests
// ============================================================================

// Test: RETURNING single column
type M_ReturningSingle = DeleteResult<
  "DELETE FROM users WHERE id = 1 RETURNING id",
  TestSchema
>
type _M6 = RequireTrue<AssertEqual<M_ReturningSingle, { id: number }>>

// Test: RETURNING multiple columns
type M_ReturningMulti = DeleteResult<
  "DELETE FROM users WHERE id = 1 RETURNING id , name",
  TestSchema
>
type _M7 = RequireTrue<AssertEqual<M_ReturningMulti, { id: number; name: string }>>

// Test: RETURNING all columns explicitly
type M_ReturningAllExplicit = DeleteResult<
  "DELETE FROM users WHERE id = 1 RETURNING id , name , email , active",
  TestSchema
>
type _M8 = RequireTrue<
  AssertEqual<M_ReturningAllExplicit, { id: number; name: string; email: string; active: boolean }>
>

// ============================================================================
// Schema.Table Tests
// ============================================================================

// Test: Schema-qualified table with RETURNING
type M_SchemaTable = DeleteResult<
  "DELETE FROM admin.settings WHERE key = 'theme' RETURNING *",
  TestSchema
>
type _M9 = RequireTrue<AssertEqual<M_SchemaTable, { key: string; value: string }>>

// Test: Explicit public schema
type M_PublicSchema = DeleteResult<
  "DELETE FROM public.users WHERE id = 1 RETURNING name",
  TestSchema
>
type _M10 = RequireTrue<AssertEqual<M_PublicSchema, { name: string }>>

// ============================================================================
// USING with RETURNING Tests
// ============================================================================

// Test: USING with RETURNING
type M_UsingReturning = DeleteResult<
  "DELETE FROM users USING accounts WHERE users.account_id = accounts.id RETURNING id , name",
  TestSchema
>
type _M11 = RequireTrue<AssertEqual<M_UsingReturning, { id: number; name: string }>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: RETURNING non-existent column
type M_BadReturningCol = DeleteResult<
  "DELETE FROM users WHERE id = 1 RETURNING nonexistent",
  TestSchema
>
type _M12 = RequireTrue<AssertIsMatchError<M_BadReturningCol>>

// Test: Non-existent table
type M_BadTable = DeleteResult<
  "DELETE FROM nonexistent WHERE id = 1 RETURNING *",
  TestSchema
>
type _M13 = RequireTrue<AssertIsMatchError<M_BadTable>>

// Test: Non-existent schema
type M_BadSchema = DeleteResult<
  "DELETE FROM fake.users WHERE id = 1 RETURNING *",
  TestSchema
>
type _M14 = RequireTrue<AssertIsMatchError<M_BadSchema>>

// ============================================================================
// Export for verification
// ============================================================================

export type DeleteMatcherTestsPass = true

