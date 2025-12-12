/**
 * Clause Validators
 *
 * Types for validating WHERE, JOIN, GROUP BY, HAVING, and ORDER BY clauses.
 */

import type {
    ColumnRefType,
    ComplexExpr,
    JoinClause,
    OrderByItem,
    ParsedCondition,
    TableColumnRef,
    UnboundColumnRef,
    ValidatableColumnRef,
} from "../../common/ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type {
    ValidateSingleRef,
    ValidateTableColumn,
    ValidateUnboundColumn,
} from "./column-validators.js";

// ============================================================================
// WHERE Clause Validation
// ============================================================================

/**
 * Validate WHERE clause column references
 */
export type ValidateWhereClause<
    Where,
    Context,
    Schema extends DatabaseSchema,
> = Where extends undefined ? true
    : Where extends ParsedCondition<infer ColumnRefs>
        ? ValidateColumnRefList<ColumnRefs, Context, Schema>
    : true; // For other WhereExpr types, skip (backwards compatibility)

// ============================================================================
// HAVING Clause Validation
// ============================================================================

/**
 * Validate HAVING clause column references
 */
export type ValidateHavingClause<
    Having,
    Context,
    Schema extends DatabaseSchema,
> = Having extends undefined ? true
    : Having extends ParsedCondition<infer ColumnRefs>
        ? ValidateColumnRefList<ColumnRefs, Context, Schema>
    : true; // For other WhereExpr types, skip

// ============================================================================
// GROUP BY Clause Validation
// ============================================================================

/**
 * Validate GROUP BY clause column references
 */
export type ValidateGroupByClause<
    GroupBy,
    Context,
    Schema extends DatabaseSchema,
> = GroupBy extends undefined ? true
    : GroupBy extends ColumnRefType[]
        ? ValidateColumnRefTypeList<GroupBy, Context, Schema>
    : true;

// ============================================================================
// ORDER BY Clause Validation
// ============================================================================

/**
 * Validate ORDER BY clause column references
 */
export type ValidateOrderByClause<
    OrderBy,
    Context,
    Schema extends DatabaseSchema,
> = OrderBy extends undefined ? true
    : OrderBy extends OrderByItem[]
        ? ValidateOrderByItems<OrderBy, Context, Schema>
    : true;

/**
 * Validate ORDER BY items
 */
export type ValidateOrderByItems<
    Items extends OrderByItem[],
    Context,
    Schema extends DatabaseSchema,
> = Items extends [ infer First, ...infer Rest ]
    ? First extends OrderByItem<infer Col, infer _Dir>
        ? ValidateColumnRefType<Col, Context, Schema> extends infer Result
            ? Result extends true
                ? Rest extends OrderByItem[]
                    ? ValidateOrderByItems<Rest, Context, Schema>
                : true
            : Result
        : "ORDER BY validation failed"
    : true
    : true;

// ============================================================================
// JOIN Condition Validation
// ============================================================================

/**
 * Validate JOIN conditions
 */
export type ValidateJoinConditions<
    Joins,
    Context,
    Schema extends DatabaseSchema,
> = Joins extends undefined ? true
    : Joins extends JoinClause[] ? ValidateJoinList<Joins, Context, Schema>
    : true;

/**
 * Validate a list of JOINs
 */
export type ValidateJoinList<
    Joins extends JoinClause[],
    Context,
    Schema extends DatabaseSchema,
> = Joins extends [ infer First, ...infer Rest ]
    ? First extends JoinClause<infer _Type, infer _Table, infer On>
        ? ValidateJoinOn<On, Context, Schema> extends infer Result
            ? Result extends true
                ? Rest extends JoinClause[]
                    ? ValidateJoinList<Rest, Context, Schema>
                : true
            : Result
        : "JOIN validation failed"
    : true
    : true;

/**
 * Validate a single JOIN ON condition
 */
export type ValidateJoinOn<
    On,
    Context,
    Schema extends DatabaseSchema,
> = On extends undefined ? true
    : On extends ParsedCondition<infer ColumnRefs>
        ? ValidateColumnRefList<ColumnRefs, Context, Schema>
    : true; // For UnparsedExpr or other types, skip

// ============================================================================
// Column Reference List Validation
// ============================================================================

/**
 * Validate a list of ValidatableColumnRef
 */
export type ValidateColumnRefList<
    Refs extends ValidatableColumnRef[],
    Context,
    Schema extends DatabaseSchema,
> = Refs extends [ infer First, ...infer Rest ]
    ? ValidateSingleRef<First, Context, Schema> extends infer Result
        ? Result extends true
            ? Rest extends ValidatableColumnRef[]
                ? ValidateColumnRefList<Rest, Context, Schema>
            : true
        : Result
    : "Validation failed"
    : true;

/**
 * Validate a list of ColumnRefType
 */
export type ValidateColumnRefTypeList<
    Refs extends ColumnRefType[],
    Context,
    Schema extends DatabaseSchema,
> = Refs extends [ infer First, ...infer Rest ]
    ? ValidateColumnRefType<First, Context, Schema> extends infer Result
        ? Result extends true
            ? Rest extends ColumnRefType[]
                ? ValidateColumnRefTypeList<Rest, Context, Schema>
            : true
        : Result
    : "Validation failed"
    : true;

/**
 * Validate a single ColumnRefType
 */
export type ValidateColumnRefType<
    Ref,
    Context,
    Schema extends DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
    ? ValidateTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
        ? ValidateUnboundColumn<Column, Context>
    : Ref extends ComplexExpr<infer ColumnRefs, infer _CastType>
        ? ValidateColumnRefList<ColumnRefs, Context, Schema>
    : true; // TableWildcard and others are valid
