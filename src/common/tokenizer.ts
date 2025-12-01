/**
 * Type-level SQL tokenization utilities
 * 
 * These utilities are shared across all query type parsers.
 */

import type { Trim, ToUpperCase, Increment, Decrement } from "./utils.js"

// ============================================================================
// SQL Keywords
// ============================================================================

/**
 * Keywords that need to be normalized to uppercase
 */
type SQLKeyword =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "FROM"
  | "INTO"
  | "VALUES"
  | "SET"
  | "WHERE"
  | "AND"
  | "OR"
  | "NOT"
  | "AS"
  | "JOIN"
  | "INNER"
  | "LEFT"
  | "RIGHT"
  | "FULL"
  | "OUTER"
  | "CROSS"
  | "ON"
  | "ORDER"
  | "BY"
  | "ASC"
  | "DESC"
  | "GROUP"
  | "HAVING"
  | "LIMIT"
  | "OFFSET"
  | "DISTINCT"
  | "NULL"
  | "TRUE"
  | "FALSE"
  | "IS"
  | "IN"
  | "LIKE"
  | "ILIKE"
  | "BETWEEN"
  | "COUNT"
  | "SUM"
  | "AVG"
  | "MIN"
  | "MAX"
  | "WITH"
  | "UNION"
  | "INTERSECT"
  | "EXCEPT"
  | "ALL"
  | "RETURNING"
  | "DEFAULT"
  | "CONFLICT"
  | "DO"
  | "NOTHING"
  | "CASCADE"
  | "RESTRICT"

/**
 * Keywords that terminate the FROM clause
 */
export type FromTerminators =
  | "WHERE"
  | "JOIN"
  | "INNER"
  | "LEFT"
  | "RIGHT"
  | "FULL"
  | "CROSS"
  | "ORDER"
  | "GROUP"
  | "HAVING"
  | "LIMIT"
  | "OFFSET"
  | "UNION"
  | "INTERSECT"
  | "EXCEPT"
  | "RETURNING"

/**
 * Keywords that terminate the WHERE clause
 */
export type WhereTerminators = "ORDER" | "GROUP" | "HAVING" | "LIMIT" | "OFFSET" | "UNION" | "INTERSECT" | "EXCEPT" | "RETURNING"

/**
 * Keywords that terminate ORDER BY
 */
export type OrderByTerminators = "LIMIT" | "OFFSET" | "UNION" | "INTERSECT" | "EXCEPT" | "RETURNING"

/**
 * Union operators
 */
export type UnionOperator = "UNION" | "UNION ALL" | "INTERSECT" | "INTERSECT ALL" | "EXCEPT" | "EXCEPT ALL"

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a word - uppercase if it's a SQL keyword
 */
type NormalizeWord<W extends string> =
  ToUpperCase<W> extends infer Upper extends string
    ? Upper extends SQLKeyword
      ? Upper
      : W
    : W

/**
 * Split, normalize, and join in one pass to reduce recursion depth
 * Instead of: Split -> Normalize each -> Join
 * We do: Process word by word, normalizing and joining as we go
 * 
 * Context-aware: Words following AS are NOT normalized (they are aliases)
 * PrevWasAS tracks if the previous word was the AS keyword
 */
type ProcessWords<
  T extends string,
  Acc extends string = "",
  PrevWasAS extends boolean = false
> = Trim<T> extends ""
  ? Acc
  : Trim<T> extends `${infer First} ${infer Rest}`
    ? PrevWasAS extends true
      // Previous word was AS, so this word is an alias - don't normalize it
      ? ProcessWords<Rest, Acc extends "" ? First : `${Acc} ${First}`, false>
      // Normal processing - normalize the word
      : NormalizeWord<First> extends infer Normalized extends string
        ? ProcessWords<
            Rest,
            Acc extends "" ? Normalized : `${Acc} ${Normalized}`,
            Normalized extends "AS" ? true : false
          >
        : never
    : PrevWasAS extends true
      // Last word and previous was AS - don't normalize
      ? Acc extends "" ? Trim<T> : `${Acc} ${Trim<T>}`
      // Last word - normalize it
      : Acc extends ""
        ? NormalizeWord<Trim<T>>
        : `${Acc} ${NormalizeWord<Trim<T>>}`

/**
 * Split and normalize special characters (, ( ))
 */
