/**
 * Parameter Type Tests
 *
 * Tests for parameter extraction and database integration types.
 * If this file compiles without errors, all tests pass.
 */

import type {
  ExtractParams,
  ParamCount,
  MaxParamNumber,
  TypedParamTuple,
  QueryResult,
  ValidateSQL,
  SelectResult,
  SelectResultArray,
  IsValidSelect,
} from "../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue } from "./helpers.js"

// Schema for testing
type TestSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
      users: {
        id: number
        name: string
        email: string
        role: "admin" | "user"
        is_active: boolean
      }
      posts: {
        id: number
        user_id: number
        title: string
        views: number
      }
    }
  }
}

// ============================================================================
// Parameter Extraction Tests
// ============================================================================

// Test: Extract single parameter
type _ExtractSingle = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM users WHERE id = $1">,
  ["$1"]
>>

// Test: Extract multiple parameters
type _ExtractMultiple = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM users WHERE id = $1 AND name = $2">,
  ["$1", "$2"]
>>

// Test: Extract three parameters
type _ExtractThree = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM users WHERE id = $1 AND name = $2 AND role = $3">,
  ["$1", "$2", "$3"]
>>

// Test: Handle gaps in parameter numbers
type _ExtractGaps = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM users WHERE id = $1 OR id = $3">,
  ["$1", "$3"]
>>

// Test: No parameters
type _ExtractNone = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM users">,
  []
>>

// Test: Double-digit parameters
type _ExtractDoubleDigit = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM t WHERE a = $10">,
  ["$10"]
>>

// Test: Multiple double-digit parameters
type _ExtractMultiDoubleDigit = RequireTrue<AssertEqual<
  ExtractParams<"SELECT * FROM t WHERE a = $1 AND b = $10 AND c = $5">,
  ["$1", "$10", "$5"]
>>

// ============================================================================
// Parameter Count Tests
// ============================================================================

// Test: Count single parameter
type _CountSingle = RequireTrue<AssertEqual<ParamCount<"SELECT * FROM users WHERE id = $1">, 1>>

// Test: Count multiple parameters
type _CountMultiple = RequireTrue<AssertEqual<
  ParamCount<"SELECT * FROM users WHERE id = $1 AND name = $2">,
  2
>>

// Test: Count no parameters
type _CountNone = RequireTrue<AssertEqual<ParamCount<"SELECT * FROM users">, 0>>

// Test: Deduplicates repeated parameters
type _CountDedup = RequireTrue<AssertEqual<
  ParamCount<"SELECT * FROM users WHERE id = $1 OR id = $1">,
  1
>>

// ============================================================================
// Max Parameter Number Tests
// ============================================================================

// Test: Max param number single
type _MaxSingle = RequireTrue<AssertEqual<
  MaxParamNumber<"SELECT * FROM users WHERE id = $1">,
  1
>>

// Test: Max param number gap
type _MaxGap = RequireTrue<AssertEqual<
  MaxParamNumber<"SELECT * FROM users WHERE id = $1 OR x = $5">,
  5
>>

// Test: Max param zero for no params
type _MaxZero = RequireTrue<AssertEqual<MaxParamNumber<"SELECT * FROM users">, 0>>

// ============================================================================
// Query Result Type Tests
// ============================================================================

// Test: Result type for parameterized query
type _ResultParamQuery = RequireTrue<AssertEqual<
  SelectResult<"SELECT id, name FROM users WHERE id = $1", TestSchema>,
  { id: number; name: string }
>>

// Test: Result with multiple parameters
type _ResultMultiParam = RequireTrue<AssertEqual<
  SelectResult<"SELECT id, email FROM users WHERE name = $1 AND role = $2", TestSchema>,
  { id: number; email: string }
>>

// Test: Result array type
type _ResultArray = RequireTrue<AssertExtends<
  SelectResultArray<"SELECT id, name FROM users WHERE is_active = $1", TestSchema>,
  Array<{ id: number; name: string }>
>>

// ============================================================================
// Query Validation Tests
// ============================================================================

// Test: Valid query validation
type _ValidQuery = RequireTrue<AssertEqual<
  ValidateSQL<"SELECT id, name FROM users WHERE id = $1", TestSchema>,
  true
>>

// Test: Invalid column produces error (not true)
type _InvalidColumn = RequireTrue<AssertEqual<
  ValidateSQL<"SELECT unknown FROM users WHERE id = $1", TestSchema> extends true ? false : true,
  true
>>

// Test: IsValidSelect returns true for valid
type _IsValidTrue = RequireTrue<AssertEqual<
  IsValidSelect<"SELECT id FROM users WHERE name = $1", TestSchema>,
  true
>>

// Test: IsValidSelect returns false for invalid
type _IsValidFalse = RequireTrue<AssertEqual<
  IsValidSelect<"SELECT bad_column FROM users", TestSchema>,
  false
>>

// ============================================================================
// TypedParamTuple Tests
// ============================================================================

// Test: Tuple length for single param
type _TupleSingle = RequireTrue<AssertEqual<
  TypedParamTuple<"SELECT * FROM users WHERE id = $1", TestSchema>["length"],
  1
>>

// Test: Tuple length for two params
type _TupleDouble = RequireTrue<AssertEqual<
  TypedParamTuple<"SELECT * FROM users WHERE id = $1 AND name = $2", TestSchema>["length"],
  2
>>

// Test: Tuple length for no params
type _TupleNone = RequireTrue<AssertEqual<
  TypedParamTuple<"SELECT * FROM users", TestSchema>["length"],
  0
>>

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: JOIN with parameters
type _JoinParam = RequireTrue<AssertEqual<
  QueryResult<`
    SELECT u.name, p.title
    FROM users AS u
    INNER JOIN posts AS p ON u.id = p.user_id
    WHERE u.id = $1 AND p.views > $2
  `, TestSchema>,
  { name: string; title: string }
>>

// Test: Aggregate with parameters
type _AggregateParam = RequireTrue<AssertEqual<
  QueryResult<
    "SELECT user_id, COUNT ( * ) AS count FROM posts WHERE user_id = $1 GROUP BY user_id",
    TestSchema
  >,
  { user_id: number; count: number }
>>

// Test: ORDER BY and LIMIT with parameters
type _OrderLimitParam = RequireTrue<AssertEqual<
  QueryResult<
    "SELECT id, name FROM users WHERE is_active = $1 ORDER BY name ASC LIMIT $2",
    TestSchema
  >,
  { id: number; name: string }
>>

// Export to prevent unused type warnings
export type {
  TestSchema,
}
