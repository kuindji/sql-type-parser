/**
 * LEFT JOIN Nullability Tests
 *
 * Verifies that columns from LEFT/FULL JOINed tables are correctly
 * typed as nullable (T | null).
 */

import type { QueryResult } from "../../../src/select/matcher/index.js";
import type { AssertEqual, RequireTrue } from "../../helpers.js";

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                email: string;
            };
            profiles: {
                id: number;
                user_id: number;
                bio: string;
                avatar_url: string;
            };
            orders: {
                id: number;
                user_id: number;
                total: number;
                status: string;
            };
            order_items: {
                id: number;
                order_id: number;
                product_name: string;
                quantity: number;
                price: number;
            };
        };
    };
};

// ============================================================================
// LEFT JOIN - Joined table columns are nullable
// ============================================================================

// Simple LEFT JOIN
type LeftJoin1 = QueryResult<
    "SELECT u.id, u.name, p.bio FROM users u LEFT JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T1 = RequireTrue<
    AssertEqual<LeftJoin1, { id: number; name: string; bio: string | null; }>
>;

// LEFT JOIN with multiple columns from joined table
type LeftJoin2 = QueryResult<
    "SELECT u.name, p.bio, p.avatar_url FROM users u LEFT JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T2 = RequireTrue<
    AssertEqual<
        LeftJoin2,
        { name: string; bio: string | null; avatar_url: string | null; }
    >
>;

// LEFT OUTER JOIN (same as LEFT JOIN)
type LeftOuterJoin = QueryResult<
    "SELECT u.name, p.bio FROM users u LEFT OUTER JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T3 = RequireTrue<
    AssertEqual<LeftOuterJoin, { name: string; bio: string | null; }>
>;

// ============================================================================
// INNER JOIN - Columns are NOT nullable
// ============================================================================

type InnerJoin = QueryResult<
    "SELECT u.id, u.name, p.bio FROM users u INNER JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T4 = RequireTrue<
    AssertEqual<InnerJoin, { id: number; name: string; bio: string; }>
>;

// Plain JOIN (defaults to INNER)
type PlainJoin = QueryResult<
    "SELECT u.name, p.bio FROM users u JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T5 = RequireTrue<
    AssertEqual<PlainJoin, { name: string; bio: string; }>
>;

// ============================================================================
// Multiple JOINs - Mixed nullability
// ============================================================================

// INNER + LEFT: only LEFT joined table is nullable
type MixedJoins1 = QueryResult<
    `SELECT u.name, p.bio, o.total
     FROM users u
     INNER JOIN profiles p ON p.user_id = u.id
     LEFT JOIN orders o ON o.user_id = u.id`,
    TestSchema
>;
type _T6 = RequireTrue<
    AssertEqual<
        MixedJoins1,
        { name: string; bio: string; total: number | null; }
    >
>;

// Multiple LEFT JOINs: all joined tables are nullable
type MultipleLeftJoins = QueryResult<
    `SELECT u.name, p.bio, o.total
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN orders o ON o.user_id = u.id`,
    TestSchema
>;
type _T7 = RequireTrue<
    AssertEqual<
        MultipleLeftJoins,
        { name: string; bio: string | null; total: number | null; }
    >
>;

// Chain: INNER then LEFT then INNER
type ChainedJoins = QueryResult<
    `SELECT u.name, p.bio, o.total, oi.quantity
     FROM users u
     INNER JOIN profiles p ON p.user_id = u.id
     LEFT JOIN orders o ON o.user_id = u.id
     INNER JOIN order_items oi ON oi.order_id = o.id`,
    TestSchema
>;
type _T8 = RequireTrue<
    AssertEqual<
        ChainedJoins,
        {
            name: string;
            bio: string;
            total: number | null;
            quantity: number;
        }
    >
>;

// ============================================================================
// FULL JOIN - Both sides nullable (we only handle joined table side)
// ============================================================================

type FullJoin = QueryResult<
    "SELECT u.name, p.bio FROM users u FULL JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T9 = RequireTrue<
    AssertEqual<FullJoin, { name: string; bio: string | null; }>
>;

type FullOuterJoin = QueryResult<
    "SELECT u.name, p.bio FROM users u FULL OUTER JOIN profiles p ON p.user_id = u.id",
    TestSchema
>;
type _T10 = RequireTrue<
    AssertEqual<FullOuterJoin, { name: string; bio: string | null; }>
>;

// ============================================================================
// CROSS JOIN - No nullability (Cartesian product)
// ============================================================================

type CrossJoin = QueryResult<
    "SELECT u.name, p.bio FROM users u CROSS JOIN profiles p",
    TestSchema
>;
type _T11 = RequireTrue<
    AssertEqual<CrossJoin, { name: string; bio: string; }>
>;

// ============================================================================
// Aliases with LEFT JOIN
// ============================================================================

type AliasedLeftJoin = QueryResult<
    "SELECT u.name AS user_name, p.bio AS user_bio FROM users AS u LEFT JOIN profiles AS p ON p.user_id = u.id",
    TestSchema
>;
type _T12 = RequireTrue<
    AssertEqual<
        AliasedLeftJoin,
        { user_name: string; user_bio: string | null; }
    >
>;

// ============================================================================
// Export to verify tests compile
// ============================================================================

export type LeftJoinNullabilityTestsPass = true;

