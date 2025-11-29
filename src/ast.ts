/**
 * AST type definitions for SQL SELECT queries
 */

import type { Flatten } from "./utils.js"

// ============================================================================
// Column References
// ============================================================================

/**
 * A column reference without a known table
 */
export type UnboundColumnRef<Column extends string = string> = {
  readonly type: "UnboundColumnRef"
  readonly column: Column
}

/**
 * A column reference with an identified table
 */
export type TableColumnRef<
  Table extends string = string,
  Column extends string = string,
> = {
  readonly type: "TableColumnRef"
  readonly table: Table
  readonly column: Column
}

/**
 * Column reference types that can be validated
 */
export type ValidatableColumnRef = UnboundColumnRef | TableColumnRef

/**
 * A wildcard selection for a specific table (table.* or alias.*)
 */
export type TableWildcard<TableOrAlias extends string = string> = {
  readonly type: "TableWildcard"
  readonly table: TableOrAlias
}

/**
 * Simple column reference types (without complex expressions to avoid circular reference)
 */
export type SimpleColumnRefType = UnboundColumnRef | TableColumnRef

/**
 * A complex expression (like JSON operations, function calls, etc.)
 * Contains all column references found in the expression for validation
 * and the result type from casting
 */
export type ComplexExpr<
  ColumnRefs extends ValidatableColumnRef[] = ValidatableColumnRef[],
  CastType extends string | undefined = string | undefined,
> = {
  readonly type: "ComplexExpr"
  readonly columnRefs: ColumnRefs
  readonly castType: CastType
}

/**
 * Union of column reference types
 * Note: SubqueryExpr is NOT included here to avoid circular references
 */
export type ColumnRefType = UnboundColumnRef | TableColumnRef | TableWildcard | ComplexExpr

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
// Table References
// ============================================================================

/**
 * A reference to a table
 */
export type TableRef<
  Table extends string = string,
  Alias extends string = Table,
> = {
  readonly type: "TableRef"
  readonly table: Table
  readonly alias: Alias
}

/**
 * A derived table (subquery in FROM clause)
 * The subquery's columns become the columns of this virtual table
 */
export type DerivedTableRef<
  Query extends SubquerySelectClause = SubquerySelectClause,
  Alias extends string = string,
> = {
  readonly type: "DerivedTableRef"
  readonly query: Query
  readonly alias: Alias
}

/**
 * A CTE (Common Table Expression) definition
 * WITH cte_name AS (SELECT ...)
 */
export type CTEDefinition<
  Name extends string = string,
  Query extends SubquerySelectClause = SubquerySelectClause,
> = {
  readonly type: "CTEDefinition"
  readonly name: Name
  readonly query: Query
}

/**
 * Union of all table source types
 * Can be a regular table, derived table (subquery), or CTE reference
 */
export type TableSource = TableRef | DerivedTableRef

// ============================================================================
// Expressions
// ============================================================================

/**
 * Binary comparison operators
 */
export type ComparisonOp = "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" | "LIKE" | "ILIKE" | "IN" | "NOT IN" | "IS" | "IS NOT"

/**
 * Logical operators
 */
export type LogicalOp = "AND" | "OR"

/**
 * A literal value (string, number, boolean, null)
 */
export type LiteralValue<V extends string | number | boolean | null = string | number | boolean | null> = {
  readonly type: "Literal"
  readonly value: V
}

/**
 * A binary comparison expression
 */
export type BinaryExpr<
  Left extends ColumnRefType | LiteralValue = ColumnRefType | LiteralValue,
  Op extends ComparisonOp = ComparisonOp,
  Right extends ColumnRefType | LiteralValue = ColumnRefType | LiteralValue,
> = {
  readonly type: "BinaryExpr"
  readonly left: Left
  readonly operator: Op
  readonly right: Right
}

/**
 * Marker for unparsed WHERE/ON expressions
 * Used to avoid deep recursion for expressions not needed for type inference
 */
export type UnparsedExpr = { readonly __unparsed: true }

/**
 * Any expression that can appear in a WHERE clause
 * Note: We use a simplified structure to avoid circular references
 */
export type WhereExpr = BinaryExpr | LogicalExprAny | UnparsedExpr

/**
 * A logical expression combining conditions
 * Uses WhereExprBase to avoid circular type reference
 */
export type LogicalExpr<
  Left extends BinaryExpr = BinaryExpr,
  Op extends LogicalOp = LogicalOp,
  Right extends BinaryExpr | LogicalExprAny = BinaryExpr | LogicalExprAny,
> = {
  readonly type: "LogicalExpr"
  readonly left: Left
  readonly operator: Op
  readonly right: Right
}

/**
 * Base logical expression type (to avoid circular reference)
 */
export type LogicalExprAny = {
  readonly type: "LogicalExpr"
  readonly left: BinaryExpr | LogicalExprAny
  readonly operator: LogicalOp
  readonly right: BinaryExpr | LogicalExprAny
}

// ============================================================================
// Join Clauses
// ============================================================================

/**
 * Join types
 */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS" | "LEFT OUTER" | "RIGHT OUTER" | "FULL OUTER"

/**
 * A JOIN clause
 */
export type JoinClause<
  Type extends JoinType = JoinType,
  Table extends TableSource = TableSource,
  On extends WhereExpr | undefined = WhereExpr | undefined,
> = {
  readonly type: "JoinClause"
  readonly joinType: Type
  readonly table: Table
  readonly on: On
}

// ============================================================================
// Order By
// ============================================================================

/**
 * Sort direction
 */
export type SortDirection = "ASC" | "DESC"

/**
 * An ORDER BY item
 */
export type OrderByItem<
  Column extends ColumnRefType = ColumnRefType,
  Direction extends SortDirection = SortDirection,
> = {
  readonly type: "OrderByItem"
  readonly column: Column
  readonly direction: Direction
}

// ============================================================================
// Aggregations
// ============================================================================

/**
 * Aggregate functions
 */
export type AggregateFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"

/**
 * An aggregate function call
 */
export type AggregateExpr<
  Func extends AggregateFunc = AggregateFunc,
  Arg extends ColumnRefType | "*" = ColumnRefType | "*",
  Alias extends string = string,
> = {
  readonly type: "AggregateExpr"
  readonly func: Func
  readonly argument: Arg
  readonly alias: Alias
}

// ============================================================================
// Select Clause
// ============================================================================

/**
 * A simplified select clause used inside SubqueryExpr to avoid circular references
 * This is essentially a "forward declaration" pattern - the actual structure
 * is checked at match time, not at AST definition time
 */
export type SubquerySelectClause = {
  readonly type: "SelectClause"
  readonly columns: unknown
  readonly from: TableSource
  readonly joins: unknown
  readonly where: unknown
  readonly groupBy: unknown
  readonly having: unknown
  readonly orderBy: unknown
  readonly limit: unknown
  readonly offset: unknown
  readonly distinct: boolean
  readonly ctes: unknown
}

/**
 * Selected columns can be column refs, aggregates, table wildcards, or *
 */
export type SelectItem = ColumnRef | AggregateExpr | TableWildcard

/**
 * Array of selected columns
 */
export type SelectColumns = SelectItem[]

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
// SQL Query Wrapper
// ============================================================================

/**
 * The top-level SQL query AST
 */
export type SQLQuery<Query extends SelectClause = SelectClause> = {
  readonly type: "SQLQuery"
  readonly query: Query
}

