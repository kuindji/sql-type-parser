/**
 * Type-level SQL INSERT parser
 * 
 * This module handles parsing of INSERT queries specifically.
 * It uses shared utilities from common/ but maintains its own
 * execution tree for TypeScript performance.
 */

import type {
  InsertClause,
  InsertColumnList,
  InsertColumnRef,
  InsertValuesClause,
  InsertSelectClause,
  InsertValueRow,
  InsertValue,
  InsertSource,
  ReturningClause,
  OnConflictClause,
  ConflictTarget,
  ConflictAction,
  ConflictUpdateSet,
  SQLInsertQuery,
} from "./ast.js"

import type {
  TableRef,
  UnboundColumnRef,
  SubquerySelectClause,
} from "../common/ast.js"

import type {
  NormalizeSQL,
  NextToken,
  ExtractUntil,
  SplitByComma,
} from "../common/tokenizer.js"

import type { Trim, ParseError, RemoveQuotes, Increment, Decrement } from "../common/utils.js"

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse a SQL INSERT query string into an AST
 */
export type ParseInsertSQL<T extends string> = ParseInsertQuery<NormalizeSQL<T>>

/**
 * Parse a normalized INSERT query
 */
type ParseInsertQuery<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "INSERT"
    ? ParseInsertBody<Rest>
    : ParseError<`Expected INSERT, got: ${First}`>
  : ParseError<"Empty query">

// ============================================================================
// INSERT Body Parser
// ============================================================================

/**
 * Parse INSERT INTO table_name ...
 */
type ParseInsertBody<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "INTO"
    ? ParseTableAndColumns<Rest>
    : ParseError<`Expected INTO after INSERT, got: ${First}`>
  : ParseError<"Expected INTO after INSERT">

/**
 * Parse table name and optional column list
 */
type ParseTableAndColumns<T extends string> = NextToken<T> extends [
  infer TablePart extends string,
  infer Rest extends string,
]
  ? ParseTableRef<TablePart> extends infer Table extends TableRef
    ? CheckForColumns<Rest, Table>
    : ParseError<"Invalid table reference">
  : ParseError<"Expected table name">

/**
 * Check if there's a column list (parentheses) or go directly to VALUES/SELECT
 */
type CheckForColumns<T extends string, Table extends TableRef> = 
  NextToken<T> extends ["(", infer AfterParen extends string]
    ? ParseColumnList<AfterParen> extends infer ColResult
      ? ColResult extends { columns: infer Cols extends InsertColumnList; rest: infer AfterCols extends string }
        ? ParseInsertSource<AfterCols, Table, Cols>
        : ColResult  // Error propagation
      : never
    : ParseInsertSource<T, Table, undefined>

/**
 * Parse column list inside parentheses
 */
type ParseColumnList<T extends string> = 
  ExtractUntilClosingParen<T, 1, ""> extends [infer ColsPart extends string, infer Rest extends string]
    ? SplitByComma<Trim<ColsPart>> extends infer Parts extends string[]
      ? ParseColumnNames<Parts> extends infer Cols extends InsertColumnRef[]
        ? { columns: InsertColumnList<Cols>; rest: Trim<Rest> }
        : ParseError<"Failed to parse column names">
      : ParseError<"Failed to split column list">
    : ParseError<"Invalid column list syntax">

/**
 * Parse column names from string array
 */
type ParseColumnNames<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [InsertColumnRef<RemoveQuotes<Trim<First>>>, ...ParseColumnNames<Rest>]
  : []

// ============================================================================
// INSERT Source Parser (VALUES or SELECT)
// ============================================================================

/**
 * Parse the source of INSERT data (VALUES or SELECT)
 */
type ParseInsertSource<
  T extends string,
  Table extends TableRef,
  Columns extends InsertColumnList | undefined
> = NextToken<T> extends [infer First extends string, infer Rest extends string]
  ? First extends "VALUES"
    ? ParseValuesClause<Rest, Table, Columns>
    : First extends "SELECT"
      ? ParseInsertSelect<T, Table, Columns>
      : First extends "DEFAULT"
        ? NextToken<Rest> extends ["VALUES", infer AfterValues extends string]
          ? BuildInsertClause<Table, Columns, InsertValuesClause<[InsertValueRow<[{ type: "Default" }]>]>, AfterValues>
          : ParseError<"Expected VALUES after DEFAULT">
        : ParseError<`Expected VALUES or SELECT, got: ${First}`>
  : ParseError<"Expected VALUES or SELECT">

