/**
 * Column reference resolution types
 *
 * Resolves column references (table.column, alias.column, unbound columns)
 * to their TypeScript types by looking them up in the table context or schema.
 */

import type {
    ExistsExpr,
    IntervalExpr,
    LiteralExpr,
    SQLConstantExpr,
    SQLConstantName,
    SubqueryExpr,
} from "../ast.js";

import type {
    AggregateExpr,
    ComplexExpr,
    JoinClause,
    MapSQLTypeToTS,
    SubquerySelectClause,
    TableColumnRef,
    TableSource,
    UnboundColumnRef,
    ValidatableColumnRef,
} from "../../common/ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type { Flatten, MatchError } from "../../common/utils.js";

import type { ColumnRef } from "../ast.js";

// Forward import for circular dependency - TypeScript handles type-only circular imports
import type { GetAggregateResultType } from "./aggregates.js";
import type {
    FlattenContext,
    MergeJoinContexts,
    ResolveTableSource,
} from "./context.js";

// ============================================================================
// Column Reference Resolution
// ============================================================================

/**
 * Resolve a column reference to its type
 */
export type ResolveColumnRef<
    Ref,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = Ref extends LiteralExpr<infer Value> ? ResolveLiteralExpr<Value>
    : Ref extends SQLConstantExpr<infer Name> ? ResolveSQLConstant<Name>
    : Ref extends SubqueryExpr<infer Query, infer CastType>
        ? ResolveSubqueryExpr<Query, CastType, Context, Schema>
    : Ref extends ExistsExpr<infer _Query, infer _Negated> ? boolean // EXISTS and NOT EXISTS always return boolean
    : Ref extends IntervalExpr<infer _Value> ? string // INTERVAL expressions return string (interval values are strings in JS)
    : Ref extends ComplexExpr<infer ColumnRefs, infer CastType>
        ? ResolveComplexExpr<ColumnRefs, CastType, Context, Schema>
    : Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
        ? ResolveTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<infer Column>
        ? ResolveUnboundColumn<Column, Context>
    : MatchError<"Invalid column reference">;

/**
 * Resolve a literal expression to its TypeScript type
 * The literal value is directly used as the type
 */
export type ResolveLiteralExpr<Value> = Value extends null ? null
    : Value extends boolean ? Value
    : Value extends number ? Value
    : Value extends string ? Value
    : unknown;

/**
 * Resolve a SQL constant to its TypeScript type
 * Maps SQL constants like CURRENT_DATE to their expected return types
 */
export type ResolveSQLConstant<Name extends SQLConstantName> =
    // Date/Time constants
    Name extends "CURRENT_DATE" ? string // DATE type maps to string
        : Name extends "CURRENT_TIME" ? string // TIME type maps to string
        : Name extends "CURRENT_TIMESTAMP" ? string // TIMESTAMP type maps to string
        : Name extends "LOCALTIME" ? string // TIME type maps to string
        : Name extends "LOCALTIMESTAMP" ? string // TIMESTAMP type maps to string
        // User/Session constants
        : Name extends "CURRENT_USER" ? string
        : Name extends "SESSION_USER" ? string
        : Name extends "CURRENT_CATALOG" ? string
        : Name extends "CURRENT_SCHEMA" ? string
        : Name extends "CURRENT_ROLE" ? string
        : unknown;

/**
 * Resolve a complex expression
 * Validates all column references exist, then returns the cast type or unknown
 * Note: We use [CastType] extends [undefined] to properly check for undefined,
 * because `undefined extends string` can be true in TypeScript when inferred from constraints
 */
export type ResolveComplexExpr<
    ColumnRefs,
    CastType,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = ValidateAllColumnRefs<ColumnRefs, Context, Schema> extends
    infer ValidationResult
    ? ValidationResult extends MatchError<string> ? ValidationResult
    : [ CastType ] extends [ undefined ] ? unknown
    : CastType extends string ? MapSQLTypeToTS<CastType>
    : unknown
    : never;

// ============================================================================
// Table Column Resolution
// ============================================================================

