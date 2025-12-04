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
    ParseSQL,
    SQLSelectQuery,
    ValidateSelectSQL,
    ValidQuery,
} from "../../src/index.js";
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
// Export for verification
// ============================================================================

export type DynamicTestsPass = true;