/**
 * Parse VALUES clause with one or more rows
 */
type ParseValuesClause<
  T extends string,
  Table extends TableRef,
  Columns extends InsertColumnList | undefined
> = ParseValueRows<T, []> extends infer Result
  ? Result extends { rows: infer Rows extends InsertValueRow[]; rest: infer Rest extends string }
    ? BuildInsertClause<Table, Columns, InsertValuesClause<Rows>, Rest>
    : Result  // Error propagation
  : never

/**
 * Parse multiple value rows separated by commas
 */
type ParseValueRows<
  T extends string,
  Acc extends InsertValueRow[]
> = NextToken<T> extends ["(", infer AfterParen extends string]
  ? ParseSingleValueRow<AfterParen> extends infer RowResult
    ? RowResult extends { row: infer Row extends InsertValueRow; rest: infer Rest extends string }
      ? NextToken<Rest> extends [",", infer AfterComma extends string]
        ? ParseValueRows<AfterComma, [...Acc, Row]>
        : { rows: [...Acc, Row]; rest: Rest }
      : RowResult  // Error propagation
    : never
  : Acc extends []
    ? ParseError<"Expected ( to start value row">
    : { rows: Acc; rest: T }

/**
 * Parse a single row of values inside parentheses
 */
type ParseSingleValueRow<T extends string> = 
  ExtractUntilClosingParen<T, 1, ""> extends [infer ValuesPart extends string, infer Rest extends string]
    ? SplitByComma<Trim<ValuesPart>> extends infer Parts extends string[]
      ? ParseValues<Parts> extends infer Values extends InsertValue[]
        ? { row: InsertValueRow<Values>; rest: Trim<Rest> }
        : ParseError<"Failed to parse values">
      : ParseError<"Failed to split values">
    : ParseError<"Invalid value row syntax">

/**
 * Parse individual values from string array
 */
type ParseValues<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [ParseSingleValue<Trim<First>>, ...ParseValues<Rest>]
  : []

/**
 * Parse a single value
 */
type ParseSingleValue<T extends string> = 
  T extends "DEFAULT"
    ? { readonly type: "Default" }
    : T extends "NULL"
      ? { readonly type: "Literal"; readonly value: null }
      : T extends "TRUE"
        ? { readonly type: "Literal"; readonly value: true }
        : T extends "FALSE"
          ? { readonly type: "Literal"; readonly value: false }
          : T extends `'${infer Val}'`
            ? { readonly type: "Literal"; readonly value: Val }
            : T extends `$${infer Num}`
              ? { readonly type: "Param"; readonly name: Num }
              : T extends `:${infer Name}`
                ? { readonly type: "Param"; readonly name: Name }
                : IsNumericString<T> extends true
                  ? { readonly type: "Literal"; readonly value: T }
                  : { readonly type: "Expression"; readonly expr: T }

/**
 * Check if a string looks like a number
 */
type IsNumericString<T extends string> = T extends `${number}` ? true : false

/**
 * Parse INSERT ... SELECT
 */
type ParseInsertSelect<
  T extends string,
  Table extends TableRef,
  Columns extends InsertColumnList | undefined
> = ExtractSelectQuery<T> extends infer SelectResult
  ? SelectResult extends { query: infer Query extends SubquerySelectClause; rest: infer Rest extends string }
    ? BuildInsertClause<Table, Columns, InsertSelectClause<Query>, Rest>
    : SelectResult  // Error propagation
  : never

/**
 * Placeholder select clause for INSERT ... SELECT
 * Full SELECT validation would require integrating the SELECT parser
 */
type PlaceholderSelectClause = {
  readonly type: "SelectClause"
  readonly columns: unknown
  readonly from: TableRef
  readonly joins: undefined
  readonly where: undefined
  readonly groupBy: undefined
  readonly having: undefined
  readonly orderBy: undefined
  readonly limit: undefined
  readonly offset: undefined
  readonly distinct: false
  readonly ctes: undefined
}

/**
 * Extract SELECT query for INSERT ... SELECT
 * This is a simplified extraction that finds the SELECT portion
 */
type ExtractSelectQuery<T extends string> = ExtractUntil<T, InsertTerminators> extends [
  infer SelectPart extends string,
  infer Rest extends string,
]
  ? { query: PlaceholderSelectClause; rest: Rest }
  : { query: PlaceholderSelectClause; rest: "" }

/**
 * Keywords that terminate the INSERT source
 */
type InsertTerminators = "ON" | "RETURNING"

