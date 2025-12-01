/**
 * Parameter extraction and validation types for SQL queries
 *
 * This module provides type-level utilities for:
 * - Extracting parameter placeholders ($1, $2, etc.) from SQL queries
 * - Determining expected parameter types based on WHERE clause context
 * - Validating parameter arrays against expected types
 *
 * @example
 * ```typescript
 * import type { ExtractParams, ParamCount, ParamTuple } from '@kuindji/sql-type-parser'
 *
 * // Extract parameter count
 * type Count = ParamCount<"SELECT * FROM users WHERE id = $1 AND name = $2">
 * // Result: 2
 *
 * // Get parameter positions
 * type Params = ExtractParams<"SELECT * FROM users WHERE id = $1">
 * // Result: ["$1"]
 * ```
 */

import type { Trim, Increment } from "./common/utils.js"

// ============================================================================
// Parameter Placeholder Types
// ============================================================================

/**
 * PostgreSQL-style positional parameter placeholder ($1, $2, etc.)
 */
export type PositionalParam<N extends number = number> = `$${N}`

/**
 * Named parameter placeholder (:name, @name)
 */
export type NamedParam<Name extends string = string> =
  | `:${Name}`
  | `@${Name}`

/**
 * Any parameter placeholder type
 */
export type ParamPlaceholder = PositionalParam | NamedParam<string>

// ============================================================================
// Parameter Extraction
// ============================================================================

/**
 * Single digit character
 */
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

/**
 * Extract leading digits from a string
 * Returns [digits, remainder]
 */
type ExtractDigits<
  T extends string,
  Acc extends string = "",
> = T extends `${infer D}${infer Rest}`
  ? D extends Digit
    ? ExtractDigits<Rest, `${Acc}${D}`>
    : [Acc, T]
  : [Acc, ""]

/**
 * Extract all $N placeholders from a SQL string
 * Returns an array of parameter strings like ["$1", "$2"]
 *
 * The pattern `${string}$${infer AfterDollar}` matches everything up to and including $
 * Then we extract digits from AfterDollar
 */
export type ExtractParams<
  T extends string,
  Acc extends string[] = [],
> = T extends `${infer _Before}$${infer AfterDollar}`
  ? ExtractDigits<AfterDollar> extends [infer Digits extends string, infer Remainder extends string]
    ? Digits extends ""
      ? ExtractParams<AfterDollar, Acc>
      : ExtractParams<Remainder, [...Acc, `$${Digits}`]>
    : Acc
  : Acc

/**
 * Count the number of unique parameters in a query
 */
export type ParamCount<T extends string> = UniqueParams<ExtractParams<T>>["length"]

/**
 * Get unique parameters (deduplicated)
 */
type UniqueParams<
  T extends string[],
  Seen extends string[] = [],
> = T extends [infer First extends string, ...infer Rest extends string[]]
  ? First extends Seen[number]
    ? UniqueParams<Rest, Seen>
    : UniqueParams<Rest, [...Seen, First]>
  : Seen

/**
 * Get the maximum parameter number from a query
 * e.g., "SELECT * FROM t WHERE a = $1 AND b = $3" -> 3
 */
export type MaxParamNumber<T extends string> = MaxFromParams<ExtractParams<T>>

/**
 * Find max from array of $N params
 */
type MaxFromParams<T extends string[], Max extends number = 0> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? First extends `$${infer N extends number}`
    ? N extends number
      ? MaxFromParams<Rest, N extends Max ? Max : GreaterThan<N, Max> extends true ? N : Max>
      : MaxFromParams<Rest, Max>
    : MaxFromParams<Rest, Max>
  : Max

/**
 * Check if A > B (limited range for type-level comparison)
 */
type GreaterThan<A extends number, B extends number> = A extends B
  ? false
  : CompareNumbers<A, B>

type CompareNumbers<A extends number, B extends number> = BuildTuple<A> extends [
  ...BuildTuple<B>,
  ...infer Rest,
]
  ? Rest extends []
    ? false
    : true
  : false

