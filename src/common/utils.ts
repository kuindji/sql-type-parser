/**
 * Type-level string and number utilities for the SQL parser
 * 
 * These utilities are shared across all query type parsers.
 */

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Remove surrounding quotes from an identifier (double quotes or backticks)
 */
export type RemoveQuotes<T extends string> = Trim<T> extends `"${infer Inner}"`
  ? Inner
  : Trim<T> extends `\`${infer Inner}\``
    ? Inner
    : Trim<T> extends `'${infer Inner}'`
      ? Inner
      : Trim<T>

/**
 * Trim leading and trailing whitespace from a string
 */
export type Trim<T extends string> = T extends ` ${infer Rest}`
  ? Trim<Rest>
  : T extends `${infer Rest} `
    ? Trim<Rest>
    : T extends `\n${infer Rest}`
      ? Trim<Rest>
      : T extends `${infer Rest}\n`
        ? Trim<Rest>
        : T extends `\r${infer Rest}`
          ? Trim<Rest>
          : T extends `${infer Rest}\r`
            ? Trim<Rest>
            : T extends `\t${infer Rest}`
              ? Trim<Rest>
              : T extends `${infer Rest}\t`
                ? Trim<Rest>
                : T

/**
 * Join array of strings with a separator
 */
export type Join<T extends string[], Sep extends string = " "> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? Rest extends []
    ? First
    : `${First}${Sep}${Join<Rest, Sep>}`
  : ""

/**
 * Uppercase a string (limited set of characters for SQL keywords)
 */
export type ToUpperCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? `${UpperChar<C>}${ToUpperCase<Rest>}`
  : S

type UpperChar<C extends string> = C extends "a"
  ? "A"
  : C extends "b"
    ? "B"
    : C extends "c"
      ? "C"
      : C extends "d"
        ? "D"
        : C extends "e"
          ? "E"
          : C extends "f"
            ? "F"
            : C extends "g"
              ? "G"
              : C extends "h"
                ? "H"
                : C extends "i"
                  ? "I"
                  : C extends "j"
                    ? "J"
                    : C extends "k"
                      ? "K"
                      : C extends "l"
                        ? "L"
                        : C extends "m"
                          ? "M"
                          : C extends "n"
                            ? "N"
                            : C extends "o"
                              ? "O"
                              : C extends "p"
                                ? "P"
                                : C extends "q"
                                  ? "Q"
                                  : C extends "r"
                                    ? "R"
                                    : C extends "s"
                                      ? "S"
                                      : C extends "t"
                                        ? "T"
                                        : C extends "u"
                                          ? "U"
                                          : C extends "v"
                                            ? "V"
                                            : C extends "w"
                                              ? "W"
                                              : C extends "x"
                                                ? "X"
                                                : C extends "y"
                                                  ? "Y"
                                                  : C extends "z"
                                                    ? "Z"
                                                    : C

// ============================================================================
// Number Utilities (for parenthesis depth tracking)
// ============================================================================

/**
 * Increment a number (limited range 0-20)
 */
export type Increment<N extends number> = N extends 0
  ? 1
  : N extends 1
    ? 2
    : N extends 2
      ? 3
      : N extends 3
        ? 4
        : N extends 4
          ? 5
          : N extends 5
            ? 6
            : N extends 6
              ? 7
              : N extends 7
                ? 8
                : N extends 8
                  ? 9
                  : N extends 9
                    ? 10
                    : N extends 10
                      ? 11
                      : N extends 11
                        ? 12
                        : N extends 12
                          ? 13
                          : N extends 13
                            ? 14
                            : N extends 14
                              ? 15
                              : N extends 15
                                ? 16
                                : N extends 16
                                  ? 17
                                  : N extends 17
                                    ? 18
                                    : N extends 18
                                      ? 19
                                      : N extends 19
                                        ? 20
                                        : never

/**
 * Decrement a number (limited range 0-20)
 */
export type Decrement<N extends number> = N extends 20
  ? 19
  : N extends 19
    ? 18
    : N extends 18
      ? 17
      : N extends 17
        ? 16
        : N extends 16
          ? 15
          : N extends 15
            ? 14
            : N extends 14
              ? 13
              : N extends 13
                ? 12
                : N extends 12
                  ? 11
                  : N extends 11
                    ? 10
                    : N extends 10
                      ? 9
                      : N extends 9
                        ? 8
                        : N extends 8
                          ? 7
                          : N extends 7
                            ? 6
                            : N extends 6
                              ? 5
                              : N extends 5
                                ? 4
                                : N extends 4
                                  ? 3
                                  : N extends 3
                                    ? 2
                                    : N extends 2
                                      ? 1
                                      : N extends 1
                                        ? 0
                                        : never

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Flatten/simplify a type for better readability
 */
