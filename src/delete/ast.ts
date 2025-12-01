/**
 * AST type definitions specific to SQL DELETE queries
 * 
 * This module contains AST nodes that are specific to DELETE:
 * - DeleteClause - the main DELETE statement
 * - Using clause for multi-table deletes
 */

import type { Flatten } from "../common/utils.js"
import type {
  UnboundColumnRef,
  TableRef,
  TableSource,
  WhereExpr,
  JoinClause,
} from "../common/ast.js"

// ============================================================================
// RETURNING Clause
// ============================================================================

/**
 * RETURNING clause for DELETE
 * Can return *, specific columns, or expressions
 */
export type ReturningClause<
  Columns extends "*" | UnboundColumnRef[] = "*" | UnboundColumnRef[]
> = {
  readonly type: "ReturningClause"
  readonly columns: Columns
}

// ============================================================================
// USING Clause (PostgreSQL multi-table delete)
// ============================================================================

/**
 * USING clause for multi-table DELETE
 * DELETE FROM t1 USING t2 WHERE t1.id = t2.ref_id
 */
export type UsingClause<Tables extends TableSource[] = TableSource[]> = {
  readonly type: "UsingClause"
  readonly tables: Tables
}

// ============================================================================
// Delete Clause
// ============================================================================

/**
 * The main DELETE clause AST
 */
export type DeleteClause<
  Table extends TableRef = TableRef,
  Using extends UsingClause | undefined = UsingClause | undefined,
  Where extends WhereExpr | undefined = WhereExpr | undefined,
  Returning extends ReturningClause | undefined = ReturningClause | undefined
> = Flatten<{
  readonly type: "DeleteClause"
  readonly table: Table
  readonly using: Using
  readonly where: Where
  readonly returning: Returning
}>

// ============================================================================
// SQL Query Wrapper
// ============================================================================

/**
 * The top-level DELETE SQL query AST
 */
export type SQLDeleteQuery<Query extends DeleteClause = DeleteClause> = {
  readonly type: "SQLQuery"
  readonly queryType: "DELETE"
  readonly query: Query
}

