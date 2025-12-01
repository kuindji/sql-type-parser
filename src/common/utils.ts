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

