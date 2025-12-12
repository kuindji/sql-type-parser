/**
 * Column Validation
 *
 * Types for validating column references in SELECT queries.
 */

import type { ColumnRef, SelectItem, SubqueryExpr } from "../ast.js";

import type {
    AggregateExpr,
    ComplexExpr,
    SubquerySelectClause,
    TableColumnRef,
    TableSource,
    TableWildcard,
    UnboundColumnRef,
    ValidatableColumnRef,
} from "../../common/ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type { MatchError } from "../../common/utils.js";
import type { BuildTableContext } from "./context.js";

// ============================================================================
// Column Validation
// ============================================================================

/**
 * Validate all selected columns
 */
export type ValidateColumns<
    Columns,
    Context,
    Schema extends DatabaseSchema,
> = Columns extends "*" ? true
    : Columns extends SelectItem[]
        ? ValidateColumnList<Columns, Context, Schema>
    : "Invalid columns type";

/**
 * Validate a list of columns
 */
export type ValidateColumnList<
    Columns extends SelectItem[],
    Context,
    Schema extends DatabaseSchema,
> = Columns extends [ infer First, ...infer Rest ]
    ? ValidateSingleColumn<First, Context, Schema> extends infer FirstResult
        ? FirstResult extends true
            ? Rest extends SelectItem[]
                ? ValidateColumnList<Rest, Context, Schema>
            : true
        : FirstResult
    : "Column validation failed"
    : true;

/**
 * Validate a single column
 */
export type ValidateSingleColumn<
    Col,
    Context,
    Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer _Alias>
    ? ValidateColumnRef<Ref, Context, Schema>
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
        ? ValidateTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : Col extends AggregateExpr<infer _Func, infer Arg, infer _Alias>
        ? ValidateAggregateArg<Arg, Context, Schema>
    : true;

/**
 * Validate a column reference
 */
export type ValidateColumnRef<
    Ref,
    Context,
    Schema extends DatabaseSchema,
> = Ref extends SubqueryExpr<infer Query, infer _CastType>
    ? ValidateSubquery<Query, Context, Schema>
    : Ref extends ComplexExpr<infer ColumnRefs, infer _CastType>
        ? ValidateComplexExprRefs<ColumnRefs, Context, Schema>
    : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
        ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
        ? ValidateUnboundColumn<Column, Context>
    : true;

/**
 * Validate a subquery
 */
export type ValidateSubquery<
    Query extends SubquerySelectClause,
    OuterContext,
    Schema extends DatabaseSchema,
> = Query extends
    {
        columns: infer _Columns;
        from: infer From extends TableSource;
        joins: infer Joins;
    }
    ? BuildTableContext<From, Joins, Schema, {}> extends infer InnerContext
        ? InnerContext extends MatchError<infer E> ? E
        : true // Subquery structure is valid
    : true
    : true;

/**
 * Validate column refs in a complex expression
 */
export type ValidateComplexExprRefs<
    ColumnRefs,
    Context,
    Schema extends DatabaseSchema,
> = ColumnRefs extends [] ? true
    : ColumnRefs extends [ infer First, ...infer Rest ]
        ? ValidateSingleRef<First, Context, Schema> extends infer FirstResult
            ? FirstResult extends true
                ? ValidateComplexExprRefs<Rest, Context, Schema>
            : FirstResult
        : true
    : true;

/**
 * Validate a single ref in complex expr
 */
export type ValidateSingleRef<
    Ref,
    Context,
    Schema extends DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
    ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
        ? ValidateUnboundColumn<Column, Context>
    : true;

/**
 * Validate a table-qualified column exists
 */
export type ValidateTableColumn<
    TableOrAlias extends string,
    Column extends string,
    ColSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema,
> = ColSchema extends undefined
    ? TableOrAlias extends keyof Context
        ? Context[TableOrAlias] extends infer Table
            ? Column extends keyof Table ? true
            : `Column '${Column}' not found in '${TableOrAlias}'`
        : never
    : `Table or alias '${TableOrAlias}' not found`
    : ColSchema extends string
        ? ColSchema extends keyof Schema["schemas"]
            ? TableOrAlias extends keyof Schema["schemas"][ColSchema]
                ? Column extends
                    keyof Schema["schemas"][ColSchema][TableOrAlias] ? true
                : `Column '${Column}' not found in '${ColSchema}.${TableOrAlias}'`
            : `Table '${TableOrAlias}' not found in schema '${ColSchema}'`
        : `Schema '${ColSchema}' not found`
    : `Invalid schema type`;

/**
 * Validate an unbound column exists in some table
 */
export type ValidateUnboundColumn<
    Column extends string,
    Context,
> = ColumnExistsInContext<Column, Context>;

/**
 * Check if column exists in any table in context
 * Uses mapped type to avoid distributive conditional infinite recursion
 */
export type ColumnExistsInContext<
    Column extends string,
    Context,
    _Keys = keyof Context, // Kept for backwards compatibility, not used
> = true extends {
    [K in keyof Context]: Column extends keyof Context[K] ? true : never;
}[keyof Context] ? true
    : `Column '${Column}' not found in any table`;

/**
 * Validate table wildcard
 */
export type ValidateTableWildcard<
    TableOrAlias extends string,
    WildcardSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema,
> = WildcardSchema extends undefined ? TableOrAlias extends keyof Context ? true
    : `Table or alias '${TableOrAlias}' not found`
    : WildcardSchema extends string
        ? WildcardSchema extends keyof Schema["schemas"]
            ? TableOrAlias extends keyof Schema["schemas"][WildcardSchema]
                ? true
            : `Table '${TableOrAlias}' not found in schema '${WildcardSchema}'`
        : `Schema '${WildcardSchema}' not found`
    : `Invalid schema type`;

/**
 * Validate aggregate function argument
 */
export type ValidateAggregateArg<
    Arg,
    Context,
    Schema extends DatabaseSchema,
> = Arg extends "*" ? true
    : Arg extends TableColumnRef<infer Table, infer Column, infer ColSchema>
        ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Arg extends UnboundColumnRef<infer Column>
        ? ValidateUnboundColumn<Column, Context>
    : true;
