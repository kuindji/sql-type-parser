/**
 * Type-level schema matcher for UPDATE queries
 *
 * Takes a parsed SQL UPDATE AST and a database schema, returns the result row type
 * (primarily for RETURNING clause).
 */

import type {
  SQLUpdateQuery,
  UpdateClause,
  UpdateReturningClause,
  ReturningItem,
  QualifiedColumnRef,
  QualifiedWildcard,
  ReturningQualifier,
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
 * Match a parsed SQL UPDATE query against a schema to get the result type
 *
 * For UPDATE without RETURNING: returns void
 * For UPDATE with RETURNING *: returns full table row type
 * For UPDATE with RETURNING columns: returns partial row type
 * For dynamic queries: returns DynamicQueryResult
 */
export type MatchUpdateQuery<Query, Schema extends DatabaseSchema> = Query extends DynamicQuery
  ? DynamicQueryResult
  : Query extends SQLUpdateQuery<infer UpdateQuery>
    ? MatchUpdateClause<UpdateQuery, Schema>
    : MatchError<"Invalid query type">

/**
 * Match an UPDATE clause against the schema
 */
type MatchUpdateClause<Update extends UpdateClause, Schema extends DatabaseSchema> =
  Update extends UpdateClause<
    infer Table,
    infer _Set,
    infer _From,
    infer _Where,
    infer Returning
  >
    ? ResolveTableInSchema<Table, Schema> extends infer TableDef
      ? TableDef extends MatchError<string>
        ? TableDef
        : MatchReturningClause<Returning, TableDef>
      : MatchError<"Failed to resolve table">
    : MatchError<"Invalid UPDATE clause">

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
// RETURNING Clause Matching (PostgreSQL 17+ OLD/NEW support)
// ============================================================================

/**
 * Match RETURNING clause to get result type
 * Supports OLD/NEW qualified references for PostgreSQL 17+
 *
 * Note: For type purposes, OLD and NEW both refer to the same table schema.
 * The difference is semantic (pre-update vs post-update values at runtime).
 */
type MatchReturningClause<Returning, TableDef> = Returning extends undefined
  ? void // No RETURNING clause, UPDATE returns nothing
  : Returning extends UpdateReturningClause<infer Cols>
    ? Cols extends "*"
      ? TableDef // RETURNING * returns full row (NEW values)
      : Cols extends ReturningItem[]
        ? MatchReturningItems<Cols, TableDef>
        : MatchError<"Invalid RETURNING clause">
    : MatchError<"Invalid RETURNING clause">

/**
 * Match RETURNING items (columns, OLD/NEW qualified refs)
 */
type MatchReturningItems<Items extends ReturningItem[], TableDef> = Items extends [
  infer First,
  ...infer Rest,
]
  ? MatchSingleReturningItem<First, TableDef> extends infer FirstResult
    ? FirstResult extends MatchError<string>
      ? FirstResult
      : Rest extends ReturningItem[]
        ? MatchReturningItems<Rest, TableDef> extends infer RestResult
          ? RestResult extends MatchError<string>
            ? RestResult
            : Flatten<FirstResult & RestResult>
          : never
        : FirstResult
    : never
  : {}

/**
 * Match a single RETURNING item
 */
type MatchSingleReturningItem<Item, TableDef> =
  // OLD.* or NEW.* - return full row with qualified names
  Item extends QualifiedWildcard<infer Qualifier>
    ? Qualifier extends "OLD"
      ? BuildQualifiedRow<TableDef, "old">
      : Qualifier extends "NEW"
        ? BuildQualifiedRow<TableDef, "new">
        : TableDef // undefined qualifier = NEW behavior
    : // OLD.column or NEW.column
      Item extends QualifiedColumnRef<infer ColName, infer Qualifier>
      ? ColName extends keyof TableDef
        ? Qualifier extends "OLD"
          ? { [K in `old_${ColName & string}`]: TableDef[ColName] }
          : Qualifier extends "NEW"
            ? { [K in `new_${ColName & string}`]: TableDef[ColName] }
            : { [K in ColName]: TableDef[ColName] } // undefined = NEW behavior
        : MatchError<`Column '${ColName & string}' not found in table`>
      : // Unqualified column reference (backwards compatible)
        Item extends UnboundColumnRef<infer ColName>
        ? ColName extends keyof TableDef
          ? { [K in ColName]: TableDef[ColName] }
          : MatchError<`Column '${ColName}' not found in table`>
        : MatchError<"Invalid RETURNING item">

/**
 * Build a qualified row type with OLD/NEW prefixes on column names
 */
type BuildQualifiedRow<TableDef, Prefix extends "old" | "new"> = {
  [K in keyof TableDef as `${Prefix}_${K & string}`]: TableDef[K]
}

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Parse UPDATE and match against schema in one step
 *
 * Returns the result type of the UPDATE:
 * - void if no RETURNING clause
 * - Row type if RETURNING *
 * - Partial row type if RETURNING specific columns
 * - DynamicQueryResult for dynamic/non-literal queries
 */
export type UpdateResult<SQL extends string, Schema extends DatabaseSchema> =
  IsStringLiteral<SQL> extends false
    ? DynamicQueryResult
    : MatchUpdateQuery<import("./parser.js").ParseUpdateSQL<SQL>, Schema>

/**
 * Check if an UPDATE result has errors
 */
export type ValidateUpdateResult<Result> = Result extends MatchError<infer E>
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

