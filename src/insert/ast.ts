/**
 * AST type definitions specific to SQL INSERT queries
 *
 * This module contains AST nodes that are specific to INSERT:
 * - InsertClause - the main INSERT statement
 * - InsertColumns - columns to insert into
 * - InsertValues - values to insert (VALUES or SELECT)
 */

import type { Flatten } from "../common/utils.js"
import type {
  UnboundColumnRef,
  TableRef,
  SubquerySelectClause,
  WhereExpr,
} from "../common/ast.js"

// ============================================================================
// Insert Values Types
// ============================================================================

/**
 * A single value in an INSERT VALUES clause
 * Can be a literal, parameter placeholder, DEFAULT, or expression
 */
export type InsertValue =
  | { readonly type: "Literal"; readonly value: string | number | boolean | null }
  | { readonly type: "Default" }
  | { readonly type: "Param"; readonly name: string | number }
  | { readonly type: "Expression"; readonly expr: string }

/**
 * A row of values in VALUES clause
 */
export type InsertValueRow<Values extends InsertValue[] = InsertValue[]> = {
  readonly type: "InsertValueRow"
  readonly values: Values
}

/**
 * VALUES clause with one or more rows
 */
export type InsertValuesClause<Rows extends InsertValueRow[] = InsertValueRow[]> = {
  readonly type: "InsertValuesClause"
  readonly rows: Rows
}

/**
 * SELECT as the source for INSERT
 */
export type InsertSelectClause<Query extends SubquerySelectClause = SubquerySelectClause> = {
  readonly type: "InsertSelectClause"
  readonly query: Query
}

/**
 * Union of insert source types
 */
export type InsertSource = InsertValuesClause | InsertSelectClause

// ============================================================================
// Column Reference for INSERT
// ============================================================================

/**
 * Column name in INSERT column list (always unqualified)
 */
export type InsertColumnRef<Column extends string = string> = {
  readonly type: "InsertColumnRef"
  readonly column: Column
}

/**
 * List of columns in INSERT
 */
export type InsertColumnList<Columns extends InsertColumnRef[] = InsertColumnRef[]> = {
  readonly type: "InsertColumnList"
  readonly columns: Columns
}

// ============================================================================
// RETURNING Clause
// ============================================================================

/**
 * RETURNING clause for INSERT
 * Can return *, specific columns, or expressions
 */
export type ReturningClause<
  Columns extends "*" | UnboundColumnRef[] = "*" | UnboundColumnRef[],
> = {
  readonly type: "ReturningClause"
  readonly columns: Columns
}

// ============================================================================
// ON CONFLICT Clause
// ============================================================================

/**
 * ON CONFLICT target - columns or constraint
 */
export type ConflictTarget<
  Columns extends string[] | undefined = string[] | undefined,
  Constraint extends string | undefined = string | undefined,
> = {
  readonly type: "ConflictTarget"
  readonly columns: Columns
  readonly constraint: Constraint
}

/**
 * ON CONFLICT action
 */
export type ConflictAction = "DO NOTHING" | "DO UPDATE"

/**
 * SET clause for ON CONFLICT DO UPDATE
 */
export type ConflictUpdateSet<
  Column extends string = string,
  Value extends InsertValue | "EXCLUDED" = InsertValue | "EXCLUDED",
> = {
  readonly type: "ConflictUpdateSet"
  readonly column: Column
  readonly value: Value
}

/**
 * ON CONFLICT clause
 */
export type OnConflictClause<
  Target extends ConflictTarget | undefined = ConflictTarget | undefined,
  Action extends ConflictAction = ConflictAction,
  Updates extends ConflictUpdateSet[] | undefined = ConflictUpdateSet[] | undefined,
  Where extends WhereExpr | undefined = WhereExpr | undefined,
> = {
  readonly type: "OnConflictClause"
  readonly target: Target
  readonly action: Action
  readonly updates: Updates
  readonly where: Where
}

// ============================================================================
// Insert Clause
// ============================================================================

/**
 * The main INSERT clause AST
 */
export type InsertClause<
  Table extends TableRef = TableRef,
  Columns extends InsertColumnList | undefined = InsertColumnList | undefined,
  Source extends InsertSource = InsertSource,
  OnConflict extends OnConflictClause | undefined = OnConflictClause | undefined,
  Returning extends ReturningClause | undefined = ReturningClause | undefined,
> = Flatten<{
  readonly type: "InsertClause"
  readonly table: Table
  readonly columns: Columns
  readonly source: Source
  readonly onConflict: OnConflict
  readonly returning: Returning
}>

// ============================================================================
// SQL Query Wrapper
// ============================================================================

/**
 * The top-level INSERT SQL query AST
 */
export type SQLInsertQuery<Query extends InsertClause = InsertClause> = {
  readonly type: "SQLQuery"
  readonly queryType: "INSERT"
  readonly query: Query
}