// ============================================================================
// Build Insert Clause with Optional Parts
// ============================================================================

/**
 * Build the complete INSERT clause by parsing remaining optional parts
 */
type BuildInsertClause<
  Table extends TableRef,
  Columns extends InsertColumnList | undefined,
  Source extends InsertSource,
  Rest extends string
> = ParseOnConflict<Rest> extends infer ConflictResult
  ? ConflictResult extends { onConflict: infer OnConflict; rest: infer AfterConflict extends string }
    ? ParseReturning<AfterConflict> extends infer ReturnResult
      ? ReturnResult extends { returning: infer Returning; rest: infer _AfterReturn extends string }
        ? SQLInsertQuery<InsertClause<
            Table,
            Columns,
            Source,
            OnConflict extends OnConflictClause ? OnConflict : undefined,
            Returning extends ReturningClause ? Returning : undefined
          >>
        : never
      : never
    : never
  : never

// ============================================================================
// ON CONFLICT Parser
// ============================================================================

/**
 * Parse ON CONFLICT clause
 */
type ParseOnConflict<T extends string> = Trim<T> extends ""
  ? { onConflict: undefined; rest: "" }
  : NextToken<T> extends ["ON", infer Rest extends string]
    ? NextToken<Rest> extends ["CONFLICT", infer AfterConflict extends string]
      ? ParseConflictBody<AfterConflict>
      : { onConflict: undefined; rest: T }
    : { onConflict: undefined; rest: T }

/**
 * Parse the body of ON CONFLICT
 */
type ParseConflictBody<T extends string> = 
  ParseConflictTarget<T> extends infer TargetResult
    ? TargetResult extends { target: infer Target; rest: infer AfterTarget extends string }
      ? ParseConflictAction<AfterTarget> extends infer ActionResult
        ? ActionResult extends { action: infer Action extends ConflictAction; updates: infer Updates; rest: infer AfterAction extends string }
          ? {
              onConflict: OnConflictClause<
                Target extends ConflictTarget ? Target : undefined,
                Action,
                Updates extends ConflictUpdateSet[] ? Updates : undefined,
                undefined
              >
              rest: AfterAction
            }
          : ActionResult
        : never
      : TargetResult
    : never

/**
 * Parse conflict target (columns or constraint)
 */
type ParseConflictTarget<T extends string> = 
  NextToken<T> extends ["(", infer AfterParen extends string]
    ? ExtractUntilClosingParen<AfterParen, 1, ""> extends [infer ColsPart extends string, infer Rest extends string]
      ? { target: ConflictTarget<SplitByCommaSimple<Trim<ColsPart>>, undefined>; rest: Trim<Rest> }
      : { target: undefined; rest: T }
    : NextToken<T> extends ["ON", infer Rest extends string]
      ? NextToken<Rest> extends ["CONSTRAINT", infer AfterConstraint extends string]
        ? NextToken<AfterConstraint> extends [infer ConstraintName extends string, infer AfterName extends string]
          ? { target: ConflictTarget<undefined, RemoveQuotes<ConstraintName>>; rest: AfterName }
          : { target: undefined; rest: T }
        : { target: undefined; rest: T }
      : { target: undefined; rest: T }

/**
 * Simple split by comma (for conflict target columns)
 */
type SplitByCommaSimple<T extends string> = SplitByComma<T> extends infer Parts extends string[]
  ? CleanColumnNames<Parts>
  : []

/**
 * Clean column names (trim and remove quotes)
 */
type CleanColumnNames<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [RemoveQuotes<Trim<First>>, ...CleanColumnNames<Rest>]
  : []

/**
 * Parse conflict action (DO NOTHING or DO UPDATE)
 */
type ParseConflictAction<T extends string> = 
  NextToken<T> extends ["DO", infer AfterDo extends string]
    ? NextToken<AfterDo> extends ["NOTHING", infer AfterNothing extends string]
      ? { action: "DO NOTHING"; updates: undefined; rest: AfterNothing }
      : NextToken<AfterDo> extends ["UPDATE", infer AfterUpdate extends string]
        ? NextToken<AfterUpdate> extends ["SET", infer AfterSet extends string]
          ? ParseUpdateSets<AfterSet> extends infer SetResult
            ? SetResult extends { updates: infer Updates extends ConflictUpdateSet[]; rest: infer AfterSets extends string }
              ? { action: "DO UPDATE"; updates: Updates; rest: AfterSets }
              : SetResult
            : never
          : ParseError<"Expected SET after DO UPDATE">
        : ParseError<"Expected NOTHING or UPDATE after DO">
    : ParseError<"Expected DO after ON CONFLICT target">

