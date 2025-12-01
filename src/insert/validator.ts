/**
 * INSERT Query Validator
 * 
 * This module provides comprehensive validation for INSERT queries.
 * It validates:
 * - Table existence in schema
 * - Column existence in target table
 * - Value count matches column count
 * - RETURNING clause column validation
 */

import type {
  SQLInsertQuery,
  InsertClause,
  InsertColumnList,
  InsertColumnRef,
  InsertValuesClause,
  InsertSelectClause,
  InsertValueRow,
  ReturningClause,
  OnConflictClause,
  ConflictUpdateSet,
} from "./ast.js"

import type {
  TableRef,
  UnboundColumnRef,
} from "../common/ast.js"

import type { MatchError, IsMatchError, ParseError, IsParseError, IsStringLiteral } from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

import type { ParseInsertSQL } from "./parser.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for controlling INSERT query validation depth
 */
export type ValidateInsertOptions = {
  /**
   * Whether to validate the value count matches column count
   * @default true
   */
  validateValueCount?: boolean
  
  /**
   * Whether to validate RETURNING clause columns
   * @default true
   */
  validateReturning?: boolean
}

/**
 * Default validation options - full validation enabled
 */
type DefaultValidateOptions = { validateValueCount: true; validateReturning: true }

// ============================================================================
// Main Validator Entry Point
// ============================================================================

/**
 * Validate an INSERT query against a schema
 * 
 * Returns true if valid, or an error message if invalid.
 * For dynamic queries (non-literal strings), returns true (can't validate at compile time).
 * 
 * @param SQL - The SQL query string to validate
 * @param Schema - The database schema to validate against
 * @param Options - Validation options (optional, defaults to full validation)
 */
export type ValidateInsertSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
  Options extends ValidateInsertOptions = DefaultValidateOptions,
> = IsStringLiteral<SQL> extends false
  ? true  // Dynamic queries bypass validation
  : ParseInsertSQL<SQL> extends infer Parsed
    ? Parsed extends ParseError<infer E>
      ? E
      : Parsed extends SQLInsertQuery<infer Query>
        ? ValidateInsertClause<Query, Schema, Options>
        : "Failed to parse query"
    : never

// ============================================================================
// Insert Clause Validation
// ============================================================================

/**
 * Validate an INSERT clause
 */
type ValidateInsertClause<
  Insert extends InsertClause,
  Schema extends DatabaseSchema,
  Options extends ValidateInsertOptions = DefaultValidateOptions,
> = Insert extends InsertClause<
  infer Table,
  infer Columns,
  infer Source,
  infer OnConflict,
  infer Returning
>
  ? ValidateTable<Table, Schema> extends infer TableResult
    ? TableResult extends true
      ? ValidateColumnsExist<Table, Columns, Schema> extends infer ColResult
        ? ColResult extends true
          ? ValidateSource<Source, Table, Columns, Schema, Options> extends infer SourceResult
            ? SourceResult extends true
              ? ValidateOnConflict<OnConflict, Table, Schema> extends infer ConflictResult
                ? ConflictResult extends true
                  ? ValidateReturningClause<Returning, Table, Schema, Options>
                  : ConflictResult
                : "ON CONFLICT validation failed"
              : SourceResult
            : "Source validation failed"
          : ColResult
        : "Column validation failed"
      : TableResult
    : "Table validation failed"
  : "Invalid INSERT clause"

// ============================================================================
// Table Validation
// ============================================================================

/**
 * Validate that the target table exists in the schema
 */
type ValidateTable<
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Table extends TableRef<infer TableName, infer _Alias, infer TableSchema>
  ? ResolveTableInSchema<TableName, TableSchema, Schema>
  : `Invalid table reference`

/**
 * Resolve a table in the database schema
 */
type ResolveTableInSchema<
  TableName extends string,
  TableSchema extends string | undefined,
  Schema extends DatabaseSchema,
> = TableSchema extends undefined
  ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
    ? DefaultSchema extends keyof Schema["schemas"]
      ? TableName extends keyof Schema["schemas"][DefaultSchema]
        ? true
        : `Table '${TableName}' not found in default schema '${DefaultSchema}'`
      : `Default schema not found`
    : `Cannot determine default schema`
  : TableSchema extends string
    ? TableSchema extends keyof Schema["schemas"]
      ? TableName extends keyof Schema["schemas"][TableSchema]
        ? true
        : `Table '${TableName}' not found in schema '${TableSchema}'`
      : `Schema '${TableSchema}' not found`
    : `Invalid schema type`

