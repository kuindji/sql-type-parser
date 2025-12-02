/**
 * DELETE Query Validator
 *
 * This module provides comprehensive validation for DELETE queries.
 * It validates:
 * - Table existence in schema
 * - WHERE clause column references
 * - USING clause table references
 * - RETURNING clause column validation
 */

import type {
  SQLDeleteQuery,
  DeleteClause,
  UsingClause,
  DeleteReturningClause,
} from "./ast.js"

import type {
  TableRef,
  TableSource,
  UnboundColumnRef,
  ValidatableColumnRef,
  TableColumnRef,
  ParsedCondition,
} from "../common/ast.js"

import type {
  MatchError,
  IsMatchError,
  ParseError,
  IsParseError,
  HasTemplateHoles,
} from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

import type { ParseDeleteSQL } from "./parser.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for controlling DELETE query validation depth
 */
export type ValidateDeleteOptions = {
  /**
   * Whether to validate WHERE clause column references
   * @default true
   */
  validateWhere?: boolean

  /**
   * Whether to validate RETURNING clause columns
   * @default true
   */
  validateReturning?: boolean
}

/**
 * Default validation options - full validation enabled
 */
type DefaultValidateOptions = { validateWhere: true; validateReturning: true }

// ============================================================================
// Main Validator Entry Point
// ============================================================================

/**
 * Validate a DELETE query against a schema
 *
 * Returns true if valid, or an error message if invalid.
 * For dynamic queries (non-literal strings), returns true (can't validate at compile time).
 */
export type ValidateDeleteSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
  Options extends ValidateDeleteOptions = DefaultValidateOptions,
> = HasTemplateHoles<SQL> extends true
  ? true // Dynamic queries bypass validation
  : ParseDeleteSQL<SQL> extends infer Parsed
    ? Parsed extends ParseError<infer E>
      ? E
      : Parsed extends SQLDeleteQuery<infer Query>
        ? ValidateDeleteClause<Query, Schema, Options>
        : "Failed to parse query"
    : never

// ============================================================================
// Delete Clause Validation
// ============================================================================

/**
 * Validate a DELETE clause
 */
type ValidateDeleteClause<
  Delete extends DeleteClause,
  Schema extends DatabaseSchema,
  Options extends ValidateDeleteOptions = DefaultValidateOptions,
> = Delete extends DeleteClause<infer Table, infer Using, infer Where, infer Returning>
  ? ValidateTable<Table, Schema> extends infer TableResult
    ? TableResult extends true
      ? ValidateUsingClause<Using, Schema> extends infer UsingResult
        ? UsingResult extends true
          ? BuildValidationContext<Table, Using, Schema> extends infer Context
            ? Context extends MatchError<string>
              ? Context
              : ValidateWhereClause<Where, Context, Schema, Options> extends infer WhereResult
                ? WhereResult extends true
                  ? ValidateReturningClause<Returning, Table, Schema, Options>
                  : WhereResult
                : "WHERE validation failed"
            : "Context building failed"
          : UsingResult
        : "USING validation failed"
      : TableResult
    : "Table validation failed"
  : "Invalid DELETE clause"

// ============================================================================
// Table Validation
// ============================================================================

/**
 * Validate that the target table exists in the schema
 */
type ValidateTable<Table extends TableRef, Schema extends DatabaseSchema> =
  Table extends TableRef<infer TableName, infer _Alias, infer TableSchema>
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
// USING Clause Validation
// ============================================================================

/**
 * Validate USING clause tables exist
 */
type ValidateUsingClause<Using, Schema extends DatabaseSchema> = Using extends undefined
  ? true
  : Using extends UsingClause<infer Tables>
    ? ValidateTableList<Tables, Schema>
    : true

/**
 * Validate a list of tables
 */
type ValidateTableList<
  Tables extends TableSource[],
  Schema extends DatabaseSchema,
> = Tables extends [infer First, ...infer Rest]
  ? First extends TableRef<infer TableName, infer _Alias, infer TableSchema>
    ? ResolveTableInSchema<TableName, TableSchema, Schema> extends infer Result
      ? Result extends true
        ? Rest extends TableSource[]
          ? ValidateTableList<Rest, Schema>
          : true
        : Result
      : "Table validation failed"
    : true
  : true

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build validation context from main table and USING tables
 */
type BuildValidationContext<
  Table extends TableRef,
  Using,
  Schema extends DatabaseSchema,
> = ResolveTableContext<Table, Schema> extends infer MainContext
  ? MainContext extends MatchError<string>
    ? MainContext
    : Using extends UsingClause<infer Tables>
      ? MergeUsingContexts<MainContext, Tables, Schema>
      : MainContext
  : never

/**
 * Resolve table to context entry
 */
