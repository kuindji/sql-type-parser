/**
 * Utils Type Tests
 *
 * Tests for utility types: Trim, RemoveQuotes, Increment, Decrement, etc.
 * If this file compiles without errors, all tests pass.
 */

import type {
    Trim,
    RemoveQuotes,
    Increment,
    Decrement,
    Flatten,
    ParseError,
    IsParseError,
    MatchError,
    IsMatchError,
    IsStringLiteral,
    HasTemplateHoles,
    DynamicQuery,
    IsDynamicQuery,
} from "../../src/index.js"
import type { AssertEqual, RequireTrue, RequireFalse } from "../helpers.js"

// ============================================================================
// Trim Tests
// ============================================================================

// Test: Trim leading space
type T_Lead = Trim<" hello">
type _T1 = RequireTrue<AssertEqual<T_Lead, "hello">>

// Test: Trim trailing space
type T_Trail = Trim<"hello ">
type _T2 = RequireTrue<AssertEqual<T_Trail, "hello">>

// Test: Trim both sides
type T_Both = Trim<" hello ">
type _T3 = RequireTrue<AssertEqual<T_Both, "hello">>

// Test: Trim multiple spaces
type T_Multi = Trim<"   hello   ">
type _T4 = RequireTrue<AssertEqual<T_Multi, "hello">>

// Test: Trim newlines
type T_Newline = Trim<"\nhello\n">
type _T5 = RequireTrue<AssertEqual<T_Newline, "hello">>

// Test: Trim tabs
type T_Tab = Trim<"\thello\t">
type _T6 = RequireTrue<AssertEqual<T_Tab, "hello">>

// Test: Already trimmed
type T_Clean = Trim<"hello">
type _T7 = RequireTrue<AssertEqual<T_Clean, "hello">>

// Test: Empty string
type T_Empty = Trim<"">
type _T8 = RequireTrue<AssertEqual<T_Empty, "">>

// Test: Only whitespace
type T_OnlySpace = Trim<"   ">
type _T9 = RequireTrue<AssertEqual<T_OnlySpace, "">>

// ============================================================================
// RemoveQuotes Tests
// ============================================================================

// Test: Remove double quotes
type RQ_Double = RemoveQuotes<'"hello"'>
type _RQ1 = RequireTrue<AssertEqual<RQ_Double, "hello">>

// Test: Remove single quotes
type RQ_Single = RemoveQuotes<"'hello'">
type _RQ2 = RequireTrue<AssertEqual<RQ_Single, "hello">>

// Test: Remove backticks
type RQ_Backtick = RemoveQuotes<"`hello`">
type _RQ3 = RequireTrue<AssertEqual<RQ_Backtick, "hello">>

// Test: No quotes - return as-is
type RQ_None = RemoveQuotes<"hello">
type _RQ4 = RequireTrue<AssertEqual<RQ_None, "hello">>

// Test: Trim and remove quotes
type RQ_Trim = RemoveQuotes<' "hello" '>
type _RQ5 = RequireTrue<AssertEqual<RQ_Trim, "hello">>

// ============================================================================
// Increment Tests
// ============================================================================

// Test: Basic increment
type Inc_0 = Increment<0>
type _Inc1 = RequireTrue<AssertEqual<Inc_0, 1>>

type Inc_1 = Increment<1>
type _Inc2 = RequireTrue<AssertEqual<Inc_1, 2>>

type Inc_5 = Increment<5>
type _Inc3 = RequireTrue<AssertEqual<Inc_5, 6>>

type Inc_10 = Increment<10>
type _Inc4 = RequireTrue<AssertEqual<Inc_10, 11>>

type Inc_19 = Increment<19>
type _Inc5 = RequireTrue<AssertEqual<Inc_19, 20>>

// ============================================================================
// Decrement Tests
// ============================================================================

// Test: Basic decrement
type Dec_1 = Decrement<1>
type _Dec1 = RequireTrue<AssertEqual<Dec_1, 0>>

type Dec_2 = Decrement<2>
type _Dec2 = RequireTrue<AssertEqual<Dec_2, 1>>

type Dec_5 = Decrement<5>
type _Dec3 = RequireTrue<AssertEqual<Dec_5, 4>>

type Dec_10 = Decrement<10>
type _Dec4 = RequireTrue<AssertEqual<Dec_10, 9>>

type Dec_20 = Decrement<20>
type _Dec5 = RequireTrue<AssertEqual<Dec_20, 19>>

// ============================================================================
// Flatten Tests
// ============================================================================

// Test: Flatten simple object
type F_Simple = Flatten<{ a: 1; b: 2 }>
type _F1 = RequireTrue<AssertEqual<F_Simple, { a: 1; b: 2 }>>

// Test: Flatten intersection
type F_Inter = Flatten<{ a: 1 } & { b: 2 }>
type _F2 = RequireTrue<AssertEqual<F_Inter, { a: 1; b: 2 }>>

// ============================================================================
// ParseError Tests
// ============================================================================

// Test: ParseError structure
type PE_Test = ParseError<"test error">
type _PE1 = RequireTrue<AssertEqual<PE_Test, { error: true; message: "test error" }>>

// Test: IsParseError
type IPE_True = IsParseError<ParseError<"error">>
type _IPE1 = RequireTrue<IPE_True>

type IPE_False = IsParseError<{ foo: "bar" }>
type _IPE2 = RequireFalse<IPE_False>

// ============================================================================
// MatchError Tests
// ============================================================================

// Test: MatchError structure
type ME_Test = MatchError<"test error">
type _ME1 = RequireTrue<AssertEqual<ME_Test, { readonly __error: true; readonly message: "test error" }>>

// Test: IsMatchError
type IME_True = IsMatchError<MatchError<"error">>
type _IME1 = RequireTrue<IME_True>

type IME_False = IsMatchError<{ foo: "bar" }>
type _IME2 = RequireFalse<IME_False>

// ============================================================================
// Dynamic Query Detection Tests
// ============================================================================

// Test: IsStringLiteral
type ISL_Literal = IsStringLiteral<"hello">
type _ISL1 = RequireTrue<ISL_Literal>

type ISL_String = IsStringLiteral<string>
type _ISL2 = RequireFalse<ISL_String>

// Test: IsDynamicQuery
type IDQ_True = IsDynamicQuery<DynamicQuery>
type _IDQ1 = RequireTrue<IDQ_True>

type IDQ_False = IsDynamicQuery<{ foo: "bar" }>
type _IDQ2 = RequireFalse<IDQ_False>

// ============================================================================
// Export for verification
// ============================================================================

export type UtilsTestsPass = true