/**
 * Parse SET clauses for ON CONFLICT DO UPDATE
 */
type ParseUpdateSets<
  T extends string,
  Acc extends ConflictUpdateSet[] = []
> = ExtractUntil<T, "RETURNING" | "WHERE"> extends [infer SetsPart extends string, infer Rest extends string]
  ? SplitByComma<Trim<SetsPart>> extends infer Parts extends string[]
    ? ParseSetAssignments<Parts> extends infer Sets extends ConflictUpdateSet[]
      ? { updates: Sets; rest: Rest }
      : { updates: Acc; rest: Rest }
    : { updates: Acc; rest: Rest }
  : { updates: Acc; rest: "" }

/**
 * Parse SET assignments
 */
type ParseSetAssignments<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? Trim<First> extends `${infer Col} = ${infer Val}`
    ? [
        ConflictUpdateSet<RemoveQuotes<Trim<Col>>, ParseSetValue<Trim<Val>>>,
        ...ParseSetAssignments<Rest>
      ]
    : ParseSetAssignments<Rest>
  : []

/**
 * Parse SET value (including EXCLUDED.column syntax)
 */
type ParseSetValue<T extends string> = 
  T extends `EXCLUDED . ${infer Col}`
    ? "EXCLUDED"
    : T extends `EXCLUDED.${infer Col}`
      ? "EXCLUDED"
      : ParseSingleValue<T>

// ============================================================================
// RETURNING Parser
// ============================================================================

/**
 * Parse RETURNING clause
 */
type ParseReturning<T extends string> = Trim<T> extends ""
  ? { returning: undefined; rest: "" }
  : NextToken<T> extends ["RETURNING", infer Rest extends string]
    ? Trim<Rest> extends "*"
      ? { returning: ReturningClause<"*">; rest: "" }
      : ParseReturningColumns<Rest> extends infer Result
        ? Result extends { columns: infer Cols extends UnboundColumnRef[]; rest: infer AfterCols extends string }
          ? { returning: ReturningClause<Cols>; rest: AfterCols }
          : Result
        : never
    : { returning: undefined; rest: T }

/**
 * Parse RETURNING column list
 */
type ParseReturningColumns<T extends string> = 
  SplitByComma<Trim<T>> extends infer Parts extends string[]
    ? { columns: ParseColumnRefs<Parts>; rest: "" }
    : { columns: []; rest: "" }

/**
 * Parse column references for RETURNING
 */
type ParseColumnRefs<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [UnboundColumnRef<RemoveQuotes<Trim<First>>>, ...ParseColumnRefs<Rest>]
  : []

// ============================================================================
// Table Reference Parser
// ============================================================================

/**
 * Parse a table reference with optional schema
 */
type ParseTableRef<T extends string> = 
  Trim<T> extends `${infer Schema}.${infer Table}`
    ? IsSimpleIdentifier<Schema> extends true
      ? IsSimpleIdentifier<Table> extends true
        ? TableRef<RemoveQuotes<Table>, RemoveQuotes<Table>, RemoveQuotes<Schema>>
        : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>
      : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>
    : Trim<T> extends `"${infer Schema}"."${infer Table}"`
      ? TableRef<Table, Table, Schema>
      : TableRef<RemoveQuotes<Trim<T>>, RemoveQuotes<Trim<T>>, undefined>

/**
 * Check if a string is a simple identifier
 */
type IsSimpleIdentifier<T extends string> = 
  T extends "" ? false :
  T extends `${string} ${string}` ? false :
  T extends "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" ? false :
  true

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract content until we find the matching closing parenthesis
 */
type ExtractUntilClosingParen<
  T extends string,
  Depth extends number,
  Acc extends string
> = Depth extends 0
  ? [Trim<Acc>, Trim<T>]
  : NextToken<T> extends [infer Token extends string, infer Rest extends string]
    ? Token extends "("
      ? ExtractUntilClosingParen<Rest, Increment<Depth>, `${Acc} ${Token}`>
      : Token extends ")"
        ? Decrement<Depth> extends 0
          ? [Trim<Acc>, Trim<Rest>]
          : ExtractUntilClosingParen<Rest, Decrement<Depth>, `${Acc} ${Token}`>
        : ExtractUntilClosingParen<Rest, Depth, `${Acc} ${Token}`>
    : [Trim<Acc>, ""]