/**
 * Resolve a table-qualified column (table.column, alias.column, or schema.table.column)
 * ColSchema is the schema from the query (undefined if not specified)
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
export type ResolveTableColumn<
    TableOrAlias extends string,
    Column extends string,
    ColSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = ColSchema extends undefined
    // No schema specified - use context (which already has resolved aliases)
    ? TableOrAlias extends keyof Context
        ? Context[TableOrAlias] extends infer Table
            ? Column extends keyof Table ? Table[Column]
            : MatchError<`Column '${Column}' not found in '${TableOrAlias}'`>
        : never
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
    // Schema-qualified: schema.table.column - look up directly in schema
    : ColSchema extends string
        ? ResolveSchemaTableColumn<ColSchema, TableOrAlias, Column, Schema>
    : MatchError<`Invalid schema type`>;

/**
 * Resolve a fully qualified schema.table.column reference directly from schema
 */
export type ResolveSchemaTableColumn<
    SchemaName extends string,
    TableName extends string,
    ColumnName extends string,
    Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
    ? TableName extends keyof Schema["schemas"][SchemaName]
        ? ColumnName extends keyof Schema["schemas"][SchemaName][TableName]
            ? Schema["schemas"][SchemaName][TableName][ColumnName]
        : MatchError<
            `Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`
        >
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
    : MatchError<`Schema '${SchemaName}' not found`>;

/**
 * Resolve an unbound column by searching all tables in context
 */
export type ResolveUnboundColumn<
    Column extends string,
    Context,
> = FindColumnInContext<Column, Context>;

/**
 * Search for a column across all tables in context
 * Uses mapped type to avoid distributive conditional infinite recursion
 */
export type FindColumnInContext<
    Column extends string,
    Context,
    _Keys = keyof Context, // Kept for backwards compatibility, not used
> = {
    [K in keyof Context]: Column extends keyof Context[K] ? Context[K][Column]
        : never;
}[keyof Context] extends infer Result
    ? [ Result ] extends [ never ]
        ? MatchError<`Column '${Column}' not found in any table`>
    : Result
    : never;

// ============================================================================
// Wildcard Resolution
// ============================================================================

/**
 * Resolve a table.* or alias.* or schema.table.* wildcard to all columns from that table
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
export type ResolveTableWildcard<
    TableOrAlias extends string,
    WildcardSchema extends string | undefined,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = WildcardSchema extends undefined
    // No schema specified - use context
    ? TableOrAlias extends "*" ? ExpandAllColumns<Context>
    : TableOrAlias extends keyof Context ? Context[TableOrAlias]
    : MatchError<`Table or alias '${TableOrAlias}' not found`>
    // Schema-qualified: schema.table.* - look up directly in schema
    : WildcardSchema extends string
        ? ResolveSchemaTableWildcard<WildcardSchema, TableOrAlias, Schema>
    : MatchError<`Invalid schema type`>;

/**
 * Resolve schema.table.* wildcard directly from schema
 */
export type ResolveSchemaTableWildcard<
    SchemaName extends string,
    TableName extends string,
    Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
    ? TableName extends keyof Schema["schemas"][SchemaName]
        ? Schema["schemas"][SchemaName][TableName]
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
    : MatchError<`Schema '${SchemaName}' not found`>;

/**
 * Expand * to all columns from all tables in context
 */
export type ExpandAllColumns<Context> = UnionToIntersection<
    {
        [Alias in keyof Context]: Context[Alias];
    }[keyof Context]
>;

/**
 * Convert union to intersection
 * Used to merge all table columns when SELECT *
 */
type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validate all column references in the array
 * Returns the first error found, or true if all valid
 */
export type ValidateAllColumnRefs<
    ColumnRefs,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = ColumnRefs extends [] ? true
    : ColumnRefs extends [ infer First, ...infer Rest ]
        ? ValidateSingleColumnRef<First, Context, Schema> extends
            infer FirstResult
            ? FirstResult extends MatchError<string> ? FirstResult
            : ValidateAllColumnRefs<Rest, Context, Schema>
        : never
    : true;

/**
 * Validate a single column reference exists in context
 * Note: We check for undefined first due to TypeScript 5.9+ behavior
 */
export type ValidateSingleColumnRef<
    Ref,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = Ref extends TableColumnRef<infer Table, infer Column, infer ColSchema>
    ? ColSchema extends undefined
        // Use context
        ? Table extends keyof Context
            ? Context[Table] extends infer TableType
                ? Column extends keyof TableType ? true
                : MatchError<`Column '${Column}' not found in '${Table}'`>
            : never
        : MatchError<`Table or alias '${Table}' not found`>
        // Schema-qualified: validate directly against schema
    : ColSchema extends string
        ? ValidateSchemaTableColumn<ColSchema, Table, Column, Schema>
    : MatchError<`Invalid schema type`>
    : Ref extends UnboundColumnRef<infer Column>
        ? FindColumnExists<Column, Context, keyof Context>
    : true;

