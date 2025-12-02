/**
 * UPDATE Matcher Type Tests
 *
 * Tests for the UpdateResult type and schema matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
  UpdateResult,
  MatchUpdateQuery,
  ParseUpdateSQL,
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
// Basic UPDATE Result Tests (without RETURNING)
// ============================================================================

// Test: UPDATE without RETURNING returns void
type M_NoReturning = UpdateResult<"UPDATE users SET name = 'John'", TestSchema>
type _M1 = RequireTrue<AssertEqual<M_NoReturning, void>>

// Test: UPDATE with WHERE without RETURNING
type M_WhereNoReturning = UpdateResult<
  "UPDATE users SET name = 'John' WHERE id = 1",
  TestSchema
>
type _M2 = RequireTrue<AssertEqual<M_WhereNoReturning, void>>

// ============================================================================
// RETURNING * Tests
// ============================================================================

// Test: RETURNING * returns full table row
type M_ReturningStar = UpdateResult<"UPDATE users SET name = 'John' RETURNING *", TestSchema>
type _M3 = RequireTrue<
  AssertEqual<M_ReturningStar, { id: number; name: string; email: string; active: boolean }>
>

// Test: RETURNING * from posts table
type M_ReturningStarPosts = UpdateResult<
  "UPDATE posts SET title = 'New Title' RETURNING *",
  TestSchema
>
type _M4 = RequireTrue<
  AssertEqual<M_ReturningStarPosts, { id: number; title: string; content: string; author_id: number }>
>

// ============================================================================
// RETURNING Specific Columns Tests
// ============================================================================

// Test: RETURNING single column
type M_ReturningSingle = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING id",
  TestSchema
>
type _M5 = RequireTrue<AssertEqual<M_ReturningSingle, { id: number }>>

// Test: RETURNING multiple columns
type M_ReturningMulti = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING id , name",
  TestSchema
>
type _M6 = RequireTrue<AssertEqual<M_ReturningMulti, { id: number; name: string }>>

// Test: RETURNING all columns explicitly
type M_ReturningAllExplicit = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING id , name , email , active",
  TestSchema
>
type _M7 = RequireTrue<
  AssertEqual<M_ReturningAllExplicit, { id: number; name: string; email: string; active: boolean }>
>

// ============================================================================
// RETURNING OLD/NEW Tests (PostgreSQL 17+)
// ============================================================================

// Test: RETURNING OLD.* returns full row with old_ prefix
type M_ReturningOldStar = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING OLD.*",
  TestSchema
>
type _M8 = RequireTrue<
  AssertEqual<
    M_ReturningOldStar,
    { old_id: number; old_name: string; old_email: string; old_active: boolean }
  >
>

// Test: RETURNING NEW.* returns full row with new_ prefix
type M_ReturningNewStar = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING NEW.*",
  TestSchema
>
type _M9 = RequireTrue<
  AssertEqual<
    M_ReturningNewStar,
    { new_id: number; new_name: string; new_email: string; new_active: boolean }
  >
>

// Test: RETURNING OLD.column returns prefixed column
type M_ReturningOldCol = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING OLD.name",
  TestSchema
>
type _M10 = RequireTrue<AssertEqual<M_ReturningOldCol, { old_name: string }>>

// Test: RETURNING NEW.column returns prefixed column
type M_ReturningNewCol = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING NEW.name",
  TestSchema
>
type _M11 = RequireTrue<AssertEqual<M_ReturningNewCol, { new_name: string }>>

// Test: Mixed RETURNING with OLD and NEW
type M_ReturningMixed = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING OLD.name , NEW.name",
  TestSchema
>
type _M12 = RequireTrue<AssertEqual<M_ReturningMixed, { old_name: string; new_name: string }>>

// ============================================================================
// Schema.Table Tests
// ============================================================================

// Test: Schema-qualified table with RETURNING
type M_SchemaTable = UpdateResult<
  "UPDATE admin.settings SET value = 'dark' RETURNING *",
  TestSchema
>
type _M13 = RequireTrue<AssertEqual<M_SchemaTable, { key: string; value: string }>>

// Test: Explicit public schema
type M_PublicSchema = UpdateResult<
  "UPDATE public.users SET name = 'John' RETURNING name",
  TestSchema
>
type _M14 = RequireTrue<AssertEqual<M_PublicSchema, { name: string }>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: RETURNING non-existent column
type M_BadReturningCol = UpdateResult<
  "UPDATE users SET name = 'John' RETURNING nonexistent",
  TestSchema
>
type _M15 = RequireTrue<AssertIsMatchError<M_BadReturningCol>>

// Test: Non-existent table
type M_BadTable = UpdateResult<"UPDATE nonexistent SET name = 'John' RETURNING *", TestSchema>
type _M16 = RequireTrue<AssertIsMatchError<M_BadTable>>

// Test: Non-existent schema
type M_BadSchema = UpdateResult<"UPDATE fake.users SET name = 'John' RETURNING *", TestSchema>
type _M17 = RequireTrue<AssertIsMatchError<M_BadSchema>>

// ============================================================================
// Export for verification
// ============================================================================

export type UpdateMatcherTestsPass = true

