/**
 * Type-level SQL SELECT JOIN clause parser
 *
 * This module handles parsing of JOIN clauses including all join types
 * (INNER, LEFT, RIGHT, FULL, CROSS) and their ON conditions.
 */

import type {
    JoinClause,
    JoinType,
    ParsedCondition,
} from "../../common/ast.js";

import type {
    ExtractUntil,
    FromTerminators,
    NextToken,
    StartsWith,
} from "../../common/tokenizer.js";

import type {
    ParseError,
    Trim,
} from "../../common/utils.js";

import type { ParseTableRef } from "./from.js";
import type { ScanTokensForColumnRefs } from "./columns.js";

// ============================================================================
// JOIN Parser
// ============================================================================

/**
 * Parse JOIN clauses
 */
export type ParseJoins<T extends string> = Trim<T> extends ""
    ? { joins: undefined; rest: ""; }
    : IsJoinStart<T> extends true ? ParseJoinList<T, []>
    : { joins: undefined; rest: T; };

/**
 * Check if string starts with a JOIN keyword
 */
type IsJoinStart<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer _,
] ? First extends "JOIN" | "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS" ? true
    : false
    : false;

/**
 * Parse a list of JOINs
 */
type ParseJoinList<T extends string, Acc extends JoinClause[]> =
    IsJoinStart<T> extends true
        ? ParseSingleJoin<T> extends infer JoinResult ? JoinResult extends {
                join: infer J extends JoinClause;
                rest: infer Rest extends string;
            } ? ParseJoinList<Rest, [...Acc, J]>
            : JoinResult extends ParseError<string> ? JoinResult
            : { joins: Acc extends [] ? undefined : Acc; rest: T; }
        : never
        : { joins: Acc extends [] ? undefined : Acc; rest: T; };

/**
 * Parse a single JOIN clause
 */
export type ParseSingleJoin<T extends string> = [ExtractJoinType<T>] extends
    [never] ? ParsePlainJoin<T>
    : ParseTypedJoin<T, ExtractJoinType<T>>;

/**
 * Parse a plain JOIN (without INNER/LEFT/etc prefix) - treated as INNER JOIN
 */
type ParsePlainJoin<T extends string> = NextToken<T> extends
    ["JOIN", infer AfterJoin extends string]
    ? ExtractUntil<AfterJoin, "ON" | FromTerminators> extends [
        infer TablePart extends string,
        infer OnPart extends string,
    ]
        ? StartsWith<OnPart, "ON"> extends true
            ? NextToken<OnPart> extends
                ["ON", infer ConditionPart extends string] ? ExtractUntil<
                    ConditionPart,
                    | FromTerminators
                    | "JOIN"
                    | "INNER"
                    | "LEFT"
                    | "RIGHT"
                    | "FULL"
                    | "CROSS"
                > extends [
                    infer Condition extends string,
                    infer Rest extends string,
                ] ? {
                        join: JoinClause<
                            "INNER",
                            ParseTableRef<TablePart>,
                            ParsedCondition<
                                ScanTokensForColumnRefs<Trim<Condition>, []>
                            >
                        >;
                        rest: Rest;
                    }
                : {
                    join: JoinClause<
                        "INNER",
                        ParseTableRef<TablePart>,
                        ParsedCondition<
                            ScanTokensForColumnRefs<Trim<ConditionPart>, []>
                        >
                    >;
                    rest: "";
                }
            : never
        : {
            join: JoinClause<"INNER", ParseTableRef<TablePart>, undefined>;
            rest: OnPart;
        }
    : never
    : ParseError<"Invalid JOIN syntax">;

/**
 * Parse a typed JOIN (INNER/LEFT/RIGHT/FULL/CROSS JOIN)
 */
type ParseTypedJoin<T extends string, JoinTypeResult> = JoinTypeResult extends
    [infer JType extends JoinType, infer AfterType extends string]
    ? NextToken<AfterType> extends ["JOIN", infer AfterJoin extends string]
        ? ExtractUntil<AfterJoin, "ON" | FromTerminators> extends [
            infer TablePart extends string,
            infer OnPart extends string,
        ]
            ? StartsWith<OnPart, "ON"> extends true
                ? NextToken<OnPart> extends
                    ["ON", infer ConditionPart extends string] ? ExtractUntil<
                        ConditionPart,
                        | FromTerminators
                        | "JOIN"
                        | "INNER"
                        | "LEFT"
                        | "RIGHT"
                        | "FULL"
                        | "CROSS"
                    > extends [
                        infer Condition extends string,
                        infer Rest extends string,
                    ] ? {
                            join: JoinClause<
                                JType,
                                ParseTableRef<TablePart>,
                                ParsedCondition<
                                    ScanTokensForColumnRefs<Trim<Condition>, []>
                                >
                            >;
                            rest: Rest;
                        }
                    : {
                        join: JoinClause<
                            JType,
                            ParseTableRef<TablePart>,
                            ParsedCondition<
                                ScanTokensForColumnRefs<Trim<ConditionPart>, []>
                            >
                        >;
                        rest: "";
                    }
                : never
            : {
                join: JoinClause<JType, ParseTableRef<TablePart>, undefined>;
                rest: OnPart;
            }
        : {
            join: JoinClause<JType, ParseTableRef<AfterJoin>, undefined>;
            rest: "";
        }
    : ParseError<"Expected JOIN keyword">
    : never;

/**
 * Extract join type from the beginning of the string
 */
export type ExtractJoinType<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
] ? First extends "INNER" ? ["INNER", Rest]
    : First extends "LEFT"
        ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
            ? ["LEFT OUTER", AfterOuter]
        : ["LEFT", Rest]
    : First extends "RIGHT"
        ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
            ? ["RIGHT OUTER", AfterOuter]
        : ["RIGHT", Rest]
    : First extends "FULL"
        ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
            ? ["FULL OUTER", AfterOuter]
        : ["FULL", Rest]
    : First extends "CROSS" ? ["CROSS", Rest]
    : never
    : never;