/**
 * Validate a schema.table.column reference exists
 */
export type ValidateSchemaTableColumn<
    SchemaName extends string,
    TableName extends string,
    ColumnName extends string,
    Schema extends DatabaseSchema,
> = SchemaName extends keyof Schema["schemas"]
    ? TableName extends keyof Schema["schemas"][SchemaName]
        ? ColumnName extends keyof Schema["schemas"][SchemaName][TableName]
            ? true
        : MatchError<
            `Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`
        >
    : MatchError<`Table '${TableName}' not found in schema '${SchemaName}'`>
    : MatchError<`Schema '${SchemaName}' not found`>;

/**
 * Check if an unbound column exists in any table
 * Uses mapped type to avoid distributive conditional infinite recursion
 */
export type FindColumnExists<
    Column extends string,
    Context,
    _Keys = keyof Context, // Kept for backwards compatibility, not used
> = true extends {
    [K in keyof Context]: Column extends keyof Context[K] ? true : never;
}[keyof Context] ? true
    : MatchError<`Column '${Column}' not found in any table`>;

// ============================================================================
// Subquery Resolution
// ============================================================================

/**
 * Resolve a scalar subquery expression
 * Builds combined context (outer + inner), matches the inner query,
 * and returns the type of the first selected column
 */
export type ResolveSubqueryExpr<
    Query extends SubquerySelectClause,
    CastType,
    OuterContext,
    Schema extends DatabaseSchema,
> = Query extends {
    columns: infer Columns;
    from: infer From extends TableSource;
    joins: infer Joins;
}
    ? BuildSubqueryContext<From, Joins, Schema> extends infer InnerContext
        ? InnerContext extends MatchError<string>
            ? CastType extends string ? MapSQLTypeToTS<CastType> : InnerContext
        : MergeContexts<OuterContext, InnerContext> extends
            infer CombinedContext
            ? MatchSubqueryColumns<Columns, CombinedContext, Schema> extends
                infer ResultType
                ? ResultType extends MatchError<string>
                    ? CastType extends string ? MapSQLTypeToTS<CastType>
                    : ResultType
                : CastType extends string ? MapSQLTypeToTS<CastType>
                : ResultType
            : unknown
        : unknown
    : unknown
    : unknown;

/**
 * Build context for a subquery, handling the looser types
 */
export type BuildSubqueryContext<
    From extends TableSource,
    Joins,
    Schema extends DatabaseSchema,
> = ResolveTableSource<From, Schema, {}> extends infer FromContext
    ? FromContext extends MatchError<string> ? FromContext
    : Joins extends JoinClause[]
        ? FlattenContext<MergeJoinContexts<FromContext, Joins, Schema, {}>>
    : FromContext
    : never;

/**
 * Merge outer and inner contexts for correlated subqueries
 * Inner context takes precedence (inner table aliases shadow outer)
 */
export type MergeContexts<Outer, Inner> = Flatten<Outer & Inner>;

/**
 * Match columns in a subquery and return the type of the first column
 * (scalar subqueries typically return a single value)
 */
export type MatchSubqueryColumns<
    Columns,
    Context,
    Schema extends DatabaseSchema,
> = Columns extends "*" ? unknown // SELECT * in scalar subquery is unusual, return unknown
    : Columns extends readonly [ infer First, ...infer _Rest ]
        ? MatchSingleSubqueryColumn<First, Context, Schema>
    : Columns extends [ infer First, ...infer _Rest ]
        ? MatchSingleSubqueryColumn<First, Context, Schema>
    : Columns extends readonly (infer Item)[]
        ? MatchSingleSubqueryColumn<Item, Context, Schema>
    : Columns extends (infer Item)[]
        ? MatchSingleSubqueryColumn<Item, Context, Schema>
    : unknown;

/**
 * Match a single column in a subquery context
 */
export type MatchSingleSubqueryColumn<
    Col,
    Context,
    Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer _Alias>
    ? ResolveColumnRef<Ref, Context, Schema>
    : Col extends AggregateExpr<infer Func, infer Arg, infer _Alias>
        ? GetAggregateResultType<Func, Arg, Context, Schema>
    : unknown;
