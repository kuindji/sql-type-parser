/**
 * Aggregate function result types
 */

import type {
    TableColumnRef,
    UnboundColumnRef,
} from "../../common/ast.js";

import type { DatabaseSchema } from "../../common/schema.js";

import type {
    ResolveTableColumn,
    ResolveUnboundColumn,
} from "./resolve.js";

/**
 * Get the result type of an aggregate function
 */
export type GetAggregateResultType<
    Func extends string,
    Arg,
    Context,
    Schema extends DatabaseSchema = DatabaseSchema,
> = Func extends "COUNT" ? number
    : Func extends "SUM" | "AVG" ? Arg extends "*" ? number
        : Arg extends TableColumnRef<infer T, infer C, infer ColSchema>
            ? ResolveTableColumn<T, C, ColSchema, Context, Schema> extends
                number ? number
            : number // SUM/AVG coerce to number
        : Arg extends UnboundColumnRef<infer C>
            ? ResolveUnboundColumn<C, Context> extends number ? number
            : number // SUM/AVG coerce to number
        : number
    : Func extends "MIN" | "MAX" ? Arg extends "*" ? unknown
        : Arg extends TableColumnRef<infer T, infer C, infer ColSchema>
            ? ResolveTableColumn<T, C, ColSchema, Context, Schema>
        : Arg extends UnboundColumnRef<infer C>
            ? ResolveUnboundColumn<C, Context>
        : unknown
    : unknown;
