/**
 * AST type definitions specific to SQL UPDATE queries
 * 
 * This module contains AST nodes that are specific to UPDATE:
 * - UpdateClause - the main UPDATE statement
 * - SetClause - SET assignments
 * - FromClause for multi-table updates
 */

import type { Flatten } from "../common/utils.js"
import type {
  UnboundColumnRef,
  TableRef,
  TableSource,
  WhereExpr,
  JoinClause,
  CTEDefinition,
} from "../common/ast.js"

// ============================================================================
// SET Clause Types
// ============================================================================

/**
 * A single SET assignment value
 * Can be a literal, parameter placeholder, DEFAULT, NULL, or expression
 */
export type SetValue = 
  | { readonly type: "Literal"; readonly value: string | number | boolean | null }
  | { readonly type: "Default" }
  | { readonly type: "Null" }
  | { readonly type: "Param"; readonly name: string | number }
  | { readonly type: "Expression"; readonly expr: string }
  | { readonly type: "ColumnRef"; readonly column: string; readonly table?: string }

/**
 * A single SET assignment: column = value
 */
export type SetAssignment<
  Column extends string = string,
  Value extends SetValue = SetValue
> = {
  readonly type: "SetAssignment"
  readonly column: Column
  readonly value: Value
}

/**
 * SET clause containing one or more assignments
 */
export type SetClause<Assignments extends SetAssignment[] = SetAssignment[]> = {
  readonly type: "SetClause"
  readonly assignments: Assignments
}

// ============================================================================
// FROM Clause (PostgreSQL multi-table update with JOIN support)
// ============================================================================

/**
 * FROM clause for multi-table UPDATE
 * Supports: UPDATE t1 SET ... FROM t2 WHERE t1.id = t2.ref_id
 * Also supports JOINs: UPDATE t1 SET ... FROM t2 JOIN t3 ON t2.id = t3.t2_id WHERE ...
 */
export type UpdateFromClause<
  Tables extends TableSource[] = TableSource[],
  Joins extends JoinClause[] | undefined = JoinClause[] | undefined
> = {
  readonly type: "UpdateFromClause"
  readonly tables: Tables
  readonly joins: Joins
}

// ============================================================================
// RETURNING Clause (PostgreSQL 17+ OLD/NEW support)
// ============================================================================

/**
 * Reference qualifier for RETURNING columns
 * - "OLD" - returns the pre-update value
 * - "NEW" - returns the post-update value (default behavior)
 * - undefined - no qualifier (same as NEW for UPDATE)
 */
export type ReturningQualifier = "OLD" | "NEW" | undefined

/**
 * A column reference in RETURNING with optional OLD/NEW qualifier
 * PostgreSQL 17+ syntax: RETURNING OLD.column, NEW.column, OLD.*, NEW.*
 */
export type QualifiedColumnRef<
  Column extends string = string,
  Qualifier extends ReturningQualifier = ReturningQualifier
> = {
  readonly type: "QualifiedColumnRef"
  readonly column: Column
  readonly qualifier: Qualifier
}

/**
 * Wildcard reference with optional OLD/NEW qualifier
 * PostgreSQL 17+ syntax: RETURNING OLD.*, NEW.*
 */
export type QualifiedWildcard<
  Qualifier extends ReturningQualifier = ReturningQualifier
> = {
  readonly type: "QualifiedWildcard"
  readonly qualifier: Qualifier
}

/**
 * A RETURNING item can be:
 * - Unqualified column or wildcard (backwards compatible)
 * - OLD/NEW qualified column or wildcard (PostgreSQL 17+)
 */
export type ReturningItem = 
  | UnboundColumnRef
  | QualifiedColumnRef
  | QualifiedWildcard

/**
 * RETURNING clause for UPDATE
 * Can return *, specific columns, OLD/NEW qualified references
 */
export type ReturningClause<
  Columns extends "*" | ReturningItem[] = "*" | ReturningItem[]
> = {
  readonly type: "ReturningClause"
  readonly columns: Columns
}

// ============================================================================
// Update Clause
// ============================================================================

/**
 * The main UPDATE clause AST
 */
export type UpdateClause<
  Table extends TableRef = TableRef,
  Set extends SetClause = SetClause,
  From extends UpdateFromClause | undefined = UpdateFromClause | undefined,
  Where extends WhereExpr | undefined = WhereExpr | undefined,
  Returning extends ReturningClause | undefined = ReturningClause | undefined,
  CTEs extends CTEDefinition[] | undefined = CTEDefinition[] | undefined
> = Flatten<{
  readonly type: "UpdateClause"
  readonly table: Table
  readonly set: Set
  readonly from: From
  readonly where: Where
  readonly returning: Returning
  readonly ctes: CTEs
}>

// ============================================================================
// SQL Query Wrapper
// ============================================================================

/**
 * The top-level UPDATE SQL query AST
 */
export type SQLUpdateQuery<Query extends UpdateClause = UpdateClause> = {
  readonly type: "SQLQuery"
  readonly queryType: "UPDATE"
  readonly query: Query
}

