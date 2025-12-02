/**
 * Type-level SQL DELETE parser
 *
 * This module handles parsing of DELETE queries specifically.
 * It uses shared utilities from common/ but maintains its own
 * execution tree for TypeScript performance.
 */

import type { DeleteClause, UsingClause, DeleteReturningClause, SQLDeleteQuery } from "./ast.js"

import type {
  TableRef,
  TableSource,
  UnboundColumnRef,
  ValidatableColumnRef,
  TableColumnRef,
  ParsedCondition,
  WhereExpr,
} from "../common/ast.js"

import type { NormalizeSQL, NextToken, ExtractUntil, SplitByComma } from "../common/tokenizer.js"

import type { Trim, ParseError, RemoveQuotes } from "../common/utils.js"

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse a SQL DELETE query string into an AST
 */
export type ParseDeleteSQL<T extends string> = ParseDeleteQuery<NormalizeSQL<T>>

/**
 * Parse a normalized DELETE query
 */
type ParseDeleteQuery<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "DELETE"
    ? ParseDeleteBody<Rest>
    : ParseError<`Expected DELETE, got: ${First}`>
  : ParseError<"Empty query">

// ============================================================================
// DELETE Body Parser
// ============================================================================

/**
 * Parse DELETE FROM table_name ...
 */
type ParseDeleteBody<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "FROM"
    ? ParseTableAndClauses<Rest>
    : ParseError<`Expected FROM after DELETE, got: ${First}`>
  : ParseError<"Expected FROM after DELETE">

/**
 * Parse table name and optional clauses (USING, WHERE, RETURNING)
 */
type ParseTableAndClauses<T extends string> = ExtractUntil<T, DeleteTerminators> extends [
  infer TablePart extends string,
  infer Rest extends string,
]
  ? ParseTableRef<TablePart> extends infer Table extends TableRef
    ? BuildDeleteClause<Table, Rest>
    : ParseError<"Invalid table reference">
  : ParseTableRef<T> extends infer Table extends TableRef
    ? BuildDeleteClause<Table, "">
    : ParseError<"Invalid table reference">

/**
 * Keywords that terminate the table name
 */
type DeleteTerminators = "USING" | "WHERE" | "RETURNING"

// ============================================================================
// Build Delete Clause with Optional Parts
// ============================================================================

/**
 * Build the complete DELETE clause by parsing remaining optional parts
 */
type BuildDeleteClause<Table extends TableRef, Rest extends string> =
  ParseUsing<Rest> extends infer UsingResult
    ? UsingResult extends { using: infer Using; rest: infer AfterUsing extends string }
      ? ParseWhere<AfterUsing> extends infer WhereResult
        ? WhereResult extends { where: infer Where; rest: infer AfterWhere extends string }
          ? ParseReturning<AfterWhere> extends infer ReturnResult
            ? ReturnResult extends {
                returning: infer Returning
                rest: infer _AfterReturn extends string
              }
              ? SQLDeleteQuery<
                  DeleteClause<
                    Table,
                    Using extends UsingClause ? Using : undefined,
                    Where extends WhereExpr ? Where : undefined,
                    Returning extends DeleteReturningClause ? Returning : undefined
                  >
                >
              : never
            : never
          : never
        : never
      : never
    : never

// ============================================================================
// USING Clause Parser
// ============================================================================

/**
 * Parse USING clause (PostgreSQL multi-table delete)
 */
type ParseUsing<T extends string> = Trim<T> extends ""
  ? { using: undefined; rest: "" }
  : NextToken<T> extends ["USING", infer Rest extends string]
    ? ParseUsingTables<Rest> extends infer Result
      ? Result extends {
          tables: infer Tables extends TableSource[]
          rest: infer AfterTables extends string
        }
        ? { using: UsingClause<Tables>; rest: AfterTables }
        : { using: undefined; rest: T }
      : { using: undefined; rest: T }
    : { using: undefined; rest: T }

/**
 * Parse tables in USING clause
 */
type ParseUsingTables<T extends string> = ExtractUntil<T, "WHERE" | "RETURNING"> extends [
  infer TablesPart extends string,
  infer Rest extends string,
]
  ? SplitByComma<Trim<TablesPart>> extends infer Parts extends string[]
    ? { tables: ParseTableList<Parts>; rest: Rest }
    : { tables: []; rest: Rest }
  : { tables: [ParseTableRef<T>]; rest: "" }

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
 * Scan tokens for column references (simplified - extracts identifiers)
 */
type ScanTokensForColumnRefs<T extends string, Acc extends ValidatableColumnRef[]> = Trim<
  T
> extends ""
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
 * Extract the base column from a JSON operator expression (recursively)
 */
type ExtractBaseColumnFromJsonExpr<T extends string> = T extends `${infer Base}->>${string}`
  ? ExtractBaseColumnFromJsonExpr<Base>
  : T extends `${infer Base}->${string}`
    ? ExtractBaseColumnFromJsonExpr<Base>
    : T extends `${infer Base}#>>${string}`
      ? ExtractBaseColumnFromJsonExpr<Base>
      : T extends `${infer Base}#>${string}`
        ? ExtractBaseColumnFromJsonExpr<Base>
        : T

