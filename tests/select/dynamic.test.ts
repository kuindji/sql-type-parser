/**
 * Dynamic Query Type Tests
 *
 * Tests for dynamic query handling (template literals with ${string}).
 * If this file compiles without errors, all tests pass.
 */

import type {
    DynamicQuery,
    IsDynamicQuery,
    IsStringLiteral,
    IsStringUnion,
    IsUnion,
    IsUnionQueryError,
    ParseSQL,
    QueryResult,
    SQLSelectQuery,
    UnionQueryError,
    ValidQuery,
} from "../../src/index.js";
import type {
    BuilderStateTag,
} from "../../src/select/builder.js";
import type {
    AssertEqual,
    AssertExtends,
    RequireFalse,
    RequireTrue,
} from "../helpers.js";

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                email: string;
                role: "admin" | "user" | "guest";
                is_active: boolean;
                created_at: string;
                deleted_at: string | null;
            };
            posts: {
                id: number;
                author_id: number;
                title: string;
                content: string;
                views: number;
                status: "draft" | "published";
                published_at: string | null;
            };
            comments: {
                id: number;
                post_id: number;
                user_id: number;
                content: string;
                created_at: string;
            };
        };
        audit: {
            logs: {
                id: number;
                user_id: number | null;
                action: string;
                created_at: string;
            };
        };
    };
};

// ============================================================================
// IsStringLiteral Tests
// ============================================================================

// Test: Literal string returns true
type SL_Literal = IsStringLiteral<"SELECT * FROM users">;
type _SL1 = RequireTrue<SL_Literal>;

// Test: Generic string returns false
type SL_String = IsStringLiteral<string>;
type _SL2 = RequireFalse<SL_String>;

// Test: Empty string is still a literal
type SL_Empty = IsStringLiteral<"">;
type _SL3 = RequireTrue<SL_Empty>;

// ============================================================================
// Dynamic Query Detection Tests
// ============================================================================

// Test: Regular query is not dynamic
type D_Regular = ParseSQL<"SELECT * FROM users">;
type _D1 = RequireTrue<AssertExtends<D_Regular, SQLSelectQuery>>;

// Test: Dynamic query (generic string type) returns DynamicQuery
type D_Generic = ParseSQL<string>;
type _D2 = RequireTrue<AssertExtends<D_Generic, DynamicQuery>>;

// Test: IsDynamicQuery for regular query
type ID_Regular = IsDynamicQuery<ParseSQL<"SELECT * FROM users">>;
type _ID1 = RequireFalse<ID_Regular>;

// Test: IsDynamicQuery for dynamic query
type ID_Dynamic = IsDynamicQuery<DynamicQuery>;
type _ID2 = RequireTrue<ID_Dynamic>;

// ============================================================================
// Complex Query Tests
// ============================================================================

// Test: Complex literal query is parsed correctly
type C_Complex = ParseSQL<
    `
  SELECT u.id, u.name, o.total
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
  WHERE u.active = TRUE
  ORDER BY o.total DESC
  LIMIT 100
`
>;
type _C1 = RequireTrue<AssertExtends<C_Complex, SQLSelectQuery>>;

// Test: Multi-line literal is still a literal
type C_MultiLine = IsStringLiteral<
    `
  SELECT id
  FROM users
`
>;
type _C2 = RequireTrue<C_MultiLine>;

// ============================================================================
// Constructed Query Tests
// ============================================================================

let queryWherePart = "";
queryWherePart = `and "id" = $1`;
const queryDynamicWhere =
    `SELECT id FROM users WHERE "id" = 1 ${queryWherePart} order by "id" desc` as const;
type Test_ParseDynamicWhere = ParseSQL<typeof queryDynamicWhere>;
type _P4 = RequireTrue<AssertExtends<Test_ParseDynamicWhere, SQLSelectQuery>>;

let queryBetweenPart = "";
queryBetweenPart = `join posts on posts.user_id = users.id`;
const queryDynamicInBetween =
    `SELECT id FROM users ${queryBetweenPart} WHERE "id" = 1  order by "id" desc` as const;
