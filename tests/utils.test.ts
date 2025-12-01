/**
 * Utils Type Tests
 *
 * Tests for utility types: Trim, RemoveQuotes, Flatten, ParseError, etc.
 * If this file compiles without errors, all tests pass.
 */

import type {
    Trim,
    RemoveQuotes,
    Flatten,
    ParseError,
    IsParseError,
    Increment,
    Decrement,
} from "../src/index.js"
import type { Join, ToUpperCase } from "../src/common/utils.js"
import type { AssertEqual, RequireTrue, AssertIsParseError, AssertNotParseError } from "./helpers.js"

// ============================================================================
// Trim Tests
// ============================================================================

// Test: Trim leading spaces
type Trim_Leading = Trim<"   hello">
type _T1 = RequireTrue<AssertEqual<Trim_Leading, "hello">>

// Test: Trim trailing spaces
type Trim_Trailing = Trim<"hello   ">
type _T2 = RequireTrue<AssertEqual<Trim_Trailing, "hello">>

// Test: Trim both sides
type Trim_Both = Trim<"   hello   ">
type _T3 = RequireTrue<AssertEqual<Trim_Both, "hello">>

// Test: Trim newlines
type Trim_Newlines = Trim<"\nhello\n">
type _T4 = RequireTrue<AssertEqual<Trim_Newlines, "hello">>

// Test: Trim tabs
type Trim_Tabs = Trim<"\thello\t">
type _T5 = RequireTrue<AssertEqual<Trim_Tabs, "hello">>

// Test: Trim carriage returns
type Trim_CR = Trim<"\rhello\r">
type _T6 = RequireTrue<AssertEqual<Trim_CR, "hello">>

// Test: Trim mixed whitespace
type Trim_Mixed = Trim<" \n\t\r hello \r\t\n ">
type _T7 = RequireTrue<AssertEqual<Trim_Mixed, "hello">>

// Test: Empty string stays empty
type Trim_Empty = Trim<"">
type _T8 = RequireTrue<AssertEqual<Trim_Empty, "">>

// Test: Only whitespace becomes empty
type Trim_OnlyWhitespace = Trim<"   \n\t   ">
type _T9 = RequireTrue<AssertEqual<Trim_OnlyWhitespace, "">>

// Test: No whitespace unchanged
type Trim_NoWhitespace = Trim<"hello">
type _T10 = RequireTrue<AssertEqual<Trim_NoWhitespace, "hello">>

// Test: Internal spaces preserved
type Trim_InternalSpaces = Trim<"  hello world  ">
type _T11 = RequireTrue<AssertEqual<Trim_InternalSpaces, "hello world">>

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

// Test: No quotes unchanged
type RQ_None = RemoveQuotes<"hello">
type _RQ4 = RequireTrue<AssertEqual<RQ_None, "hello">>

// Test: Mismatched quotes unchanged
type RQ_Mismatch = RemoveQuotes<"\"hello'">
type _RQ5 = RequireTrue<AssertEqual<RQ_Mismatch, "\"hello'">>

// Test: Trim and remove quotes
type RQ_TrimFirst = RemoveQuotes<'  "hello"  '>
type _RQ6 = RequireTrue<AssertEqual<RQ_TrimFirst, "hello">>

// Test: Empty quoted string
type RQ_EmptyQuoted = RemoveQuotes<'""'>
type _RQ7 = RequireTrue<AssertEqual<RQ_EmptyQuoted, "">>

// Test: Preserves internal characters
type RQ_Internal = RemoveQuotes<'"hello world"'>
type _RQ8 = RequireTrue<AssertEqual<RQ_Internal, "hello world">>

// Test: camelCase preserved
type RQ_CamelCase = RemoveQuotes<'"firstName"'>
type _RQ9 = RequireTrue<AssertEqual<RQ_CamelCase, "firstName">>

// Test: Special characters preserved
type RQ_Special = RemoveQuotes<'"user-sessions"'>
type _RQ10 = RequireTrue<AssertEqual<RQ_Special, "user-sessions">>

// ============================================================================
// Flatten Tests
// ============================================================================

// Test: Simple object is flattened
type Flatten_Simple = Flatten<{ a: number; b: string }>
type _F1 = RequireTrue<AssertEqual<Flatten_Simple, { a: number; b: string }>>

// Test: Intersection is flattened
type Flatten_Intersection = Flatten<{ a: number } & { b: string }>
type _F2 = RequireTrue<AssertEqual<Flatten_Intersection, { a: number; b: string }>>

// Test: Nested intersection is flattened
type Flatten_Nested = Flatten<{ a: number } & { b: string } & { c: boolean }>
type _F3 = RequireTrue<AssertEqual<Flatten_Nested, { a: number; b: string; c: boolean }>>

// Test: Empty object
type Flatten_Empty = Flatten<{}>
type _F4 = RequireTrue<AssertEqual<Flatten_Empty, {}>>

// ============================================================================
// ParseError Tests
// ============================================================================

// Test: ParseError structure
type PE_Structure = ParseError<"test message">
type _PE1 = RequireTrue<AssertEqual<PE_Structure, { error: true; message: "test message" }>>

