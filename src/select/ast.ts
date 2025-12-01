/**
 * AST type definitions specific to SQL SELECT queries
 * 
 * This module contains AST nodes that are specific to SELECT:
 * - SelectClause - the main SELECT statement
 * - UnionClause - UNION/INTERSECT/EXCEPT operations
 * - SubqueryExpr - scalar subqueries in SELECT columns
 */

import type { Flatten } from "../common/utils.js"
import type {
  ColumnRefType,
  ValidatableColumnRef,
  TableWildcard,
  TableSource,
  CTEDefinition,
  JoinClause,
  WhereExpr,
  OrderByItem,
  AggregateExpr,
  SubquerySelectClause,
} from "../common/ast.js"

// ============================================================================
// Subquery Expression (SELECT-specific)
// ============================================================================

/**
 * A scalar subquery expression used as a column value
 * Uses SubquerySelectClause to avoid circular dependency with SelectClause
 * The result type is the type of the first (and typically only) selected column
 */
export type SubqueryExpr<
  Query extends SubquerySelectClause = SubquerySelectClause,
  CastType extends string | undefined = string | undefined,
> = {
  readonly type: "SubqueryExpr"
  readonly query: Query
  readonly castType: CastType
}

/**
 * Extended column reference type that includes subqueries
 * Used only in parser output for SELECT columns
 */
export type ExtendedColumnRefType = ColumnRefType | SubqueryExpr

/**
 * A column reference with optional alias
 * Uses ExtendedColumnRefType to allow subqueries in SELECT columns
 */
export type ColumnRef<
  Ref extends ExtendedColumnRefType = ExtendedColumnRefType,
  Alias extends string = string,
> = {
  readonly type: "ColumnRef"
  readonly reference: Ref
  readonly alias: Alias
}

// ============================================================================
// Select Items
// ============================================================================

/**
 * Selected columns can be column refs, aggregates, table wildcards, or *
 */
export type SelectItem = ColumnRef | AggregateExpr | TableWildcard

/**
 * Array of selected columns
 */
export type SelectColumns = SelectItem[]

// ============================================================================
// Select Clause
// ============================================================================

/**
 * The main SELECT clause AST
 */
export type SelectClause<
  Columns extends SelectColumns | "*" = SelectColumns | "*",
  From extends TableSource = TableSource,
  Joins extends JoinClause[] | undefined = JoinClause[] | undefined,
  Where extends WhereExpr | undefined = WhereExpr | undefined,
  GroupBy extends ColumnRefType[] | undefined = ColumnRefType[] | undefined,
  Having extends WhereExpr | undefined = WhereExpr | undefined,
  OrderBy extends OrderByItem[] | undefined = OrderByItem[] | undefined,
  Limit extends number | undefined = number | undefined,
  Offset extends number | undefined = number | undefined,
  Distinct extends boolean = boolean,
  CTEs extends CTEDefinition[] | undefined = CTEDefinition[] | undefined,
> = Flatten<{
  readonly type: "SelectClause"
  readonly columns: Columns
  readonly from: From
  readonly joins: Joins
  readonly where: Where
  readonly groupBy: GroupBy
  readonly having: Having
  readonly orderBy: OrderBy
  readonly limit: Limit
  readonly offset: Offset
  readonly distinct: Distinct
  readonly ctes: CTEs
}>

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union operator types
 */
export type UnionOperatorType = "UNION" | "UNION ALL" | "INTERSECT" | "INTERSECT ALL" | "EXCEPT" | "EXCEPT ALL"

/**
 * Base union clause type (to avoid circular reference)
 */
export type UnionClauseAny = {
  readonly type: "UnionClause"
  readonly left: SelectClause
  readonly operator: UnionOperatorType
  readonly right: SelectClause | UnionClauseAny
}

/**
 * A union clause combining two queries
 * The left side is always a SelectClause, the right side can be another SelectClause or another UnionClause
 */
export type UnionClause<
  Left extends SelectClause = SelectClause,
  Op extends UnionOperatorType = UnionOperatorType,
  Right extends SelectClause | UnionClauseAny = SelectClause | UnionClauseAny,
> = {
  readonly type: "UnionClause"
  readonly left: Left
  readonly operator: Op
  readonly right: Right
}

// ============================================================================
// SQL Query Wrapper
// ============================================================================

/**
 * The top-level SELECT SQL query AST
 * Can be either a single SelectClause or a UnionClause
 */
export type SQLSelectQuery<Query extends SelectClause | UnionClauseAny = SelectClause | UnionClauseAny> = {
  readonly type: "SQLQuery"
  readonly queryType: "SELECT"
  readonly query: Query
}

/**
 * Legacy wrapper type for backward compatibility
 * @deprecated Use SQLSelectQuery instead
 */
export type SQLQuery<Query extends SelectClause | UnionClauseAny = SelectClause | UnionClauseAny> = SQLSelectQuery<Query>

