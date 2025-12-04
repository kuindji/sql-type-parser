/**
 * Common AST type definitions shared across all SQL query types
 * 
 * This module contains AST nodes that are used by multiple query types:
 * - Column references (used in SELECT, WHERE, UPDATE SET, etc.)
 * - Table references (used in FROM, UPDATE, DELETE, etc.)
 * - Expressions (used in WHERE, HAVING, ON, etc.)
 * - Join clauses (used in SELECT, UPDATE, DELETE)
 */

import type { Flatten } from "./utils.js"

// ============================================================================
// Query Types
// ============================================================================

/**
 * Discriminator for different SQL query types
 */
export type QueryType = "SELECT" | "INSERT" | "UPDATE" | "DELETE"

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
 * A column reference with an identified table and optional schema
 */
export type TableColumnRef<
  Table extends string = string,
  Column extends string = string,
  Schema extends string | undefined = string | undefined,
> = {
  readonly type: "TableColumnRef"
  readonly schema: Schema
  readonly table: Table
  readonly column: Column
}

/**
 * Column reference types that can be validated
 */
export type ValidatableColumnRef = UnboundColumnRef | TableColumnRef

/**
 * A wildcard selection for a specific table (table.* or alias.* or schema.table.*)
 */
export type TableWildcard<
  TableOrAlias extends string = string,
  Schema extends string | undefined = string | undefined,
> = {
  readonly type: "TableWildcard"
  readonly schema: Schema
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
 * Union of basic column reference types
 * Note: SubqueryExpr is NOT included here to avoid circular references
 */
export type ColumnRefType = UnboundColumnRef | TableColumnRef | TableWildcard | ComplexExpr

// ============================================================================
// Table References
// ============================================================================

/**
 * A reference to a table with optional schema
 */
export type TableRef<
  Table extends string = string,
  Alias extends string = Table,
  Schema extends string | undefined = string | undefined,
> = {
  readonly type: "TableRef"
  readonly schema: Schema
  readonly table: Table
  readonly alias: Alias
}

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
 * A parsed condition that stores extracted column references
 * Used for validating field references in WHERE, JOIN ON, HAVING clauses
 * without fully parsing the expression structure
 */
export type ParsedCondition<
  ColumnRefs extends ValidatableColumnRef[] = ValidatableColumnRef[],
> = {
  readonly type: "ParsedCondition"
  readonly columnRefs: ColumnRefs
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

/**
 * Any expression that can appear in a WHERE clause
 * Note: We use a simplified structure to avoid circular references
 */
export type WhereExpr = BinaryExpr | LogicalExprAny | UnparsedExpr | ParsedCondition

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
// Common SQL Type Mapping
// ============================================================================

/**
 * Map SQL type names to TypeScript types
 */
export type MapSQLTypeToTS<T extends string> =
  T extends "text" | "varchar" | "char" | "character varying" | "character" ? string :
  T extends "int" | "integer" | "int4" | "int8" | "bigint" | "smallint" | "serial" | "bigserial" ? number :
  T extends "float" | "float4" | "float8" | "real" | "double precision" | "numeric" | "decimal" ? number :
  T extends "bool" | "boolean" ? boolean :
  T extends "json" | "jsonb" ? object :
  T extends "date" | "timestamp" | "timestamptz" | "time" | "timetz" ? string :
  T extends "interval" ? string :
  T extends "uuid" ? string :
  T extends "bytea" ? Uint8Array :
  unknown