export type Flatten<T> = { [K in keyof T]: T[K] } & {}

/**
 * Error marker type for parse errors
 */
export type ParseError<Message extends string> = {
  error: true
  message: Message
}

/**
 * Check if a type is a parse error
 */
export type IsParseError<T> = T extends ParseError<string> ? true : false

/**
 * Error marker type for match errors
 */
export type MatchError<Message extends string> = {
  readonly __error: true
  readonly message: Message
}

/**
 * Check if a type is a match error
 */
export type IsMatchError<T> = T extends { readonly __error: true } ? true : false

// ============================================================================
// Dynamic Query Detection
// ============================================================================

/**
 * Check if a string type is a literal string or the generic `string` type.
 * This is used to detect dynamic queries that can't be parsed at compile time.
 * 
 * When T is a literal like "SELECT * FROM users", this returns true.
 * When T is `string` (the type), this returns false.
 * 
 * Note: Template literal types like `hello ${string}` are still considered literals
 * by this check because they're specific types (not plain `string`). The parser
 * will handle these by parsing the static parts and ignoring the dynamic parts.
 */
export type IsStringLiteral<T extends string> = string extends T ? false : true

/**
 * Check if a string type contains template literal holes (like ${string}).
 * 
 * Template literals like `hello ${string}` are NOT plain `string`, but they
 * contain dynamic parts that can't be validated at compile time.
 * 
 * This is more aggressive than IsStringLiteral and is used by validators
 * to skip validation when dynamic parts are present.
 * 
 * Detection strategy:
 * 1. Check for trailing ${string}: can we append characters and still match?
 * 2. Check for leading ${string}: can we prepend characters and still match?
 * 3. Check for internal ${string}: recursively check space-separated segments
 */
export type HasTemplateHoles<T extends string> = 
  // First check plain string
  string extends T
    ? true
    // Check for trailing ${string} - appending still matches
    : `${T}_` extends T
      ? true
      // Check for leading ${string} - prepending still matches
      : `_${T}` extends T
        ? true
        // Check for internal ${string} by trying to find a segment that accepts multiple values
        : HasInternalHole<T>

/**
 * Check for internal ${string} holes by testing if different values can fill the same position.
 * For SQL queries, ${string} is typically surrounded by spaces, so we split on spaces
 * and check if any segment can accept multiple values.
 */
type HasInternalHole<T extends string> =
  // Try matching with space-separated pattern
  T extends `${infer Before} ${infer After}`
    ? // Test if we can insert different values at this space boundary
      `${Before} __X__ ${After}` extends T
        ? `${Before} __Y__ ${After}` extends T
          ? true  // Found a hole! Both test values match
          : HasInternalHole<After>  // Try next segment
        : HasInternalHole<After>  // Try next segment
    : // Also check for holes at other common SQL boundaries
      HasHoleAtOtherBoundaries<T>

/**
 * Check for holes at non-space boundaries (commas, equals, parentheses)
 */
type HasHoleAtOtherBoundaries<T extends string> =
  // Check comma boundaries
  T extends `${infer A},${infer B}`
    ? `${A},__X__,${B}` extends T
      ? `${A},__Y__,${B}` extends T
        ? true
        : HasHoleAtOtherBoundaries<B>
      : HasHoleAtOtherBoundaries<B>
    : // Check equals boundaries  
      T extends `${infer A}=${infer B}`
        ? `${A}=__X__=${B}` extends T
          ? `${A}=__Y__=${B}` extends T
            ? true
            : false
          : false
        : false

/**
 * Marker for dynamic/non-literal queries that can't be validated at compile time.
 * These queries are passed through without validation.
 */
export type DynamicQuery = {
  readonly __dynamic: true
}

/**
 * Check if a type represents a dynamic (non-literal) query
 */
export type IsDynamicQuery<T> = T extends DynamicQuery ? true : false

/**
 * The result type for dynamic queries - allows any column access
 */
export type DynamicQueryResult = Record<string, unknown>

