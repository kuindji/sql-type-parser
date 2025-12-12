/**
 * Column matching types
 *
 * Matches SELECT columns against the table context to determine result types.
 */

import type {
    ColumnRef,
    SelectItem,
} from "../ast.js";

import type {
    AggregateExpr,
    TableWildcard,
} from "../../common/ast.js";

import type { DatabaseSchema } from "../../common/schema.js";
import type { Flatten, MatchError } from "../../common/utils.js";

import type { GetAggregateResultType } from "./aggregates.js";
import type {
    ExpandAllColumns,
    ResolveColumnRef,
    ResolveTableWildcard,
} from "./resolve.js";

// ============================================================================
// Column Matching
// ============================================================================

/**
 * Match columns against the table context
 */
export type MatchColumns<
    Columns,
    Context,
    Schema extends DatabaseSchema,
> = Columns extends "*" ? ExpandAllColumns<Context>
    : Columns extends SelectItem[] ? MatchColumnList<Columns, Context, Schema>
    : MatchError<"Invalid columns type">;

/**
 * Match a list of columns
 * Uses accumulator pattern with single flatten at the end for better performance
 */
export type MatchColumnList<
    Columns extends SelectItem[],
    Context,
    Schema extends DatabaseSchema,
    Acc = {},
> = Columns extends [ infer First, ...infer Rest extends SelectItem[] ]
    ? MatchSingleColumn<First, Context, Schema> extends infer FirstResult
        ? FirstResult extends MatchError<string> ? FirstResult
        : MatchColumnList<Rest, Context, Schema, Acc & FirstResult>
        : never
    : Flatten<Acc>;

/**
 * Helper: check if a SelectItem has been marked as optional
 */
export type IsOptionalSelectItem<Col> = Col extends { readonly optional: true; }
    ? true
    : false;

/**
 * Match a single column (ColumnRef, AggregateExpr, or TableWildcard)
 * Note: We use [ColType] extends [...] to prevent distribution over union types
 * Optional columns (from conditional selects/joins) are unioned with `undefined`.
 */
export type MatchSingleColumn<
    Col,
    Context,
    Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer Alias>
    ? ResolveColumnRef<Ref, Context, Schema> extends infer ColType
        ? [ ColType ] extends [ MatchError<string> ]
            ? { [K in Alias]: ColType; }
        : IsOptionalSelectItem<Col> extends true
            ? { [K in Alias]: ColType | undefined; }
        : { [K in Alias]: ColType; }
    : never
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
        ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : Col extends AggregateExpr<infer Func, infer Arg, infer Alias>
        ? IsOptionalSelectItem<Col> extends true ? {
                [K in Alias]:
                    | GetAggregateResultType<
                        Func,
                        Arg,
                        Context,
                        Schema
                    >
                    | undefined;
            }
        : {
            [K in Alias]: GetAggregateResultType<
                Func,
                Arg,
                Context,
                Schema
            >;
        }
    : MatchError<"Unknown column type">;

// ============================================================================
// Column Extraction (for CTEs and derived tables)
// ============================================================================

/**
 * Extract columns from a SELECT as an object type (for CTE/derived table)
 */
export type ExtractColumnsAsObject<
    Columns,
    Context,
    Schema extends DatabaseSchema,
> = Columns extends "*" ? ExpandAllColumns<Context>
    : Columns extends SelectItem[]
        ? ExtractColumnListAsObject<Columns, Context, Schema>
    : {};

/**
 * Extract a list of columns as an object type
 * Uses accumulator pattern with single flatten at the end for better performance
 */
export type ExtractColumnListAsObject<
    Columns extends SelectItem[],
    Context,
    Schema extends DatabaseSchema,
    Acc = {},
> = Columns extends [ infer First, ...infer Rest extends SelectItem[] ]
    ? ExtractSingleColumnAsObject<First, Context, Schema> extends
        infer FirstResult
        ? ExtractColumnListAsObject<Rest, Context, Schema, Acc & FirstResult>
        : Acc
    : Flatten<Acc>;

/**
 * Extract a single column as an object entry { alias: type }
 */
export type ExtractSingleColumnAsObject<
    Col,
    Context,
    Schema extends DatabaseSchema,
> = Col extends ColumnRef<infer Ref, infer Alias>
    ? { [K in Alias]: ResolveColumnRef<Ref, Context, Schema>; }
    : Col extends AggregateExpr<infer Func, infer Arg, infer Alias>
        ? { [K in Alias]: GetAggregateResultType<Func, Arg, Context, Schema>; }
    : Col extends TableWildcard<infer TableOrAlias, infer WildcardSchema>
        ? ResolveTableWildcard<TableOrAlias, WildcardSchema, Context, Schema>
    : {};