type BuildTuple<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
  ? Acc
  : Acc["length"] extends 20
    ? Acc // limit to prevent infinite recursion
    : BuildTuple<N, [...Acc, unknown]>

// ============================================================================
// Parameter Type Inference from WHERE Clause
// ============================================================================

/**
 * Parameter reference in AST
 * Represents a $N placeholder that needs a value
 */
export type ParamRef<N extends number = number> = {
  readonly type: "ParamRef"
  readonly position: N
}

/**
 * Map of parameter positions to their expected types
 * Built from analyzing WHERE clause comparisons
 */
export type ParamTypeMap<T extends Record<number, unknown> = Record<number, unknown>> = T

/**
 * Infer parameter types from a query by analyzing WHERE comparisons
 * This is a simplified inference - in complex cases, returns unknown
 *
 * @example
 * WHERE id = $1 AND name = $2
 * If schema says id: number, name: string
 * Then: { 1: number, 2: string }
 */
export type InferParamTypes<
  SQL extends string,
  Schema,
  DefaultType = unknown,
> = BuildParamTypeMap<ExtractWhereComparisons<SQL>, Schema, DefaultType>

/**
 * Extract WHERE comparisons as [column, paramNum] pairs
 */
type ExtractWhereComparisons<
  T extends string,
  Acc extends [string, number][] = [],
> = T extends `${string}WHERE ${infer WherePart}`
  ? ParseWhereComparisons<WherePart, Acc>
  : Acc

/**
 * Parse comparisons from WHERE clause
 */
type ParseWhereComparisons<
  T extends string,
  Acc extends [string, number][] = [],
> = Trim<T> extends ""
  ? Acc
  : // Pattern: column = $N
    T extends `${infer Col} = $${infer N extends number}${infer Rest}`
    ? ParseWhereComparisons<Rest, [...Acc, [ExtractColumnName<Col>, N]]>
    : // Pattern: $N = column (reversed)
      T extends `$${infer N extends number} = ${infer Col}${infer Rest}`
      ? ParseWhereComparisons<Rest, [...Acc, [ExtractColumnName<Col>, N]]>
      : // Pattern: column IN ($N, ...)
        T extends `${infer Col} IN ( $${infer N extends number}${infer Rest}`
        ? ParseWhereComparisons<Rest, [...Acc, [ExtractColumnName<Col>, N]]>
        : // Skip to next AND/OR
          T extends `${string}AND ${infer Rest}`
          ? ParseWhereComparisons<Rest, Acc>
          : T extends `${string}OR ${infer Rest}`
            ? ParseWhereComparisons<Rest, Acc>
            : Acc

/**
 * Extract just the column name from a comparison operand
 */
type ExtractColumnName<T extends string> = Trim<T> extends `${infer Table}.${infer Col}`
  ? Trim<Col>
  : Trim<T>

/**
 * Build a parameter type map from comparisons and schema
 */
type BuildParamTypeMap<
  Comparisons extends [string, number][],
  Schema,
  DefaultType,
  Acc extends Record<number, unknown> = {},
> = Comparisons extends [[infer Col extends string, infer N extends number], ...infer Rest]
  ? Rest extends [string, number][]
    ? BuildParamTypeMap<
        Rest,
        Schema,
        DefaultType,
        Acc & { [K in N]: LookupColumnType<Col, Schema, DefaultType> }
      >
    : Acc & { [K in N]: LookupColumnType<Col, Schema, DefaultType> }
  : Acc

/**
 * Look up a column's type in the schema
 * Returns DefaultType if not found
 */
type LookupColumnType<
  Column extends string,
  Schema,
  DefaultType,
> = Schema extends { schemas: infer Schemas }
  ? SearchSchemasForColumn<Column, Schemas, DefaultType>
  : DefaultType

type SearchSchemasForColumn<
  Column extends string,
  Schemas,
  DefaultType,
