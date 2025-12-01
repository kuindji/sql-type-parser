/**
 * UPDATE Query Validator
 * 
 * This module provides comprehensive validation for UPDATE queries.
 * It validates:
 * - Table existence in schema
 * - SET clause column references
 * - FROM clause table references
 * - WHERE clause column references
 * - RETURNING clause column validation
 */

import type {
  SQLUpdateQuery,
  UpdateClause,
  SetClause,
  SetAssignment,
  UpdateFromClause,
  ReturningClause,
  ReturningItem,
  QualifiedColumnRef,
  QualifiedWildcard,
} from "./ast.js"

import type {
  TableRef,
  TableSource,
  UnboundColumnRef,
  ValidatableColumnRef,
  TableColumnRef,
  ParsedCondition,
} from "../common/ast.js"

import type { MatchError, IsMatchError, ParseError, IsParseError } from "../common/utils.js"
import type { DatabaseSchema, GetDefaultSchema } from "../common/schema.js"

import type { ParseUpdateSQL } from "./parser.js"

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { MatchError } from "../common/utils.js"
export type { DatabaseSchema } from "../common/schema.js"

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for controlling UPDATE query validation depth
 */
export type ValidateUpdateOptions = {
  /**
   * Whether to validate SET clause column references
   * @default true
   */
  validateSet?: boolean
  
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
type DefaultValidateOptions = { validateSet: true; validateWhere: true; validateReturning: true }

// ============================================================================
// Main Validator Entry Point
// ============================================================================

/**
 * Validate an UPDATE query against a schema
 * 
 * Returns true if valid, or an error message if invalid.
 */
export type ValidateUpdateSQL<
  SQL extends string,
  Schema extends DatabaseSchema,
  Options extends ValidateUpdateOptions = DefaultValidateOptions,
> = ParseUpdateSQL<SQL> extends infer Parsed
  ? Parsed extends ParseError<infer E>
    ? E
    : Parsed extends SQLUpdateQuery<infer Query>
      ? ValidateUpdateClause<Query, Schema, Options>
      : "Failed to parse query"
  : never

// ============================================================================
// Update Clause Validation
// ============================================================================

/**
 * Validate an UPDATE clause
 */
type ValidateUpdateClause<
  Update extends UpdateClause,
  Schema extends DatabaseSchema,
  Options extends ValidateUpdateOptions = DefaultValidateOptions,
> = Update extends UpdateClause<
  infer Table,
  infer Set,
  infer From,
  infer Where,
  infer Returning
>
  ? ValidateTable<Table, Schema> extends infer TableResult
    ? TableResult extends true
      ? ValidateFromClause<From, Schema> extends infer FromResult
        ? FromResult extends true
          ? BuildValidationContext<Table, From, Schema> extends infer Context
            ? Context extends MatchError<string>
              ? Context
              : ValidateSetClause<Set, Table, Schema, Options> extends infer SetResult
                ? SetResult extends true
                  ? ValidateWhereClause<Where, Context, Schema, Options> extends infer WhereResult
                    ? WhereResult extends true
                      ? ValidateReturningClause<Returning, Table, Schema, Options>
                      : WhereResult
                    : "WHERE validation failed"
                  : SetResult
                : "SET validation failed"
            : "Context building failed"
          : FromResult
        : "FROM validation failed"
      : TableResult
    : "Table validation failed"
  : "Invalid UPDATE clause"

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
// SET Clause Validation
// ============================================================================

/**
 * Validate SET clause columns exist in target table
 */
type ValidateSetClause<
  Set extends SetClause,
  Table extends TableRef,
  Schema extends DatabaseSchema,
  Options extends ValidateUpdateOptions,
> = Options["validateSet"] extends false
  ? true
  : Set extends SetClause<infer Assignments>
    ? ValidateSetAssignments<Assignments, Table, Schema>
    : true

/**
 * Validate list of SET assignments
 */
type ValidateSetAssignments<
  Assignments extends SetAssignment[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Assignments extends [infer First, ...infer Rest]
  ? First extends SetAssignment<infer Column, infer _Value>
    ? ValidateColumnExists<Column, Table, Schema> extends infer Result
      ? Result extends true
        ? Rest extends SetAssignment[]
          ? ValidateSetAssignments<Rest, Table, Schema>
          : true
        : Result
      : "SET column validation failed"
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
// FROM Clause Validation
// ============================================================================

/**
 * Validate FROM clause tables exist
 */
type ValidateFromClause<
  From,
  Schema extends DatabaseSchema,
> = From extends undefined
  ? true
  : From extends UpdateFromClause<infer Tables>
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
 * Build validation context from main table and FROM tables
 */
type BuildValidationContext<
  Table extends TableRef,
  From,
  Schema extends DatabaseSchema,
> = ResolveTableContext<Table, Schema> extends infer MainContext
  ? MainContext extends MatchError<string>
    ? MainContext
    : From extends UpdateFromClause<infer Tables>
      ? MergeFromContexts<MainContext, Tables, Schema>
      : MainContext
  : never

/**
 * Resolve table to context entry
 */
type ResolveTableContext<
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Table extends TableRef<infer TableName, infer Alias, infer TableSchema>
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
 * Merge FROM tables into context
 */
type MergeFromContexts<
  Context,
  Tables extends TableSource[],
  Schema extends DatabaseSchema,
> = Tables extends [infer First, ...infer Rest]
  ? First extends TableRef
    ? ResolveTableContext<First, Schema> extends infer TableContext
      ? TableContext extends MatchError<string>
        ? TableContext
        : Rest extends TableSource[]
          ? MergeFromContexts<Context & TableContext, Rest, Schema>
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
  Options extends ValidateUpdateOptions,
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
type ValidateSingleRef<
  Ref,
  Context,
  Schema extends DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
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
type ValidateUnboundColumn<
  Column extends string,
  Context,
> = ColumnExistsInContext<Column, Context, keyof Context>

/**
 * Check if column exists in any table in context
 */
type ColumnExistsInContext<
  Column extends string,
  Context,
  Keys,
> = [Keys] extends [never]
  ? `Column '${Column}' not found in any table`
  : Keys extends keyof Context
    ? Context[Keys] extends infer Table
      ? Column extends keyof Table
        ? true
        : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
      : ColumnExistsInContext<Column, Context, Exclude<keyof Context, Keys>>
    : `Column '${Column}' not found in any table`

// ============================================================================
// RETURNING Clause Validation (PostgreSQL 17+ OLD/NEW support)
// ============================================================================

/**
 * Validate RETURNING clause
 * Supports OLD/NEW qualified references for PostgreSQL 17+
 */
type ValidateReturningClause<
  Returning,
  Table extends TableRef,
  Schema extends DatabaseSchema,
  Options extends ValidateUpdateOptions,
> = Options["validateReturning"] extends false
  ? true
  : Returning extends undefined
    ? true
    : Returning extends ReturningClause<infer Cols>
      ? Cols extends "*"
        ? true
        : Cols extends ReturningItem[]
          ? ValidateReturningItems<Cols, Table, Schema>
          : true
      : true

/**
 * Validate RETURNING items (columns, OLD/NEW refs)
 */
type ValidateReturningItems<
  Items extends ReturningItem[],
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = Items extends [infer First, ...infer Rest]
  ? ValidateSingleReturningItem<First, Table, Schema> extends infer Result
    ? Result extends true
      ? Rest extends ReturningItem[]
        ? ValidateReturningItems<Rest, Table, Schema>
        : true
      : Result
    : "RETURNING item validation failed"
  : true

/**
 * Validate a single RETURNING item
 */
type ValidateSingleReturningItem<
  Item,
  Table extends TableRef,
  Schema extends DatabaseSchema,
> = 
  // OLD.* or NEW.* - always valid if table exists
  Item extends QualifiedWildcard
    ? true
  // OLD.column or NEW.column
  : Item extends QualifiedColumnRef<infer ColName, infer _Qualifier>
    ? ValidateColumnExists<ColName, Table, Schema>
  // Unqualified column
  : Item extends UnboundColumnRef<infer ColName>
    ? ValidateColumnExists<ColName, Table, Schema>
  : true

// ============================================================================
// Convenience Types
// ============================================================================

/**
 * Check if an UPDATE query is valid
 */
export type IsValidUpdate<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ValidateUpdateSQL<SQL, Schema> extends true ? true : false

/**
 * Get the table columns that would be affected by an UPDATE
 */
export type GetUpdateTableColumns<
  SQL extends string,
  Schema extends DatabaseSchema,
> = ParseUpdateSQL<SQL> extends SQLUpdateQuery<infer Query>
  ? Query extends UpdateClause<infer Table, infer _Set, infer _From, infer _Where, infer _Return>
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