// ============================================================================
// Column Existence Validation
// ============================================================================

/**
 * Validate that all specified columns exist in the target table
 */
type ValidateColumnsExist<
  Table extends TableRef,
  Columns extends InsertColumnList | undefined,
  Schema extends DatabaseSchema,
> = Columns extends undefined
  ? true  // No explicit column list, will be validated with values
  : Columns extends InsertColumnList<infer ColList>
    ? ValidateColumnList<ColList, Table, Schema>
    : true

/**
 * Validate a list of columns
 */
type ValidateColumnList<
  Columns extends InsertColumnRef[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Columns extends [infer First, ...infer Rest]
  ? First extends InsertColumnRef<infer ColName>
    ? ValidateColumnExists<ColName, Table, Schema> extends infer Result
      ? Result extends true
        ? Rest extends InsertColumnRef[]
          ? ValidateColumnList<Rest, Table, Schema>
          : true
        : Result
      : "Column validation failed"
    : true
  : true

/**
 * Validate a single column exists in the table
 */
type ValidateColumnExists<
  ColumnName extends string,
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Table extends TableRef<infer TableName, infer _Alias, infer TableSchema>
  ? TableSchema extends undefined
    ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
      ? DefaultSchema extends keyof Schema["schemas"]
        ? TableName extends keyof Schema["schemas"][DefaultSchema]
          ? ColumnName extends keyof Schema["schemas"][DefaultSchema][TableName]
            ? true
            : `Column '${ColumnName}' not found in table '${TableName}'`
          : `Table '${TableName}' not found`
        : `Default schema not found`
      : `Cannot determine default schema`
    : TableSchema extends string
      ? TableSchema extends keyof Schema["schemas"]
        ? TableName extends keyof Schema["schemas"][TableSchema]
          ? ColumnName extends keyof Schema["schemas"][TableSchema][TableName]
            ? true
            : `Column '${ColumnName}' not found in table '${TableSchema}.${TableName}'`
          : `Table '${TableName}' not found in schema '${TableSchema}'`
        : `Schema '${TableSchema}' not found`
      : `Invalid schema type`
  : `Invalid table reference`

// ============================================================================
// Source Validation
// ============================================================================

/**
 * Validate INSERT source (VALUES or SELECT)
 */
type ValidateSource<
  Source,
  Table extends TableRef,
  Columns extends InsertColumnList | undefined,
  Schema extends DatabaseSchema,
  Options extends ValidateInsertOptions,
> = Source extends InsertValuesClause<infer Rows>
  ? Options["validateValueCount"] extends false
    ? true
    : ValidateValueRows<Rows, Table, Columns, Schema>
  : Source extends InsertSelectClause
    ? true  // SELECT validation would need full SELECT validation
    : true

/**
 * Validate value rows have correct count
 */
type ValidateValueRows<
  Rows extends InsertValueRow[],
  Table extends TableRef,
  Columns extends InsertColumnList | undefined,
  Schema extends DatabaseSchema,
> = Rows extends [infer First, ...infer Rest]
  ? First extends InsertValueRow<infer Values>
    ? ValidateValueCount<Values, Table, Columns, Schema> extends infer Result
      ? Result extends true
        ? Rest extends InsertValueRow[]
          ? ValidateValueRows<Rest, Table, Columns, Schema>
          : true
        : Result
      : "Value validation failed"
    : true
  : true

/**
 * Validate value count matches column count
 * If no columns specified, count must match table column count
 */
type ValidateValueCount<
  Values extends unknown[],
  Table extends TableRef,
  Columns extends InsertColumnList | undefined,
  Schema extends DatabaseSchema,
> = Columns extends InsertColumnList<infer ColList>
  ? Values["length"] extends ColList["length"]
    ? true
    : `Value count (${Values["length"]}) does not match column count (${ColList["length"]})`
  : true  // Without explicit columns, we can't validate count at compile time

// ============================================================================
// ON CONFLICT Validation
// ============================================================================

/**
 * Validate ON CONFLICT clause
 */
type ValidateOnConflict<
  OnConflict,
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = OnConflict extends undefined
  ? true
  : OnConflict extends OnConflictClause<infer Target, infer _Action, infer Updates, infer _Where>
    ? ValidateConflictTarget<Target, Table, Schema> extends infer TargetResult
      ? TargetResult extends true
        ? ValidateConflictUpdates<Updates, Table, Schema>
        : TargetResult
      : "Conflict target validation failed"
    : true

/**
 * Validate conflict target columns exist
 */
type ValidateConflictTarget<
  Target,
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Target extends undefined
  ? true
  : Target extends { columns: infer Cols }
    ? Cols extends string[]
      ? ValidateStringColumns<Cols, Table, Schema>
      : true
    : true

/**
 * Validate string column names
 */
type ValidateStringColumns<
  Cols extends string[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Cols extends [infer First extends string, ...infer Rest extends string[]]
  ? ValidateColumnExists<First, Table, Schema> extends infer Result
    ? Result extends true
      ? ValidateStringColumns<Rest, Table, Schema>
      : Result
    : "Column validation failed"
  : true

/**
 * Validate conflict update SET clauses
 */
type ValidateConflictUpdates<
  Updates,
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Updates extends undefined
  ? true
  : Updates extends ConflictUpdateSet[]
    ? ValidateUpdateSetList<Updates, Table, Schema>
    : true

/**
 * Validate list of SET clauses
 */
type ValidateUpdateSetList<
  Updates extends ConflictUpdateSet[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Updates extends [infer First, ...infer Rest]
  ? First extends ConflictUpdateSet<infer Col, infer _Val>
    ? ValidateColumnExists<Col, Table, Schema> extends infer Result
      ? Result extends true
        ? Rest extends ConflictUpdateSet[]
          ? ValidateUpdateSetList<Rest, Table, Schema>
          : true
        : Result
      : "SET column validation failed"
    : true
  : true

// ============================================================================
// RETURNING Validation
// ============================================================================

/**
 * Validate RETURNING clause
 */
type ValidateReturningClause<
  Returning,
  Table extends TableRef,
  Schema extends DatabaseSchema,
  Options extends ValidateInsertOptions,
> = Options["validateReturning"] extends false
  ? true
  : Returning extends undefined
    ? true
    : Returning extends ReturningClause<infer Cols>
      ? Cols extends "*"
        ? true
        : Cols extends UnboundColumnRef[]
          ? ValidateReturningColumns<Cols, Table, Schema>
          : true
      : true

/**
 * Validate RETURNING column list
 */
type ValidateReturningColumns<
  Cols extends UnboundColumnRef[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Cols extends [infer First, ...infer Rest]
  ? First extends UnboundColumnRef<infer ColName>
    ? ValidateColumnExists<ColName, Table, Schema> extends infer Result
      ? Result extends true
        ? Rest extends UnboundColumnRef[]
          ? ValidateReturningColumns<Rest, Table, Schema>
          : true
        : Result
      : "RETURNING column validation failed"
    : true
  : true

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Check if an INSERT query is valid
 * Returns true if valid, error message string if invalid
 */
export type IsValidInsert<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ValidateInsertSQL<SQL, Schema> extends true ? true : false

/**
 * Get the table columns that would be affected by an INSERT
 * Returns the table's column type definition
 */
export type GetInsertTableColumns<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ParseInsertSQL<SQL> extends SQLInsertQuery<infer Query>
  ? Query extends InsertClause<infer Table, infer _Cols, infer _Source, infer _Conflict, infer _Return>
    ? Table extends TableRef<infer TableName, infer _Alias, infer TableSchema>
      ? TableSchema extends undefined
        ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
          ? DefaultSchema extends keyof Schema["schemas"]
            ? TableName extends keyof Schema["schemas"][DefaultSchema]
              ? Schema["schemas"][DefaultSchema][TableName]
              : never
            : never
          : never
        : TableSchema extends keyof Schema["schemas"]
          ? TableName extends keyof Schema["schemas"][TableSchema]
            ? Schema["schemas"][TableSchema][TableName]
            : never
          : never
      : never
    : never
  : never