> = Schemas extends Record<string, Record<string, Record<string, unknown>>>
  ? {
      [SchemaName in keyof Schemas]: {
        [TableName in keyof Schemas[SchemaName]]: Column extends keyof Schemas[SchemaName][TableName]
          ? Schemas[SchemaName][TableName][Column]
          : never
      }[keyof Schemas[SchemaName]]
    }[keyof Schemas] extends infer Found
    ? [Found] extends [never]
      ? DefaultType
      : Found
    : DefaultType
  : DefaultType

// ============================================================================
// Parameter Tuple Types
// ============================================================================

/**
 * Create a tuple type for parameters based on max param number
 * e.g., MaxParam = 3 -> [T, T, T]
 */
export type ParamTuple<
  MaxN extends number,
  T = unknown,
  Acc extends unknown[] = [],
> = Acc["length"] extends MaxN ? Acc : ParamTuple<MaxN, T, [...Acc, T]>

/**
 * Create a typed parameter tuple from a SQL query and schema
 * Parameters are ordered by their position ($1, $2, etc.)
 */
export type TypedParamTuple<
  SQL extends string,
  Schema,
  DefaultType = unknown,
> = MaxParamNumber<SQL> extends infer Max extends number
  ? Max extends 0
    ? []
    : BuildTypedTuple<Max, InferParamTypes<SQL, Schema, DefaultType>, DefaultType>
  : []

/**
 * Build a typed tuple from 1 to Max
 */
type BuildTypedTuple<
  Max extends number,
  TypeMap extends Record<number, unknown>,
  DefaultType,
  Current extends number = 1,
  Acc extends unknown[] = [],
> = Current extends Max
  ? [...Acc, Current extends keyof TypeMap ? TypeMap[Current] : DefaultType]
  : Acc["length"] extends 20
    ? Acc // safety limit
    : BuildTypedTuple<
        Max,
        TypeMap,
        DefaultType,
        Increment<Current> extends number ? Increment<Current> : never,
        [...Acc, Current extends keyof TypeMap ? TypeMap[Current] : DefaultType]
      >

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validate that a parameter array has the correct length
 */
export type ValidateParamCount<
  SQL extends string,
  Params extends unknown[],
> = MaxParamNumber<SQL> extends Params["length"]
  ? true
  : `Expected ${MaxParamNumber<SQL>} parameters, got ${Params["length"]}`

/**
 * Validate parameter types against inferred types
 * Returns true if valid, error message otherwise
 */
export type ValidateParamTypes<
  SQL extends string,
  Params extends unknown[],
  Schema,
> = ValidateParamCount<SQL, Params> extends true
  ? CheckParamTypes<Params, TypedParamTuple<SQL, Schema>>
  : ValidateParamCount<SQL, Params>

type CheckParamTypes<
  Actual extends unknown[],
  Expected extends unknown[],
  Index extends number = 0,
> = Actual extends [infer A, ...infer RestA]
  ? Expected extends [infer E, ...infer RestE]
    ? A extends E
      ? RestA extends unknown[]
        ? RestE extends unknown[]
          ? CheckParamTypes<RestA, RestE, Increment<Index> extends number ? Increment<Index> : never>
          : true
        : true
      : `Parameter ${Index} type mismatch: expected ${E & string}, got ${A & string}`
    : true
  : true

// ============================================================================
// Utility: Replace Parameters with Actual Values
// ============================================================================

/**
 * Type representing a SQL query with parameters replaced
 * Useful for logging/debugging - shows what the query "looks like" with values
 */
export type QueryWithParams<
  SQL extends string,
  Params extends unknown[],
> = ReplaceParams<SQL, Params>

type ReplaceParams<
  SQL extends string,
  Params extends unknown[],
  Index extends number = 1,
> = SQL extends `${infer Before}$${Index}${infer After}`
  ? Params extends [infer First, ...infer Rest]
    ? ReplaceParams<
        `${Before}${FormatValue<First>}${After}`,
        Rest,
        Increment<Index> extends number ? Increment<Index> : never
      >
    : SQL
  : SQL

type FormatValue<T> = T extends string
  ? `'${T}'`
  : T extends number
    ? `${T}`
    : T extends boolean
      ? T extends true
        ? "TRUE"
        : "FALSE"
      : T extends null
        ? "NULL"
        : "?"
