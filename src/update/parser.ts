/**
 * Type-level SQL UPDATE parser
 * 
 * This module handles parsing of UPDATE queries specifically.
 * It uses shared utilities from common/ but maintains its own
 * execution tree for TypeScript performance.
 */

import type {
  UpdateClause,
  SetClause,
  SetAssignment,
  SetValue,
  UpdateFromClause,
  ReturningClause,
  ReturningItem,
  QualifiedColumnRef,
  QualifiedWildcard,
  SQLUpdateQuery,
} from "./ast.js"

import type {
  TableRef,
  TableSource,
  UnboundColumnRef,
  ValidatableColumnRef,
  TableColumnRef,
  ParsedCondition,
  WhereExpr,
  JoinClause,
  JoinType,
  CTEDefinition,
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
 * Parse a SQL UPDATE query string into an AST
 * Supports: UPDATE, WITH ... UPDATE
 */
export type ParseUpdateSQL<T extends string> = ParseUpdateQuery<NormalizeSQL<T>>

/**
 * Parse a normalized UPDATE query
 */
type ParseUpdateQuery<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "WITH"
    ? ParseWithAndUpdate<Rest>
    : First extends "UPDATE"
      ? ParseUpdateBodyWithCTEs<Rest, undefined>
      : ParseError<`Expected UPDATE or WITH, got: ${First}`>
  : ParseError<"Empty query">

/**
 * Parse WITH clause followed by UPDATE
 */
type ParseWithAndUpdate<T extends string> = ParseCTEList<T> extends infer CTEResult
  ? CTEResult extends { ctes: infer CTEs extends CTEDefinition[]; rest: infer AfterCTEs extends string }
    ? NextToken<AfterCTEs> extends ["UPDATE", infer UpdateRest extends string]
      ? ParseUpdateBodyWithCTEs<UpdateRest, CTEs>
      : ParseError<"Expected UPDATE after WITH clause">
    : CTEResult
  : never

// ============================================================================
// CTE (Common Table Expression) Parser
// ============================================================================

/**
 * Parse a list of CTEs: name AS (SELECT ...), name2 AS (SELECT ...)
 */
type ParseCTEList<
  T extends string,
  Acc extends CTEDefinition[] = []
> = ParseSingleCTE<T> extends infer CTEResult
  ? CTEResult extends { cte: infer CTE extends CTEDefinition; rest: infer Rest extends string }
    ? NextToken<Rest> extends [",", infer AfterComma extends string]
      ? ParseCTEList<AfterComma, [...Acc, CTE]>
      : { ctes: [...Acc, CTE]; rest: Rest }
    : CTEResult extends ParseError<string>
      ? CTEResult
      : ParseError<"Invalid CTE syntax">
  : never

/**
 * Parse a single CTE: name AS ( SELECT ... )
 */
type ParseSingleCTE<T extends string> = NextToken<T> extends [
  infer Name extends string,
  infer AfterName extends string,
]
  ? NextToken<AfterName> extends ["AS", infer AfterAs extends string]
    ? NextToken<AfterAs> extends ["(", infer InParen extends string]
      ? ExtractParenContent<InParen> extends [infer Content extends string, infer AfterParen extends string]
        ? {
            cte: CTEDefinition<Name, SubquerySelectClause>
            rest: AfterParen
          }
        : ParseError<"Invalid CTE: missing closing parenthesis">
      : ParseError<"Invalid CTE: expected ( after AS">
    : ParseError<"Invalid CTE: expected AS after name">
  : ParseError<"Invalid CTE: expected name">

/**
 * Extract content within parentheses, handling nested parens
 */
type ExtractParenContent<
  T extends string,
  Depth extends number = 1,
  Acc extends string = ""
> = Depth extends 0
  ? [Acc, T]
  : T extends `(${infer Rest}`
    ? ExtractParenContent<Rest, Increment<Depth>, `${Acc}(`>
    : T extends `)${infer Rest}`
      ? Depth extends 1
        ? [Acc, Rest]
        : ExtractParenContent<Rest, Decrement<Depth>, `${Acc})`>
      : T extends `${infer Char}${infer Rest}`
        ? ExtractParenContent<Rest, Depth, `${Acc}${Char}`>
        : ParseError<"Unclosed parenthesis in CTE">

// ============================================================================
// UPDATE Body Parser
// ============================================================================

/**
 * Parse UPDATE table_name SET ... (legacy - no CTEs)
 */
type ParseUpdateBody<T extends string> = ParseUpdateBodyWithCTEs<T, undefined>

/**
 * Parse UPDATE table_name SET ... with optional CTEs
 */
type ParseUpdateBodyWithCTEs<
  T extends string,
  CTEs extends CTEDefinition[] | undefined
> = ExtractUntil<T, "SET"> extends [
  infer TablePart extends string,
  infer Rest extends string,
]
  ? ParseTableRef<Trim<TablePart>> extends infer Table extends TableRef
    ? NextToken<Rest> extends ["SET", infer AfterSet extends string]
      ? ParseSetClauseWithCTEs<AfterSet, Table, CTEs>
      : ParseError<"Expected SET clause">
    : ParseError<"Invalid table reference">
  : ParseError<"Expected SET after table name">

/**
 * Parse SET clause and remaining parts (legacy - no CTEs)
 */
type ParseSetClause<T extends string, Table extends TableRef> = 
  ParseSetClauseWithCTEs<T, Table, undefined>

/**
 * Parse SET clause and remaining parts with optional CTEs
 */
type ParseSetClauseWithCTEs<
  T extends string,
  Table extends TableRef,
  CTEs extends CTEDefinition[] | undefined
> = 
  ExtractUntil<T, UpdateTerminators> extends [
    infer SetPart extends string,
    infer Rest extends string,
  ]
    ? ParseSetAssignments<Trim<SetPart>> extends infer Assignments extends SetAssignment[]
      ? BuildUpdateClauseWithCTEs<Table, SetClause<Assignments>, Rest, CTEs>
      : ParseError<"Failed to parse SET assignments">
    : ParseSetAssignments<Trim<T>> extends infer Assignments extends SetAssignment[]
      ? BuildUpdateClauseWithCTEs<Table, SetClause<Assignments>, "", CTEs>
      : ParseError<"Failed to parse SET assignments">

/**
 * Keywords that terminate the SET clause
 */
type UpdateTerminators = "FROM" | "WHERE" | "RETURNING"

/**
 * Parse SET assignments: col1 = val1, col2 = val2, ...
 */
type ParseSetAssignments<T extends string> = 
  SplitByComma<T> extends infer Parts extends string[]
    ? ParseAssignmentList<Parts>
    : []

/**
 * Parse list of assignments
 */
type ParseAssignmentList<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? ParseSingleAssignment<Trim<First>> extends infer Assignment extends SetAssignment
    ? [Assignment, ...ParseAssignmentList<Rest>]
    : []
  : []

/**
 * Parse a single assignment: column = value
 */
type ParseSingleAssignment<T extends string> = 
  T extends `${infer Col} = ${infer Val}`
    ? SetAssignment<RemoveQuotes<Trim<Col>>, ParseSetValue<Trim<Val>>>
    : never

/**
 * Parse a SET value
 */
type ParseSetValue<T extends string> = 
  T extends "DEFAULT"
    ? { readonly type: "Default" }
    : T extends "NULL"
      ? { readonly type: "Null" }
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
                  : T extends `${infer Table}.${infer Col}`
                    ? { readonly type: "ColumnRef"; readonly column: RemoveQuotes<Col>; readonly table: RemoveQuotes<Table> }
                    : IsSimpleIdentifier<T> extends true
                      ? { readonly type: "ColumnRef"; readonly column: RemoveQuotes<T> }
                      : { readonly type: "Expression"; readonly expr: T }

/**
 * Check if a string looks like a number
 */
type IsNumericString<T extends string> = T extends `${number}` ? true : false

// ============================================================================
// Build Update Clause with Optional Parts
// ============================================================================

/**
 * Build the complete UPDATE clause by parsing remaining optional parts (legacy - no CTEs)
 */
type BuildUpdateClause<
  Table extends TableRef,
  Set extends SetClause,
  Rest extends string
> = BuildUpdateClauseWithCTEs<Table, Set, Rest, undefined>

/**
 * Build the complete UPDATE clause by parsing remaining optional parts with CTEs
 */
type BuildUpdateClauseWithCTEs<
  Table extends TableRef,
  Set extends SetClause,
  Rest extends string,
  CTEs extends CTEDefinition[] | undefined
> = ParseFromWithJoins<Rest> extends infer FromResult
  ? FromResult extends { from: infer From; joins: infer Joins; rest: infer AfterFrom extends string }
    ? ParseWhere<AfterFrom> extends infer WhereResult
      ? WhereResult extends { where: infer Where; rest: infer AfterWhere extends string }
        ? ParseReturning<AfterWhere> extends infer ReturnResult
          ? ReturnResult extends { returning: infer Returning; rest: infer _AfterReturn extends string }
            ? SQLUpdateQuery<UpdateClause<
                Table,
                Set,
                From extends TableSource[]
                  ? UpdateFromClause<From, Joins extends JoinClause[] ? Joins : undefined>
                  : undefined,
                Where extends WhereExpr ? Where : undefined,
                Returning extends ReturningClause ? Returning : undefined,
                CTEs
              >>
            : never
          : never
        : never
      : never
    : never
  : never

// ============================================================================
// FROM Clause Parser (with JOIN support)
// ============================================================================

/**
 * Parse FROM clause (PostgreSQL multi-table update) - legacy version
 */
type ParseFrom<T extends string> = ParseFromWithJoins<T> extends infer Result
  ? Result extends { from: infer From; joins: infer _Joins; rest: infer Rest extends string }
    ? { from: From extends TableSource[] ? UpdateFromClause<From> : undefined; rest: Rest }
    : Result
  : never

/**
 * Parse FROM clause with JOIN support
 */
type ParseFromWithJoins<T extends string> = Trim<T> extends ""
  ? { from: undefined; joins: undefined; rest: "" }
  : NextToken<T> extends ["FROM", infer Rest extends string]
    ? ParseFromTablesWithJoins<Rest>
    : { from: undefined; joins: undefined; rest: T }

/**
 * Parse tables and JOINs in FROM clause
 */
type ParseFromTablesWithJoins<T extends string> = 
  // First, extract the first table
  ExtractFirstTable<T> extends [infer FirstTable extends string, infer AfterFirst extends string]
    ? ParseJoinsOrContinue<AfterFirst, [ParseTableRef<Trim<FirstTable>>]>
    : { from: [ParseTableRef<Trim<T>>]; joins: undefined; rest: "" }

/**
 * Extract the first table (until comma, JOIN, WHERE, or RETURNING)
 */
type ExtractFirstTable<T extends string> = 
  ExtractUntil<T, "," | JoinKeywords | "WHERE" | "RETURNING"> extends [
    infer TablePart extends string,
    infer Rest extends string,
  ]
    ? [TablePart, Rest]
    : [T, ""]

/**
 * JOIN keywords to detect
 */
type JoinKeywords = "JOIN" | "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"

/**
 * Parse JOINs or continue with comma-separated tables
 */
type ParseJoinsOrContinue<
  T extends string,
  Tables extends TableSource[]
> = NextToken<Trim<T>> extends [infer Token extends string, infer Rest extends string]
  ? Token extends ","
    ? ExtractFirstTable<Rest> extends [infer NextTable extends string, infer AfterNext extends string]
      ? ParseJoinsOrContinue<AfterNext, [...Tables, ParseTableRef<Trim<NextTable>>]>
      : { from: Tables; joins: undefined; rest: T }
    : Token extends JoinKeywords
      ? ParseJoinClauses<T, []> extends infer JoinResult
        ? JoinResult extends { joins: infer Joins extends JoinClause[]; rest: infer AfterJoins extends string }
          ? { from: Tables; joins: Joins; rest: AfterJoins }
          : { from: Tables; joins: undefined; rest: T }
        : { from: Tables; joins: undefined; rest: T }
      : { from: Tables; joins: undefined; rest: T }
  : { from: Tables; joins: undefined; rest: T }

/**
 * Parse multiple JOIN clauses
 */
type ParseJoinClauses<
  T extends string,
  Acc extends JoinClause[]
> = ParseSingleJoin<Trim<T>> extends infer JoinResult
  ? JoinResult extends { join: infer J extends JoinClause; rest: infer Rest extends string }
    ? NextToken<Trim<Rest>> extends [infer Token extends string, infer _]
      ? Token extends JoinKeywords
        ? ParseJoinClauses<Rest, [...Acc, J]>
        : { joins: [...Acc, J]; rest: Rest }
      : { joins: [...Acc, J]; rest: Rest }
    : { joins: Acc; rest: T }
  : { joins: Acc; rest: T }

/**
 * Parse a single JOIN clause
 * Note: JoinClause<Type, Table, On> - Type comes first!
 */
type ParseSingleJoin<T extends string> = ParseJoinType<T> extends [
  infer JType extends JoinType,
  infer AfterType extends string,
]
  ? NextToken<AfterType> extends ["JOIN", infer AfterJoin extends string]
    ? ExtractUntil<AfterJoin, "ON" | JoinKeywords | "WHERE" | "RETURNING"> extends [
        infer TablePart extends string,
        infer Rest extends string,
      ]
      ? NextToken<Rest> extends ["ON", infer AfterOn extends string]
        ? ExtractUntil<AfterOn, JoinKeywords | "WHERE" | "RETURNING"> extends [
            infer Condition extends string,
            infer FinalRest extends string,
          ]
          ? {
              join: JoinClause<
                JType,
                ParseTableRef<Trim<TablePart>>,
                ParsedCondition<ScanTokensForColumnRefs<Trim<Condition>, []>>
              >
              rest: FinalRest
            }
          : {
              join: JoinClause<
                JType,
                ParseTableRef<Trim<TablePart>>,
                ParsedCondition<ScanTokensForColumnRefs<Trim<AfterOn>, []>>
              >
              rest: ""
            }
        : // CROSS JOIN doesn't have ON
          JType extends "CROSS"
            ? {
                join: JoinClause<JType, ParseTableRef<Trim<TablePart>>, undefined>
                rest: Rest
              }
            : never
      : never
    : // Handle just "JOIN" without type prefix
      T extends `JOIN ${infer AfterJoin}`
        ? ExtractUntil<AfterJoin, "ON" | JoinKeywords | "WHERE" | "RETURNING"> extends [
            infer TablePart extends string,
            infer Rest extends string,
          ]
          ? NextToken<Rest> extends ["ON", infer AfterOn extends string]
            ? ExtractUntil<AfterOn, JoinKeywords | "WHERE" | "RETURNING"> extends [
                infer Condition extends string,
                infer FinalRest extends string,
              ]
              ? {
                  join: JoinClause<
                    "INNER",
                    ParseTableRef<Trim<TablePart>>,
                    ParsedCondition<ScanTokensForColumnRefs<Trim<Condition>, []>>
                  >
                  rest: FinalRest
                }
              : {
                  join: JoinClause<
                    "INNER",
                    ParseTableRef<Trim<TablePart>>,
                    ParsedCondition<ScanTokensForColumnRefs<Trim<AfterOn>, []>>
                  >
                  rest: ""
                }
            : never
          : never
        : never
  : never

/**
 * Parse JOIN type (INNER, LEFT, RIGHT, FULL, CROSS)
 */
type ParseJoinType<T extends string> = NextToken<T> extends [
  infer Token extends string,
  infer Rest extends string,
]
  ? Token extends "INNER"
    ? ["INNER", Rest]
    : Token extends "LEFT"
      ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
        ? ["LEFT", AfterOuter]
        : ["LEFT", Rest]
      : Token extends "RIGHT"
        ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
          ? ["RIGHT", AfterOuter]
          : ["RIGHT", Rest]
        : Token extends "FULL"
          ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
            ? ["FULL", AfterOuter]
            : ["FULL", Rest]
          : Token extends "CROSS"
            ? ["CROSS", Rest]
            : Token extends "JOIN"
              ? ["INNER", T]  // Plain "JOIN" means INNER JOIN, don't consume token
              : never
  : never

/**
 * Parse a list of table references
 */
type ParseTableList<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [ParseTableRef<Trim<First>>, ...ParseTableList<Rest>]
  : []

// ============================================================================
// WHERE Clause Parser
// ============================================================================

/**
 * Parse WHERE clause
 */
type ParseWhere<T extends string> = Trim<T> extends ""
  ? { where: undefined; rest: "" }
  : NextToken<T> extends ["WHERE", infer Rest extends string]
    ? ExtractUntil<Rest, "RETURNING"> extends [
        infer WherePart extends string,
        infer Remaining extends string,
      ]
      ? { where: ParsedCondition<ScanTokensForColumnRefs<Trim<WherePart>, []>>; rest: Remaining }
      : { where: ParsedCondition<ScanTokensForColumnRefs<Trim<Rest>, []>>; rest: "" }
    : { where: undefined; rest: T }

/**
 * Scan tokens for column references
 */
type ScanTokensForColumnRefs<
  T extends string,
  Acc extends ValidatableColumnRef[]
> = Trim<T> extends ""
  ? Acc
  : NextToken<Trim<T>> extends [infer Token extends string, infer Rest extends string]
    ? ExtractColumnFromToken<Token> extends infer ColRef
      ? [ColRef] extends [never]
        ? ScanTokensForColumnRefs<Rest, Acc>
        : ColRef extends ValidatableColumnRef
          ? ScanTokensForColumnRefs<Rest, [...Acc, ColRef]>
          : ScanTokensForColumnRefs<Rest, Acc>
      : ScanTokensForColumnRefs<Rest, Acc>
    : Acc

/**
 * Try to extract a column reference from a token
 */
type ExtractColumnFromToken<T extends string> =
  T extends `${infer Table}.${infer Col}`
    ? IsSimpleIdentifier<Table> extends true
      ? IsSimpleIdentifier<Col> extends true
        ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Col>, undefined>
        : never
      : never
    : T extends `"${infer Table}"."${infer Col}"`
      ? TableColumnRef<Table, Col, undefined>
      : IsSimpleIdentifier<T> extends true
        ? IsKeywordOrOperator<T> extends true
          ? never
          : UnboundColumnRef<RemoveQuotes<T>>
        : T extends `"${infer Col}"`
          ? UnboundColumnRef<Col>
          : never

/**
 * Check if a string is a simple identifier
 */
type IsSimpleIdentifier<T extends string> = 
  T extends "" ? false :
  T extends `${string} ${string}` ? false :
  T extends "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" | "'" ? false :
  true

/**
 * Check if a token is a SQL keyword or operator
 */
type IsKeywordOrOperator<T extends string> =
  T extends `'${string}'` ? true :
  T extends "SELECT" | "FROM" | "WHERE" | "AND" | "OR" | "NOT" | "IN" | "IS" | "NULL"
    | "TRUE" | "FALSE" | "LIKE" | "ILIKE" | "BETWEEN" | "EXISTS" | "UPDATE" | "SET"
    | "RETURNING" | "DEFAULT" | "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" ? true :
  T extends `$${number}` | `$${string}` | `:${string}` ? true :
  T extends `${number}` ? true :
  false

// ============================================================================
// RETURNING Clause Parser (PostgreSQL 17+ OLD/NEW support)
// ============================================================================

/**
 * Parse RETURNING clause
 * Supports: RETURNING *, RETURNING col, RETURNING OLD.*, RETURNING NEW.col, etc.
 */
type ParseReturning<T extends string> = Trim<T> extends ""
  ? { returning: undefined; rest: "" }
  : NextToken<T> extends ["RETURNING", infer Rest extends string]
    ? Trim<Rest> extends "*"
      ? { returning: ReturningClause<"*">; rest: "" }
      : ParseReturningItems<Rest> extends infer Result
        ? Result extends { items: infer Items extends ReturningItem[]; rest: infer AfterItems extends string }
          ? { returning: ReturningClause<Items>; rest: AfterItems }
          : Result
        : never
    : { returning: undefined; rest: T }

/**
 * Parse RETURNING items list (columns, OLD/NEW references)
 */
type ParseReturningItems<T extends string> = 
  SplitByComma<Trim<T>> extends infer Parts extends string[]
    ? { items: ParseReturningItemList<Parts>; rest: "" }
    : { items: []; rest: "" }

/**
 * Parse list of RETURNING items
 */
type ParseReturningItemList<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [ParseSingleReturningItem<Trim<First>>, ...ParseReturningItemList<Rest>]
  : []

/**
 * Parse a single RETURNING item
 * Handles: column, OLD.column, NEW.column, OLD.*, NEW.*
 */
type ParseSingleReturningItem<T extends string> = 
  // OLD.* or NEW.*
  T extends "OLD.*"
    ? QualifiedWildcard<"OLD">
    : T extends "NEW.*"
      ? QualifiedWildcard<"NEW">
      // OLD.column
      : T extends `OLD.${infer Col}`
        ? QualifiedColumnRef<RemoveQuotes<Col>, "OLD">
        // NEW.column
        : T extends `NEW.${infer Col}`
          ? QualifiedColumnRef<RemoveQuotes<Col>, "NEW">
          // Unqualified column (backwards compatible)
          : UnboundColumnRef<RemoveQuotes<T>>

// ============================================================================
// Table Reference Parser
// ============================================================================

/**
 * Parse a table reference with optional schema and alias
 */
type ParseTableRef<T extends string> = 
  Trim<T> extends `${infer SchemaTable} AS ${infer Alias}`
    ? ParseSchemaTable<SchemaTable> extends [infer Schema extends string | undefined, infer Table extends string]
      ? TableRef<Table, RemoveQuotes<Alias>, Schema>
      : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<Alias>, undefined>
    : Trim<T> extends `${infer SchemaTable} ${infer Alias}`
      ? Alias extends UpdateTerminators | "SET"
        ? ParseSchemaTable<SchemaTable> extends [infer Schema extends string | undefined, infer Table extends string]
          ? TableRef<Table, Table, Schema>
          : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<SchemaTable>, undefined>
        : ParseSchemaTable<SchemaTable> extends [infer Schema extends string | undefined, infer Table extends string]
          ? TableRef<Table, RemoveQuotes<Alias>, Schema>
          : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<Alias>, undefined>
      : ParseSchemaTable<T> extends [infer Schema extends string | undefined, infer Table extends string]
        ? TableRef<Table, Table, Schema>
        : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>

/**
 * Parse schema.table syntax
 */
type ParseSchemaTable<T extends string> = 
  Trim<T> extends `"${infer Schema}"."${infer Table}"`
    ? [Schema, Table]
    : Trim<T> extends `${infer Schema}."${infer Table}"`
      ? IsSimpleIdentifier<Schema> extends true
        ? [Schema, Table]
        : [undefined, RemoveQuotes<T>]
      : Trim<T> extends `"${infer Schema}".${infer Table}`
        ? IsSimpleIdentifier<Table> extends true
          ? [Schema, RemoveQuotes<Table>]
          : [undefined, RemoveQuotes<T>]
        : Trim<T> extends `${infer Schema}.${infer Table}`
          ? IsSimpleIdentifier<Schema> extends true
            ? IsSimpleIdentifier<Table> extends true
              ? [Schema, Table]
              : [undefined, RemoveQuotes<T>]
            : [undefined, RemoveQuotes<T>]
          : [undefined, RemoveQuotes<T>]

