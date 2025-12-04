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
  LiteralValue,
} from "../common/ast.js"

// ============================================================================
// Literal Expression (SELECT-specific)
// ============================================================================

/**
 * A literal value expression used directly in SELECT columns
 * Examples: SELECT 1 AS num, SELECT 'hello' AS str, SELECT NULL AS nothing
 */
export type LiteralExpr<
  Value extends string | number | boolean | null = string | number | boolean | null,
> = {
  readonly type: "LiteralExpr"
  readonly value: Value
}

// ============================================================================
// SQL Constants (SELECT-specific)
// ============================================================================

/**
 * SQL constant names that can be used without parentheses
 * These are database constants that return typed values
 */
export type SQLConstantName =
  // Date/Time constants (PostgreSQL & MySQL)
  | "CURRENT_DATE"
  | "CURRENT_TIME"
  | "CURRENT_TIMESTAMP"
  | "LOCALTIME"
  | "LOCALTIMESTAMP"
  // User/Session constants
  | "CURRENT_USER"
  | "SESSION_USER"
  | "CURRENT_CATALOG"
  | "CURRENT_SCHEMA"
  // Transaction constants (PostgreSQL)
  | "CURRENT_ROLE"

/**
 * A SQL constant expression (like CURRENT_DATE, CURRENT_TIMESTAMP)
 * These are special SQL keywords that return typed values without requiring function call syntax
 */
export type SQLConstantExpr<
  Name extends SQLConstantName = SQLConstantName,
> = {
  readonly type: "SQLConstantExpr"
  readonly name: Name
}

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
 * An EXISTS or NOT EXISTS expression with a subquery
 * Always evaluates to boolean - true if subquery returns any rows (or false for NOT EXISTS)
 */
export type ExistsExpr<
  Query extends SubquerySelectClause = SubquerySelectClause,
  Negated extends boolean = boolean,
> = {
  readonly type: "ExistsExpr"
  readonly query: Query
  readonly negated: Negated
}

/**
 * A PostgreSQL INTERVAL expression
 * Examples: INTERVAL '1 day', INTERVAL '2 hours', INTERVAL '1' HOUR
 * The result type is always string (interval values are represented as strings in JS)
 */
export type IntervalExpr<
  Value extends string = string,
> = {
  readonly type: "IntervalExpr"
  readonly value: Value
}

/**
 * Extended column reference type that includes subqueries, literals, SQL constants, EXISTS, and INTERVAL expressions
 * Used only in parser output for SELECT columns
 */
export type ExtendedColumnRefType = ColumnRefType | SubqueryExpr | LiteralExpr | SQLConstantExpr | ExistsExpr | IntervalExpr

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

