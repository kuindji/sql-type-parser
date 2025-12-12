/**
 * Aggregate function parsing (COUNT, SUM, AVG, MIN, MAX)
 */

import type { AggregateExpr, AggregateFunc } from "../../../common/ast.js";
import type { ParseError, RemoveQuotes, Trim } from "../../../common/utils.js";
import type { ParseColumnRefType } from "./reference.js";

// ============================================================================
// Aggregate Function Parsing
// ============================================================================

/**
 * Check if a column is an aggregate function
 */
export type IsAggregate<T extends string> = T extends `COUNT ${string}` ? true
    : T extends `SUM ${string}` ? true
    : T extends `AVG ${string}` ? true
    : T extends `MIN ${string}` ? true
    : T extends `MAX ${string}` ? true
    : false;

/**
 * Parse an aggregate function column
 */
export type ParseAggregateColumn<T extends string> = T extends
    `${infer Func} ( ${infer Arg} ) AS ${infer Alias}`
    ? Func extends AggregateFunc
        ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
    : ParseError<`Unknown aggregate function: ${Func}`>
    : T extends `${infer Func} ( ${infer Arg} )`
        ? Func extends AggregateFunc
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
        : ParseError<`Unknown aggregate function: ${Func}`>
    : ParseError<`Invalid aggregate syntax: ${T}`>;

/**
 * Parse aggregate function argument
 */
type ParseAggregateArg<T extends string> = Trim<T> extends "*" ? "*"
    : ParseColumnRefType<Trim<T>>;