/**
 * Check if the token contains a JSON operator
 */
type HasJsonOperator<T extends string> = T extends `${string}->>${string}`
  ? true
  : T extends `${string}->${string}`
    ? true
    : T extends `${string}#>>${string}`
      ? true
      : T extends `${string}#>${string}`
        ? true
        : false

/**
 * Try to extract a column reference from a token
 */
type ExtractColumnFromToken<T extends string> =
  // Pattern: table.column with JSON operator
  T extends `${infer Table}.${infer Rest}`
    ? HasJsonOperator<Rest> extends true
      ? IsSimpleIdentifier<Table> extends true
        ? ExtractBaseColumnFromJsonExpr<Rest> extends infer BaseCol extends string
          ? IsSimpleIdentifier<BaseCol> extends true
            ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<BaseCol>, undefined>
            : never
          : never
        : never
      : IsSimpleIdentifier<Table> extends true
        ? IsSimpleIdentifier<Rest> extends true
          ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Rest>, undefined>
          : never
        : never
    : T extends `"${infer Table}"."${infer Col}"`
      ? TableColumnRef<Table, Col, undefined>
      : // Pattern: column with JSON operator
        HasJsonOperator<T> extends true
        ? ExtractBaseColumnFromJsonExpr<T> extends infer BaseCol extends string
          ? IsSimpleIdentifier<BaseCol> extends true
            ? IsKeywordOrOperator<BaseCol> extends true
              ? never
              : UnboundColumnRef<RemoveQuotes<BaseCol>>
            : never
          : never
        : // Simple identifier
          IsSimpleIdentifier<T> extends true
          ? IsKeywordOrOperator<T> extends true
            ? never
            : UnboundColumnRef<RemoveQuotes<T>>
          : T extends `"${infer Col}"`
            ? UnboundColumnRef<Col>
            : never

/**
 * Check if a string is a simple identifier
 */
type IsSimpleIdentifier<T extends string> = T extends ""
  ? false
  : T extends `${string} ${string}`
    ? false
    : T extends "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" | "'"
      ? false
      : true

/**
 * Check if a token is a SQL keyword or operator
 */
type IsKeywordOrOperator<T extends string> = T extends `'${string}'`
  ? true
  : T extends
        | "SELECT"
        | "FROM"
        | "WHERE"
        | "AND"
        | "OR"
        | "NOT"
        | "IN"
        | "IS"
        | "NULL"
        | "TRUE"
        | "FALSE"
        | "LIKE"
        | "ILIKE"
        | "BETWEEN"
        | "EXISTS"
        | "DELETE"
        | "USING"
        | "RETURNING"
        | "="
        | "!="
        | "<>"
        | "<"
        | ">"
        | "<="
        | ">="
    ? true
    : T extends `$${number}` | `$${string}` | `:${string}`
      ? true
      : T extends `${number}`
        ? true
        : false

// ============================================================================
// RETURNING Clause Parser
// ============================================================================

/**
 * Parse RETURNING clause
 */
type ParseReturning<T extends string> = Trim<T> extends ""
  ? { returning: undefined; rest: "" }
  : NextToken<T> extends ["RETURNING", infer Rest extends string]
    ? Trim<Rest> extends "*"
      ? { returning: DeleteReturningClause<"*">; rest: "" }
      : ParseReturningColumns<Rest> extends infer Result
        ? Result extends {
            columns: infer Cols extends UnboundColumnRef[]
            rest: infer AfterCols extends string
          }
          ? { returning: DeleteReturningClause<Cols>; rest: AfterCols }
          : Result
        : never
    : { returning: undefined; rest: T }

/**
 * Parse RETURNING column list
 */
type ParseReturningColumns<T extends string> = SplitByComma<Trim<T>> extends infer Parts extends
  string[]
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
 * Parse a table reference with optional schema and alias
 */
type ParseTableRef<T extends string> =
  // Pattern: schema.table AS alias or schema.table alias
  Trim<T> extends `${infer SchemaTable} AS ${infer Alias}`
    ? ParseSchemaTable<SchemaTable> extends [
        infer Schema extends string | undefined,
        infer Table extends string,
      ]
      ? TableRef<Table, RemoveQuotes<Alias>, Schema>
      : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<Alias>, undefined>
    : Trim<T> extends `${infer SchemaTable} ${infer Alias}`
      ? Alias extends DeleteTerminators
        ? ParseSchemaTable<SchemaTable> extends [
            infer Schema extends string | undefined,
            infer Table extends string,
          ]
          ? TableRef<Table, Table, Schema>
          : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<SchemaTable>, undefined>
        : ParseSchemaTable<SchemaTable> extends [
              infer Schema extends string | undefined,
              infer Table extends string,
            ]
          ? TableRef<Table, RemoveQuotes<Alias>, Schema>
          : TableRef<RemoveQuotes<SchemaTable>, RemoveQuotes<Alias>, undefined>
      : ParseSchemaTable<T> extends [
            infer Schema extends string | undefined,
            infer Table extends string,
          ]
        ? TableRef<Table, Table, Schema>
        : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>

/**
 * Parse schema.table syntax
 */
type ParseSchemaTable<T extends string> = Trim<T> extends `"${infer Schema}"."${infer Table}"`
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