type ResolveTableContext<Table extends TableRef, Schema extends DatabaseSchema> =
  Table extends TableRef<infer TableName, infer Alias, infer TableSchema>
    ? TableSchema extends undefined
      ? GetDefaultSchema<Schema> extends infer DefaultSchema extends string
        ? DefaultSchema extends keyof Schema["schemas"]
          ? TableName extends keyof Schema["schemas"][DefaultSchema]
            ? { [K in Alias]: Schema["schemas"][DefaultSchema][TableName] }
            : MatchError<`Table '${TableName}' not found`>
          : MatchError<`Default schema not found`>
        : MatchError<`Cannot determine default schema`>
      : TableSchema extends keyof Schema["schemas"]
        ? TableName extends keyof Schema["schemas"][TableSchema]
          ? { [K in Alias]: Schema["schemas"][TableSchema][TableName] }
          : MatchError<`Table '${TableName}' not found in schema '${TableSchema}'`>
        : MatchError<`Schema '${TableSchema}' not found`>
    : MatchError<`Invalid table reference`>

/**
 * Merge USING tables into context
 */
type MergeUsingContexts<
  Context,
  Tables extends TableSource[],
  Schema extends DatabaseSchema,
> = Tables extends [infer First, ...infer Rest]
  ? First extends TableRef
    ? ResolveTableContext<First, Schema> extends infer TableContext
      ? TableContext extends MatchError<string>
        ? TableContext
        : Rest extends TableSource[]
          ? MergeUsingContexts<Context & TableContext, Rest, Schema>
          : Context & TableContext
      : Context
    : Context
  : Context

// ============================================================================
// WHERE Clause Validation
// ============================================================================

/**
 * Validate WHERE clause column references
 */
type ValidateWhereClause<
  Where,
  Context,
  Schema extends DatabaseSchema,
  Options extends ValidateDeleteOptions,
> = Options["validateWhere"] extends false
  ? true
  : Where extends undefined
    ? true
    : Where extends ParsedCondition<infer ColumnRefs>
      ? ValidateColumnRefList<ColumnRefs, Context, Schema>
      : true

/**
 * Validate a list of column references
 */
type ValidateColumnRefList<
  Refs extends ValidatableColumnRef[],
  Context,
  Schema extends DatabaseSchema,
> = Refs extends [infer First, ...infer Rest]
  ? ValidateSingleRef<First, Context, Schema> extends infer Result
    ? Result extends true
      ? Rest extends ValidatableColumnRef[]
        ? ValidateColumnRefList<Rest, Context, Schema>
        : true
      : Result
    : "Validation failed"
  : true

/**
 * Validate a single column reference
 */
type ValidateSingleRef<Ref, Context, Schema extends DatabaseSchema> =
  Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
    ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
      ? ValidateUnboundColumn<Column, Context>
      : true

/**
 * Validate a table-qualified column
 */
type ValidateTableColumn<
  TableOrAlias extends string,
  Column extends string,
  ColSchema extends string | undefined,
  Context,
  Schema extends DatabaseSchema,
> = ColSchema extends undefined
  ? TableOrAlias extends keyof Context
    ? Context[TableOrAlias] extends infer Table
      ? Column extends keyof Table
        ? true
        : `Column '${Column}' not found in '${TableOrAlias}'`
      : never
    : `Table or alias '${TableOrAlias}' not found`
  : ColSchema extends string
    ? ColSchema extends keyof Schema["schemas"]
      ? TableOrAlias extends keyof Schema["schemas"][ColSchema]
        ? Column extends keyof Schema["schemas"][ColSchema][TableOrAlias]
          ? true
          : `Column '${Column}' not found in '${ColSchema}.${TableOrAlias}'`
        : `Table '${TableOrAlias}' not found in schema '${ColSchema}'`
      : `Schema '${ColSchema}' not found`
    : `Invalid schema type`

/**
 * Validate an unbound column exists in some table
 */
type ValidateUnboundColumn<Column extends string, Context> = ColumnExistsInContext<
  Column,
  Context,
  keyof Context
>

/**
 * Check if column exists in any table in context
 */
type ColumnExistsInContext<Column extends string, Context, Keys> = [Keys] extends [never]
  ? `Column '${Column}' not found in any table`
  : Keys extends keyof Context
    ? Context[Keys] extends infer Table
      ? Column extends keyof Table
        ? true
        : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
      : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
    : `Column '${Column}' not found in any table`

// ============================================================================
// RETURNING Clause Validation
// ============================================================================

/**
 * Validate RETURNING clause
 */
type ValidateReturningClause<
  Returning,
  Table extends TableRef,
  Schema extends DatabaseSchema,
  Options extends ValidateDeleteOptions,
> = Options["validateReturning"] extends false
  ? true
  : Returning extends undefined
    ? true
    : Returning extends DeleteReturningClause<infer Cols>
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

/**
 * Validate a column exists in the table
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
// Convenience Types
// ============================================================================

/**
 * Check if a DELETE query is valid
 */
export type IsValidDelete<SQL extends string, Schema extends DatabaseSchema> =
  ValidateDeleteSQL<SQL, Schema> extends true ? true : false

/**
 * Get the table columns that would be affected by a DELETE
 */
export type GetDeleteTableColumns<SQL extends string, Schema extends DatabaseSchema> =
  ParseDeleteSQL<SQL> extends SQLDeleteQuery<infer Query>
    ? Query extends DeleteClause<infer Table, infer _Using, infer _Where, infer _Return>
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

