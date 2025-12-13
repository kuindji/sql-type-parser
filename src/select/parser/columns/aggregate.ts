/**
 * Aggregate function parsing (COUNT, SUM, AVG, MIN, MAX)
 */

import type { AggregateExpr, AggregateFunc } from "../../../common/ast.js";
import type {
    Decrement,
    Increment,
    ParseError,
    RemoveQuotes,
    Trim,
} from "../../../common/utils.js";
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
 * Handles: FUNC ( arg ), FUNC ( arg ) AS alias,
 *          FUNC ( arg ) :: type, FUNC ( arg ) :: type AS alias
 */
export type ParseAggregateColumn<T extends string> =
    // Pattern: FUNC ( arg ) :: type AS alias
    T extends `${infer Func} ( ${infer Rest}`
        ? Func extends AggregateFunc
            ? ExtractAggregateContent<Rest> extends
                [infer Arg extends string, infer Remainder extends string]
                ? ParseAggregateRemainder<Func, Arg, Remainder>
                : ParseError<`Invalid aggregate syntax: ${T}`>
            : ParseError<`Unknown aggregate function: ${Func}`>
        : ParseError<`Invalid aggregate syntax: ${T}`>;

/**
 * Extract the aggregate argument and remainder after closing paren
 * Input: "arg ) rest" or "func ( nested ) ) rest"
 * Returns: [arg, rest]
 */
type ExtractAggregateContent<
    T extends string,
    Acc extends string = "",
    Depth extends number = 0,
> = T extends `( ${infer Rest}`
    ? ExtractAggregateContent<Rest, `${Acc}( `, Increment<Depth>>
    : T extends `) ${infer Rest}`
        ? Depth extends 0
            ? [Trim<Acc>, Trim<Rest>]
            : ExtractAggregateContent<Rest, `${Acc}) `, Decrement<Depth>>
        : T extends `${infer Char} ${infer Rest}`
            ? ExtractAggregateContent<Rest, `${Acc}${Char} `, Depth>
            : T extends ")"
                ? Depth extends 0 ? [Trim<Acc>, ""] : never
                : never;

/**
 * Parse the remainder after the aggregate argument
 * Handles: "", "AS alias", "::type", ":: type", "::type AS alias", ":: type AS alias"
 */
type ParseAggregateRemainder<
    Func extends AggregateFunc,
    Arg extends string,
    Remainder extends string,
> = Remainder extends ""
    ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
    : Remainder extends `AS ${infer Alias}`
        ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
        // With space after ::
        : Remainder extends `:: ${infer _Type} AS ${infer Alias}`
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
        : Remainder extends `:: ${infer _Type}`
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
        // Without space after ::
        : Remainder extends `::${infer _Type} AS ${infer Alias}`
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
        : Remainder extends `::${infer _Type}`
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
        : ParseError<`Invalid aggregate remainder: ${Remainder}`>;

/**
 * Parse aggregate function argument
 */
type ParseAggregateArg<T extends string> = Trim<T> extends "*" ? "*"
    : ParseColumnRefType<Trim<T>>;
