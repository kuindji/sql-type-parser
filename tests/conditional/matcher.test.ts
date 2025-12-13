/**
 * Type-level tests for conditional SQL matcher.
 *
 * Tests the integration with QueryResult and optionality tracking.
 */

import type {
    ConditionalQueryResult,
    MergeConditionalResults,
} from "../../src/conditional/matcher.js";
import type { AssertEqual, RequireTrue } from "../helpers.js";

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
                active: boolean;
            };
            orders: {
                id: number;
                user_id: number;
                total: number;
                status: string;
            };
            profiles: {
                id: number;
                user_id: number;
                bio: string;
                avatar_url: string;
            };
        };
    };
};

// ============================================================================
// MergeConditionalResults Tests
// ============================================================================

// Base case: no conditional columns
type TestMerge1 = RequireTrue<
    AssertEqual<
        MergeConditionalResults<
            { id: number; name: string; },
            { id: number; name: string; }
        >,
        { id: number; name: string; }
    >
>;

// Conditional column gets | undefined
type TestMerge2 = RequireTrue<
    AssertEqual<
        MergeConditionalResults<
            { id: number; name: string; email: string; },
            { id: number; name: string; }
        >,
        { id: number; name: string; email: string | undefined; }
    >
>;

// Multiple conditional columns
type TestMerge3 = RequireTrue<
    AssertEqual<
        MergeConditionalResults<
            { id: number; a: string; b: number; c: boolean; },
            { id: number; }
        >,
        {
            id: number;
            a: string | undefined;
            b: number | undefined;
            c: boolean | undefined;
        }
    >
>;

// ============================================================================
// ConditionalQueryResult Tests
// ============================================================================

// Simple query with no conditions
type TestResult1 = ConditionalQueryResult<
    "SELECT id, name FROM users",
    {},
    TestSchema
>;

type TestResult1Check = RequireTrue<
    AssertEqual<TestResult1, { id: number; name: string; }>
>;

// Query with conditional SELECT column - condition true
type TestResult2 = ConditionalQueryResult<
    "SELECT id, name/*if:extra*/, email/*endif*/ FROM users",
    { extra: true; },
    TestSchema
>;

// When condition is true, email should be string | undefined
// (because at type level we track that it's conditional)
type TestResult2Check = RequireTrue<
    AssertEqual<
        TestResult2,
        { id: number; name: string; email: string | undefined; }
    >
>;

// Query with conditional SELECT column - condition false
type TestResult3 = ConditionalQueryResult<
    "SELECT id, name/*if:extra*/, email/*endif*/ FROM users",
    { extra: false; },
    TestSchema
>;

// When condition is false, email is still typed as optional (it was in full)
type TestResult3Check = RequireTrue<
    AssertEqual<
        TestResult3,
        { id: number; name: string; email: string | undefined; }
    >
>;

// Query with conditional JOIN
// Note: The base QueryResult doesn't currently add | null for LEFT JOIN columns.
// So we only get | undefined from the conditional.
type TestResult4 = ConditionalQueryResult<
    "SELECT u.id, u.name/*if:withOrders*/, o.total/*endif*/ FROM users u /*if:withOrders*/LEFT JOIN orders o ON o.user_id = u.id/*endif*/",
    { withOrders: true; },
    TestSchema
>;

// total is from a conditional LEFT JOIN: | null from LEFT JOIN, | undefined from conditional
type TestResult4Check = RequireTrue<
    AssertEqual<
        TestResult4,
        { id: number; name: string; total: number | null | undefined; }
    >
>;

// Multiple conditions
type TestResult5 = ConditionalQueryResult<
    "SELECT u.id/*if:showName*/, u.name/*endif*//*if:showEmail*/, u.email/*endif*/ FROM users u",
    { showName: true; showEmail: false; },
    TestSchema
>;

type TestResult5Check = RequireTrue<
    AssertEqual<
        TestResult5,
        { id: number; name: string | undefined; email: string | undefined; }
    >
>;

// ============================================================================
// Real-world query examples
// ============================================================================

// Dynamic search query
type SearchQuery = ConditionalQueryResult<
    `SELECT u.id, u.name, u.email
     FROM users u
     WHERE 1=1
     /*if:searchTerm*/AND (u.name ILIKE :term OR u.email ILIKE :term)/*endif*/
     /*if:activeOnly*/AND u.active = true/*endif*/`,
    { searchTerm: true; activeOnly: true; },
    TestSchema
>;

type SearchQueryCheck = RequireTrue<
    AssertEqual<SearchQuery, { id: number; name: string; email: string; }>
>;

// Order details with optional user info
// LEFT JOIN gives | null, conditional gives | undefined
type OrderQuery = ConditionalQueryResult<
    `SELECT o.id, o.total, o.status
     /*if:includeUser*/, u.name AS user_name/*endif*/
     FROM orders o
     /*if:includeUser*/LEFT JOIN users u ON u.id = o.user_id/*endif*/`,
    { includeUser: true; },
    TestSchema
>;

type OrderQueryCheck = RequireTrue<
    AssertEqual<
        OrderQuery,
        {
            id: number;
            total: number;
            status: string;
            user_name: string | null | undefined;
        }
    >
>;

// ============================================================================
// Export to verify tests compile
// ============================================================================

export type ConditionalMatcherTestsPass = true;