// Test: IsParseError detects error
type PE_IsError = IsParseError<ParseError<"test">>
type _PE2 = RequireTrue<AssertEqual<PE_IsError, true>>

// Test: IsParseError returns false for non-error
type PE_NotError = IsParseError<{ a: number }>
type _PE3 = RequireTrue<AssertEqual<PE_NotError, false>>

// Test: AssertIsParseError helper
type PE_AssertHelper = ParseError<"Something went wrong">
type _PE4 = RequireTrue<AssertIsParseError<PE_AssertHelper>>

// Test: AssertNotParseError helper
type PE_NotParseError = { a: number }
type _PE5 = RequireTrue<AssertNotParseError<PE_NotParseError>>

// ============================================================================
// Join Tests
// ============================================================================

// Test: Join strings with default separator
type Join_Default = Join<["a", "b", "c"]>
type _J1 = RequireTrue<AssertEqual<Join_Default, "a b c">>

// Test: Join with custom separator
type Join_Custom = Join<["a", "b", "c"], ", ">
type _J2 = RequireTrue<AssertEqual<Join_Custom, "a, b, c">>

// Test: Join single element
type Join_Single = Join<["hello"]>
type _J3 = RequireTrue<AssertEqual<Join_Single, "hello">>

// Test: Join empty array
type Join_Empty = Join<[]>
type _J4 = RequireTrue<AssertEqual<Join_Empty, "">>

// Test: Join two elements
type Join_Two = Join<["hello", "world"]>
type _J5 = RequireTrue<AssertEqual<Join_Two, "hello world">>

// Test: Join with empty separator
type Join_NoSep = Join<["a", "b", "c"], "">
type _J6 = RequireTrue<AssertEqual<Join_NoSep, "abc">>

// ============================================================================
// ToUpperCase Tests
// ============================================================================

// Test: Lowercase to uppercase
type Upper_Lower = ToUpperCase<"hello">
type _U1 = RequireTrue<AssertEqual<Upper_Lower, "HELLO">>

// Test: Mixed case to uppercase
type Upper_Mixed = ToUpperCase<"HeLLo">
type _U2 = RequireTrue<AssertEqual<Upper_Mixed, "HELLO">>

// Test: Already uppercase unchanged
type Upper_Already = ToUpperCase<"HELLO">
type _U3 = RequireTrue<AssertEqual<Upper_Already, "HELLO">>

// Test: Empty string
type Upper_Empty = ToUpperCase<"">
type _U4 = RequireTrue<AssertEqual<Upper_Empty, "">>

// Test: Numbers and symbols preserved
type Upper_Numbers = ToUpperCase<"hello123">
type _U5 = RequireTrue<AssertEqual<Upper_Numbers, "HELLO123">>

// Test: SQL keywords
type Upper_Select = ToUpperCase<"select">
type _U6 = RequireTrue<AssertEqual<Upper_Select, "SELECT">>

type Upper_From = ToUpperCase<"from">
type _U7 = RequireTrue<AssertEqual<Upper_From, "FROM">>

type Upper_Where = ToUpperCase<"where">
type _U8 = RequireTrue<AssertEqual<Upper_Where, "WHERE">>

// ============================================================================
// Increment Tests
// ============================================================================

// Test: Increment 0
type Inc_0 = Increment<0>
type _I1 = RequireTrue<AssertEqual<Inc_0, 1>>

// Test: Increment 1
type Inc_1 = Increment<1>
type _I2 = RequireTrue<AssertEqual<Inc_1, 2>>

// Test: Increment 5
type Inc_5 = Increment<5>
type _I3 = RequireTrue<AssertEqual<Inc_5, 6>>

// Test: Increment 10
type Inc_10 = Increment<10>
type _I4 = RequireTrue<AssertEqual<Inc_10, 11>>

// Test: Increment 19 (near limit)
type Inc_19 = Increment<19>
type _I5 = RequireTrue<AssertEqual<Inc_19, 20>>

// ============================================================================
// Decrement Tests
// ============================================================================

// Test: Decrement 1
type Dec_1 = Decrement<1>
type _D1 = RequireTrue<AssertEqual<Dec_1, 0>>

// Test: Decrement 2
type Dec_2 = Decrement<2>
type _D2 = RequireTrue<AssertEqual<Dec_2, 1>>

// Test: Decrement 10
type Dec_10 = Decrement<10>
type _D3 = RequireTrue<AssertEqual<Dec_10, 9>>

// Test: Decrement 20
type Dec_20 = Decrement<20>
type _D4 = RequireTrue<AssertEqual<Dec_20, 19>>

// Test: Decrement 5
type Dec_5 = Decrement<5>
type _D5 = RequireTrue<AssertEqual<Dec_5, 4>>

// ============================================================================
// Increment/Decrement Round Trip Tests
// ============================================================================

// Test: Increment then Decrement returns same number
type RoundTrip_5 = Decrement<Increment<5>>
type _RT1 = RequireTrue<AssertEqual<RoundTrip_5, 5>>

// Test: Decrement then Increment returns same number
type RoundTrip_10 = Increment<Decrement<10>>
type _RT2 = RequireTrue<AssertEqual<RoundTrip_10, 10>>

// ============================================================================
// Export for verification
// ============================================================================

export type UtilsTestsPass = true