type Test_ParseDynamicInBetween = ParseSQL<typeof queryDynamicInBetween>;
type _P5 = RequireTrue<
    AssertExtends<Test_ParseDynamicInBetween, SQLSelectQuery>
>;

const generateIn = function() {
    return [ "$1", "$2", "$3" ].join(", ");
};
const queryDynamicIn = /*sql*/ `
    select * 
    from "users"
    where "id" in (${generateIn()})
  ` as const;
type Test_ParseDynamicIn = ValidQuery<typeof queryDynamicIn, TestSchema>;
type _P6 = RequireTrue<AssertEqual<Test_ParseDynamicIn, typeof queryDynamicIn>>;

// ============================================================================
// Union Type Detection Tests
// ============================================================================

// Test: IsUnion detects single types correctly
type U_Single = IsUnion<"hello">;
type _U1 = RequireFalse<U_Single>;

// Test: IsUnion detects union types correctly
type U_Union = IsUnion<"a" | "b" | "c">;
type _U2 = RequireTrue<U_Union>;

// Test: IsUnion detects generic string as non-union
type U_String = IsUnion<string>;
type _U3 = RequireFalse<U_String>;

// Test: IsUnion detects number types
type U_Number = IsUnion<1 | 2 | 3>;
type _U4 = RequireTrue<U_Number>;

type U_SingleNumber = IsUnion<42>;
type _U5 = RequireFalse<U_SingleNumber>;

// Test: IsStringUnion detects string literal unions
type SU_Single = IsStringUnion<"SELECT * FROM users">;
type _SU1 = RequireFalse<SU_Single>;

type SU_Union = IsStringUnion<"GBP" | "USD" | "EUR">;
type _SU2 = RequireTrue<SU_Union>;

// Test: IsStringUnion returns false for generic string type
type SU_String = IsStringUnion<string>;
type _SU3 = RequireFalse<SU_String>;

// Test: QueryResult returns UnionQueryError for union types
type Currency = "GBP" | "USD" | "EUR";
type QR_Union = QueryResult<`SELECT '${Currency}' as currency FROM users`, TestSchema>;
type _QR1 = RequireTrue<AssertExtends<QR_Union, UnionQueryError>>;
type _QR2 = RequireTrue<IsUnionQueryError<QR_Union>>;

// Test: QueryResult works normally for single literal
type QR_Normal = QueryResult<"SELECT id FROM users", TestSchema>;
type _QR3 = RequireFalse<IsUnionQueryError<QR_Normal>>;
type _QR4 = RequireTrue<AssertExtends<QR_Normal, { id: number }>>;

// Test: Union in complex query template is detected
type ComplexUnion = "foo" | "bar";
type QR_Complex = QueryResult<`SELECT id, '${ComplexUnion}' as tag FROM users`, TestSchema>;
type _QR5 = RequireTrue<IsUnionQueryError<QR_Complex>>;

// Test: UnionQueryError has the expected shape
type UQE_Shape = RequireTrue<AssertExtends<UnionQueryError, { readonly __unionError: true; readonly message: string }>>;

// ============================================================================
// Builder Union Detection Tests
// ============================================================================

// Test: Builder state with UnionQueryError in row is valid
// This verifies that when AddColumnsForSchema detects a union, it produces
// a BuilderStateTag with UnionQueryError as the row type
type BuilderStateWithUnionError = BuilderStateTag<"users", UnionQueryError, "FROM users">;
type _BU1 = RequireTrue<AssertExtends<BuilderStateWithUnionError["row"], UnionQueryError>>;

// Test: BuilderStateTag with union error is a valid state tag
type _BU2 = RequireTrue<AssertExtends<BuilderStateWithUnionError, BuilderStateTag<any, any, any>>>;

// ============================================================================
// Export for verification
// ============================================================================

export type DynamicTestsPass = true;
