/**
 * INSERT Matcher Type Tests
 *
 * Tests for the InsertResult type and schema matching functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
  InsertResult,
  InsertInput,
  MatchInsertQuery,
  ParseInsertSQL,
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
// Basic INSERT Result Tests (without RETURNING)
// ============================================================================

// Test: INSERT without RETURNING returns void
type M_NoReturning = InsertResult<
  "INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' )",
  TestSchema
>
type _M1 = RequireTrue<AssertEqual<M_NoReturning, void>>

// Test: INSERT with multiple rows without RETURNING
type M_MultiRow = InsertResult<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) , ( 2 , 'Jane' )",
  TestSchema
>
type _M2 = RequireTrue<AssertEqual<M_MultiRow, void>>

// ============================================================================
// RETURNING * Tests
// ============================================================================

// Test: RETURNING * returns full table row
type M_ReturningStar = InsertResult<
  "INSERT INTO users ( id , name , email , active ) VALUES ( 1 , 'John' , 'john@example.com' , TRUE ) RETURNING *",
  TestSchema
>
type _M3 = RequireTrue<
  AssertEqual<M_ReturningStar, { id: number; name: string; email: string; active: boolean }>
>

// Test: RETURNING * from posts table
type M_ReturningStarPosts = InsertResult<
  "INSERT INTO posts ( id , title , content , author_id ) VALUES ( 1 , 'Title' , 'Content' , 1 ) RETURNING *",
  TestSchema
>
type _M4 = RequireTrue<
  AssertEqual<M_ReturningStarPosts, { id: number; title: string; content: string; author_id: number }>
>

// ============================================================================
// RETURNING Specific Columns Tests
// ============================================================================

// Test: RETURNING single column
type M_ReturningSingle = InsertResult<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING id",
  TestSchema
>
type _M5 = RequireTrue<AssertEqual<M_ReturningSingle, { id: number }>>

// Test: RETURNING multiple columns
type M_ReturningMulti = InsertResult<
  "INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' ) RETURNING id , name",
  TestSchema
>
type _M6 = RequireTrue<AssertEqual<M_ReturningMulti, { id: number; name: string }>>

// Test: RETURNING all columns explicitly
type M_ReturningAllExplicit = InsertResult<
  "INSERT INTO users ( id , name , email , active ) VALUES ( 1 , 'John' , 'john@example.com' , TRUE ) RETURNING id , name , email , active",
  TestSchema
>
type _M7 = RequireTrue<
  AssertEqual<M_ReturningAllExplicit, { id: number; name: string; email: string; active: boolean }>
>

// ============================================================================
// Schema.Table Tests
// ============================================================================

// Test: Schema-qualified table with RETURNING
type M_SchemaTable = InsertResult<
  "INSERT INTO admin.settings ( key , value ) VALUES ( 'theme' , 'dark' ) RETURNING *",
  TestSchema
>
type _M8 = RequireTrue<AssertEqual<M_SchemaTable, { key: string; value: string }>>

// Test: Explicit public schema
type M_PublicSchema = InsertResult<
  "INSERT INTO public.users ( id , name ) VALUES ( 1 , 'John' ) RETURNING name",
  TestSchema
>
type _M9 = RequireTrue<AssertEqual<M_PublicSchema, { name: string }>>

// ============================================================================
// ON CONFLICT with RETURNING Tests
// ============================================================================

// Test: ON CONFLICT DO NOTHING with RETURNING
type M_ConflictNothing = InsertResult<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT DO NOTHING RETURNING id",
  TestSchema
>
type _M10 = RequireTrue<AssertEqual<M_ConflictNothing, { id: number }>>

// Test: ON CONFLICT DO UPDATE with RETURNING
type M_ConflictUpdate = InsertResult<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT ( id ) DO UPDATE SET name = 'Updated' RETURNING *",
  TestSchema
>
type _M11 = RequireTrue<
  AssertEqual<M_ConflictUpdate, { id: number; name: string; email: string; active: boolean }>
>

// ============================================================================
// InsertInput Tests
// ============================================================================

// Test: InsertInput with column list
type I_WithCols = InsertInput<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' )",
  TestSchema
>
type _I1 = RequireTrue<AssertEqual<I_WithCols, { id: number; name: string }>>

// Test: InsertInput with all columns
type I_AllCols = InsertInput<
  "INSERT INTO users ( id , name , email , active ) VALUES ( 1 , 'John' , 'john@example.com' , TRUE )",
  TestSchema
>
type _I2 = RequireTrue<
  AssertEqual<I_AllCols, { id: number; name: string; email: string; active: boolean }>
>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: RETURNING non-existent column
type M_BadReturningCol = InsertResult<
  "INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING nonexistent",
  TestSchema
>
type _M12 = RequireTrue<AssertIsMatchError<M_BadReturningCol>>

// Test: Non-existent table
type M_BadTable = InsertResult<
  "INSERT INTO nonexistent ( id ) VALUES ( 1 ) RETURNING *",
  TestSchema
>
type _M13 = RequireTrue<AssertIsMatchError<M_BadTable>>

// Test: Non-existent schema
type M_BadSchema = InsertResult<
  "INSERT INTO fake.users ( id ) VALUES ( 1 ) RETURNING *",
  TestSchema
>
type _M14 = RequireTrue<AssertIsMatchError<M_BadSchema>>

// ============================================================================
// Export for verification
// ============================================================================

export type InsertMatcherTestsPass = true