type SplitSpecial<T extends string> = T extends `${infer L},${infer R}`
  ? `${SplitSpecial<L>} , ${SplitSpecial<R>}`
  : T extends `${infer L}(${infer R}`
    ? `${SplitSpecial<L>} ( ${SplitSpecial<R>}`
    : T extends `${infer L})${infer R}`
      ? `${SplitSpecial<L>} ) ${SplitSpecial<R>}`
      : T

/**
 * Replace tabs and newlines with spaces
 */
type ReplaceWhitespace<T extends string> = T extends `${infer L}\t${infer R}`
  ? ReplaceWhitespace<`${L} ${R}`>
  : T extends `${infer L}\n${infer R}`
    ? ReplaceWhitespace<`${L} ${R}`>
    : T extends `${infer L}\r${infer R}`
      ? ReplaceWhitespace<`${L} ${R}`>
      : T

/**
 * Collapse multiple spaces into single space
 */
type CollapseSpaces<T extends string> = T extends `${infer L}  ${infer R}`
  ? CollapseSpaces<`${L} ${R}`>
  : T

/**
 * Normalize a SQL query string
 * Uses ProcessWords to combine split/normalize/join into one pass
 */
export type NormalizeSQL<T extends string> = ProcessWords<
  CollapseSpaces<SplitSpecial<ReplaceWhitespace<T>>>
>

// ============================================================================
// Token Extraction
// ============================================================================

/**
 * Get the next token and remainder
 */
export type NextToken<T extends string> =
  Trim<T> extends `${infer Token} ${infer Rest}` ? [Token, Rest] : [Trim<T>, ""]

/**
 * Check if string starts with a specific token
 */
export type StartsWith<T extends string, Token extends string> =
  NextToken<T> extends [infer First extends string, infer _]
    ? First extends Token
      ? true
      : false
    : false

/**
 * Extract content until a terminator keyword (respects parenthesis depth)
 */
export type ExtractUntil<
  T extends string,
  Terminators extends string,
  Depth extends number = 0,
  Acc extends string = "",
> = NextToken<T> extends [infer Token extends string, infer Rest extends string]
  ? Token extends "("
    ? ExtractUntil<Rest, Terminators, Increment<Depth>, `${Acc} ${Token}`>
    : Token extends ")"
      ? ExtractUntil<Rest, Terminators, Decrement<Depth>, `${Acc} ${Token}`>
      : Token extends Terminators
        ? Depth extends 0
          ? [Trim<Acc>, Trim<`${Token} ${Rest}`>]
          : ExtractUntil<Rest, Terminators, Depth, `${Acc} ${Token}`>
        : Rest extends ""
          ? [Trim<`${Acc} ${Token}`>, ""]
          : ExtractUntil<Rest, Terminators, Depth, `${Acc} ${Token}`>
  : [Trim<Acc>, ""]

/**
 * Split by comma (respects parenthesis depth)
 */
export type SplitByComma<
  T extends string,
  Depth extends number = 0,
  Current extends string = "",
> = Trim<T> extends ""
  ? Current extends ""
    ? []
    : [Trim<Current>]
  : NextToken<T> extends [infer Token extends string, infer Rest extends string]
    ? Token extends "("
      ? SplitByComma<Rest, Increment<Depth>, `${Current} ${Token}`>
      : Token extends ")"
        ? SplitByComma<Rest, Decrement<Depth>, `${Current} ${Token}`>
        : Token extends ","
          ? Depth extends 0
            ? [Trim<Current>, ...SplitByComma<Rest, 0, "">]
            : SplitByComma<Rest, Depth, `${Current} ${Token}`>
          : SplitByComma<Rest, Depth, `${Current} ${Token}`>
    : Current extends ""
      ? []
      : [Trim<Current>]

/**
 * Count opening parentheses
 */
export type CountOpen<T extends string, N extends number = 0> =
  T extends `${infer _}(${infer Right}` ? CountOpen<Right, Increment<N>> : N

/**
 * Count closing parentheses
 */
export type CountClose<T extends string, N extends number = 0> =
  T extends `${infer _})${infer Right}` ? CountClose<Right, Increment<N>> : N

/**
 * Check if parentheses are balanced
 */
export type ParensBalanced<T extends string> =
  CountOpen<T> extends CountClose<T> ? true : false

