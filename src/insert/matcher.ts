/**
 * Type-level schema matcher for INSERT queries
 *
 * Takes a parsed SQL INSERT AST and a database schema, returns the result row type
 * (primarily for RETURNING clause).
 *
 * This module handles INSERT-specific matching logic.
 */

import type {
  SQLInsertQuery,
  InsertClause,
  InsertColumnList,
  InsertColumnRef,
  ReturningClause,
} from "./ast.js"

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
 * Match a parsed SQL INSERT query against a schema to get the result type
 *
 * For INSERT without RETURNING: returns void/undefined
 * For INSERT with RETURNING *: returns full table row type
 * For INSERT with RETURNING columns: returns partial row type
 * For dynamic queries: returns DynamicQueryResult
 */
export type MatchInsertQuery<Query, Schema extends DatabaseSchema> = Query extends DynamicQuery
  ? DynamicQueryResult
  : Query extends SQLInsertQuery<infer InsertQuery>
    ? MatchInsertClause<InsertQuery, Schema>
    : MatchError<"Invalid query type">

/**
 * Match an INSERT clause against the schema
 */
type MatchInsertClause<Insert extends InsertClause, Schema extends DatabaseSchema> =
  Insert extends InsertClause<
    infer Table,
    infer _Columns,
    infer _Source,
    infer _OnConflict,
    infer Returning
  >
    ? ResolveTableInSchema<Table, Schema> extends infer TableDef
      ? TableDef extends MatchError<string>
        ? TableDef
        : MatchReturningClause<Returning, TableDef>
      : MatchError<"Failed to resolve table">
    : MatchError<"Invalid INSERT clause">

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
  ? void // No RETURNING clause, INSERT returns nothing
  : Returning extends ReturningClause<infer Cols>
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
 * Parse INSERT and match against schema in one step
 *
 * Returns the result type of the INSERT:
 * - void if no RETURNING clause
 * - Row type if RETURNING *
 * - Partial row type if RETURNING specific columns
 * - DynamicQueryResult for dynamic/non-literal queries
 */
export type InsertResult<SQL extends string, Schema extends DatabaseSchema> =
  IsStringLiteral<SQL> extends false
    ? DynamicQueryResult
    : MatchInsertQuery<import("./parser.js").ParseInsertSQL<SQL>, Schema>

/**
 * Get the expected input type for an INSERT
 * Returns the column types that can be inserted
 */
export type InsertInput<SQL extends string, Schema extends DatabaseSchema> =
  import("./parser.js").ParseInsertSQL<SQL> extends SQLInsertQuery<infer Query>
    ? Query extends InsertClause<
        infer Table,
        infer Columns,
        infer _Source,
        infer _Conflict,
        infer _Return
      >
      ? Columns extends InsertColumnList<infer ColList>
        ? BuildInputType<ColList, Table, Schema>
        : ResolveTableInSchema<Table, Schema> // No column list, expect full row
      : never
    : never

/**
 * Build input type from column list
 */
type BuildInputType<
  Cols extends InsertColumnRef[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = ResolveTableInSchema<Table, Schema> extends infer TableDef
  ? TableDef extends MatchError<string>
    ? TableDef
    : ExtractColumnTypes<Cols, TableDef>
  : never

/**
 * Extract column types from table definition
 */
type ExtractColumnTypes<Cols extends InsertColumnRef[], TableDef> = Cols extends [
  infer First,
  ...infer Rest,
]
  ? First extends InsertColumnRef<infer ColName>
    ? ColName extends keyof TableDef
      ? Rest extends InsertColumnRef[]
        ? ExtractColumnTypes<Rest, TableDef> extends infer RestResult
          ? RestResult extends MatchError<string>
            ? RestResult
            : Flatten<{ [K in ColName]: TableDef[ColName] } & RestResult>
          : never
        : { [K in ColName]: TableDef[ColName] }
      : MatchError<`Column '${ColName}' not found in table`>
    : MatchError<"Invalid column reference">
  : {}

// ============================================================================
// Query Result Error Checking
// ============================================================================

/**
 * Check if an INSERT result has errors
 * Returns true if no errors, or the error message if there are errors
 */
export type ValidateInsertResult<Result> = Result extends MatchError<infer E>
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

