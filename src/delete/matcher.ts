/**
 * Type-level schema matcher for DELETE queries
 *
 * Takes a parsed SQL DELETE AST and a database schema, returns the result row type
 * (primarily for RETURNING clause).
 */

import type { SQLDeleteQuery, DeleteClause, DeleteReturningClause } from "./ast.js"

import type { TableRef, UnboundColumnRef } from "../common/ast.js"

import type {
  Flatten,
  MatchError,
  IsMatchError,
  DynamicQuery,
  DynamicQueryResult,
  IsStringLiteral,
} from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Main Matcher
// ============================================================================

/**
 * Match a parsed SQL DELETE query against a schema to get the result type
 *
 * For DELETE without RETURNING: returns void
 * For DELETE with RETURNING *: returns full table row type
 * For DELETE with RETURNING columns: returns partial row type
 * For dynamic queries: returns DynamicQueryResult
 */
export type MatchDeleteQuery<Query, Schema extends DatabaseSchema> = Query extends DynamicQuery
  ? DynamicQueryResult
  : Query extends SQLDeleteQuery<infer DeleteQuery>
    ? MatchDeleteClause<DeleteQuery, Schema>
    : MatchError<"Invalid query type">

/**
 * Match a DELETE clause against the schema
 */
type MatchDeleteClause<Delete extends DeleteClause, Schema extends DatabaseSchema> =
  Delete extends DeleteClause<infer Table, infer _Using, infer _Where, infer Returning>
    ? ResolveTableInSchema<Table, Schema> extends infer TableDef
      ? TableDef extends MatchError<string>
        ? TableDef
        : MatchReturningClause<Returning, TableDef>
      : MatchError<"Failed to resolve table">
    : MatchError<"Invalid DELETE clause">

// ============================================================================
// Table Resolution
// ============================================================================

/**
 * Resolve a table in the database schema
 */
type ResolveTableInSchema<Table extends TableRef, Schema extends DatabaseSchema> =
  Table extends TableRef<infer TableName, infer _Alias, infer TableSchema>
    ? TableSchema extends undefined
      ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
        ? DefaultSchema extends keyof Schema["schemas"]
          ? TableName extends keyof Schema["schemas"][DefaultSchema]
            ? Schema["schemas"][DefaultSchema][TableName]
            : MatchError<`Table '${TableName}' not found in default schema '${DefaultSchema}'`>
          : MatchError<`Default schema not found`>
        : MatchError<`Cannot determine default schema`>
      : TableSchema extends string
        ? TableSchema extends keyof Schema["schemas"]
          ? TableName extends keyof Schema["schemas"][TableSchema]
            ? Schema["schemas"][TableSchema][TableName]
            : MatchError<`Table '${TableName}' not found in schema '${TableSchema}'`>
          : MatchError<`Schema '${TableSchema}' not found`>
        : MatchError<`Invalid schema type`>
    : MatchError<`Invalid table reference`>

// ============================================================================
// RETURNING Clause Matching
// ============================================================================

/**
 * Match RETURNING clause to get result type
 */
type MatchReturningClause<Returning, TableDef> = Returning extends undefined
  ? void // No RETURNING clause, DELETE returns nothing
  : Returning extends DeleteReturningClause<infer Cols>
    ? Cols extends "*"
      ? TableDef // RETURNING * returns full row
      : Cols extends UnboundColumnRef[]
        ? MatchReturningColumns<Cols, TableDef>
        : MatchError<"Invalid RETURNING clause">
    : MatchError<"Invalid RETURNING clause">

/**
 * Match RETURNING columns to build result type
 */
type MatchReturningColumns<Cols extends UnboundColumnRef[], TableDef> = Cols extends [
  infer First,
  ...infer Rest,
]
  ? First extends UnboundColumnRef<infer ColName>
    ? ColName extends keyof TableDef
      ? Rest extends UnboundColumnRef[]
        ? MatchReturningColumns<Rest, TableDef> extends infer RestResult
          ? RestResult extends MatchError<string>
            ? RestResult
            : Flatten<{ [K in ColName]: TableDef[ColName] } & RestResult>
          : never
        : { [K in ColName]: TableDef[ColName] }
      : MatchError<`Column '${ColName}' not found in table`>
    : MatchError<"Invalid column reference">
  : {}

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Parse DELETE and match against schema in one step
 *
 * Returns the result type of the DELETE:
 * - void if no RETURNING clause
 * - Row type if RETURNING *
 * - Partial row type if RETURNING specific columns
 * - DynamicQueryResult for dynamic/non-literal queries
 */
export type DeleteResult<SQL extends string, Schema extends DatabaseSchema> =
  IsStringLiteral<SQL> extends false
    ? DynamicQueryResult
    : MatchDeleteQuery<import("./parser.js").ParseDeleteSQL<SQL>, Schema>

/**
 * Check if a DELETE result has errors
 */
export type ValidateDeleteResult<Result> = Result extends MatchError<infer E>
  ? E
  : Result extends void
    ? true
    : FindFirstError<Result> extends never
      ? true
      : FindFirstError<Result>

/**
 * Find the first error in a result object
 */
type FindFirstError<T> = IsMatchError<T> extends true
  ? ExtractError<T>
  : T extends object
    ? CollectErrors<T> extends infer Errors
      ? [Errors] extends [never]
        ? never
        : Errors
      : never
    : never

/**
 * Extract error message from a MatchError
 */
type ExtractError<T> = T extends { readonly __error: true; readonly message: infer M } ? M : never

/**
 * Collect errors from direct properties
 */
type CollectErrors<T> = {
  [K in keyof T]: IsMatchError<T[K]> extends true ? ExtractError<T[K]> : never
}[keyof T]

