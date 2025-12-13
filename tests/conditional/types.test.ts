/**
 * Type-level tests for conditional SQL processing.
 *
 * These tests verify compile-time type inference.
 * If this file compiles, the type tests pass.
 */

import type {
    AllConditionsFalse,
    AllConditionsTrue,
    EvalCondition,
    GetPath,
    IsTruthy,
    ProcessConditionalSQL,
} from "../../src/conditional/types.js";
import type { AssertEqual, RequireTrue } from "../helpers.js";

// ============================================================================
// GetPath Tests
// ============================================================================

type TestGetPath1 = RequireTrue<
    AssertEqual<GetPath<{ a: 1; }, "a">, 1>
>;

type TestGetPath2 = RequireTrue<
    AssertEqual<GetPath<{ user: { isAdmin: true; }; }, "user.isAdmin">, true>
>;

type TestGetPath3 = RequireTrue<
    AssertEqual<GetPath<{ a: { b: { c: "deep"; }; }; }, "a.b.c">, "deep">
>;

type TestGetPathMissing = RequireTrue<
    AssertEqual<GetPath<{ a: 1; }, "b">, undefined>
>;

// ============================================================================
// IsTruthy Tests
// ============================================================================

type TestTruthyTrue = RequireTrue<AssertEqual<IsTruthy<true>, true>>;
type TestTruthyFalse = RequireTrue<AssertEqual<IsTruthy<false>, false>>;
type TestTruthyNull = RequireTrue<AssertEqual<IsTruthy<null>, false>>;
type TestTruthyUndefined = RequireTrue<
    AssertEqual<IsTruthy<undefined>, false>
>;
type TestTruthyString = RequireTrue<AssertEqual<IsTruthy<"hello">, true>>;
type TestTruthyEmptyString = RequireTrue<AssertEqual<IsTruthy<"">, false>>;
type TestTruthyNumber = RequireTrue<AssertEqual<IsTruthy<42>, true>>;
type TestTruthyZero = RequireTrue<AssertEqual<IsTruthy<0>, false>>;
type TestTruthyBoolean = RequireTrue<AssertEqual<IsTruthy<boolean>, boolean>>;

// ============================================================================
// EvalCondition Tests
// ============================================================================

type TestEvalTrue = RequireTrue<
    AssertEqual<EvalCondition<"flag", { flag: true; }>, true>
>;

type TestEvalFalse = RequireTrue<
    AssertEqual<EvalCondition<"flag", { flag: false; }>, false>
>;

type TestEvalNegatedTrue = RequireTrue<
    AssertEqual<EvalCondition<"!flag", { flag: true; }>, false>
>;

type TestEvalNegatedFalse = RequireTrue<
    AssertEqual<EvalCondition<"!flag", { flag: false; }>, true>
>;

type TestEvalNested = RequireTrue<
    AssertEqual<
        EvalCondition<"user.isAdmin", { user: { isAdmin: true; }; }>,
        true
    >
>;

// ============================================================================
// ProcessConditionalSQL Tests
// ============================================================================

// Basic truthy condition includes content
type TestProcess1 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:flag*/WHERE a=1/*endif*/",
            { flag: true; }
        >,
        "SELECT * WHERE a=1"
    >
>;

// Basic falsy condition removes content
type TestProcess2 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:flag*/WHERE a=1/*endif*/",
            { flag: false; }
        >,
        "SELECT * "
    >
>;

// Negation - falsy includes content
type TestProcess3 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:!flag*/WHERE a=1/*endif*/",
            { flag: false; }
        >,
        "SELECT * WHERE a=1"
    >
>;

// Negation - truthy removes content
type TestProcess4 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:!flag*/WHERE a=1/*endif*/",
            { flag: true; }
        >,
        "SELECT * "
    >
>;

// Nested properties
type TestProcess5 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:user.isAdmin*/WHERE admin=1/*endif*/",
            { user: { isAdmin: true; }; }
        >,
        "SELECT * WHERE admin=1"
    >
>;

// Multiple independent conditions
type TestProcess6 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * /*if:a*/A/*endif*/ /*if:b*/B/*endif*/",
            { a: true; b: false; }
        >,
        "SELECT * A "
    >
>;

// Nested conditions - both true
type TestProcess7 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: true; b: true; }
        >,
        "SELECT A B"
    >
>;

// Nested conditions - outer true, inner false
type TestProcess8 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: true; b: false; }
        >,
        "SELECT A "
    >
>;

// Nested conditions - outer false removes all
type TestProcess9 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/",
            { a: false; b: true; }
        >,
        "SELECT "
    >
>;

// SQL-like query with conditional SELECT
type TestProcessSQL1 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT id, name/*if:extra*/, email/*endif*/ FROM users",
            { extra: true; }
        >,
        "SELECT id, name, email FROM users"
    >
>;

type TestProcessSQL2 = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT id, name/*if:extra*/, email/*endif*/ FROM users",
            { extra: false; }
        >,
        "SELECT id, name FROM users"
    >
>;

// SQL with conditional JOIN
type TestProcessJoin = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * FROM users /*if:withOrders*/LEFT JOIN orders ON orders.user_id = users.id/*endif*/",
            { withOrders: true; }
        >,
        "SELECT * FROM users LEFT JOIN orders ON orders.user_id = users.id"
    >
>;

// SQL with conditional WHERE
type TestProcessWhere = RequireTrue<
    AssertEqual<
        ProcessConditionalSQL<
            "SELECT * FROM users WHERE 1=1 /*if:active*/AND active = true/*endif*/",
            { active: true; }
        >,
        "SELECT * FROM users WHERE 1=1 AND active = true"
    >
>;

// ============================================================================
// AllConditionsTrue / AllConditionsFalse Tests
// ============================================================================

type TestAllTrue = RequireTrue<
    AssertEqual<
        AllConditionsTrue<{ a: false; b: false; }>,
        { a: true; b: true; }
    >
>;

type TestAllFalse = RequireTrue<
    AssertEqual<
        AllConditionsFalse<{ a: true; b: true; }>,
        { a: false; b: false; }
    >
>;

type TestAllTrueNested = RequireTrue<
    AssertEqual<
        AllConditionsTrue<{ user: { isAdmin: false; }; }>,
        { user: { isAdmin: true; }; }
    >
>;

// ============================================================================
// Export to verify tests compile
// ============================================================================

export type ConditionalTypesTestsPass = true;
