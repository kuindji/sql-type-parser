/**
 * Type-level SQL SELECT FROM clause parser
 *
 * This module handles parsing of FROM clause including table references,
 * derived tables (subqueries), and schema-qualified tables.
 */

import type {
    TableRef,
} from "../../common/ast.js";

import type {
    ExtractUntil,
    FromTerminators,
    NextToken,
} from "../../common/tokenizer.js";

import type {
    ParseError,
    RemoveQuotes,
    Trim,
} from "../../common/utils.js";

import type { ExtractUntilClosingParen, IsSimpleIdentifier } from "./columns/index.js";

// ============================================================================
// FROM Clause Parser
// ============================================================================

/**
 * Parse FROM clause and return table + remaining query
 * Handles both regular tables and derived tables (subqueries)
 *
 * Note: Derived tables (subqueries) are handled by the main parser
 * which has access to the full ParseSelectQuery type.
 */
export type ParseFromClause<T extends string> = NextToken<T> extends [
    infer First extends string,
    infer Rest extends string,
]
    ? First extends "FROM"
        ? NextToken<Rest> extends ["(", infer AfterParen extends string]
            ? ParseDerivedTablePlaceholder<AfterParen>
        : ExtractUntil<Rest, FromTerminators> extends [
            infer TablePart extends string,
            infer Remaining extends string,
        ] ? { from: ParseTableRef<TablePart>; rest: Remaining; }
        : { from: ParseTableRef<Rest>; rest: ""; }
    : ParseError<`Expected FROM, got: ${First}`>
    : ParseError<"Missing FROM clause">;

/**
 * Parse a derived table (subquery in FROM clause)
 * Returns a placeholder that the main parser will properly handle
 */
export type ParseDerivedTablePlaceholder<T extends string> =
    ExtractUntilClosingParen<T, 1, ""> extends
        [infer QueryStr extends string, infer AfterParen extends string]
        ? ParseDerivedTableAlias<Trim<AfterParen>> extends {
            alias: infer Alias extends string;
            rest: infer Rest extends string;
        } ? {
            __derivedTable: true;
            queryStr: QueryStr;
            alias: Alias;
            rest: Rest;
        }
        : ParseError<"Derived table requires an alias">
        : ParseError<"Invalid derived table syntax">;

/**
 * Parse the alias after a derived table's closing parenthesis
 */
export type ParseDerivedTableAlias<T extends string> = NextToken<T> extends
    ["AS", infer AfterAS extends string]
    ? NextToken<AfterAS> extends
        [infer Alias extends string, infer Rest extends string]
        ? { alias: RemoveQuotes<Alias>; rest: Rest; }
    : ParseError<"Expected alias after AS">
    : NextToken<T> extends
        [infer First extends string, infer Rest extends string]
        ? First extends FromTerminators
            ? ParseError<"Derived table requires an alias">
        : { alias: RemoveQuotes<First>; rest: Rest; }
    : ParseError<"Expected alias for derived table">;

// ============================================================================
// Table Reference Parser
// ============================================================================

/**
 * Parse a table reference with optional schema and alias
 */
export type ParseTableRef<T extends string> = Trim<T> extends
    `${infer SchemaOrTable} AS ${infer Alias}`
    ? ParseSchemaTable<SchemaOrTable> extends
        [infer Schema extends string | undefined, infer Table extends string]
        ? TableRef<Table, RemoveQuotes<Alias>, Schema>
    : TableRef<RemoveQuotes<SchemaOrTable>, RemoveQuotes<Alias>, undefined>
    : Trim<T> extends `${infer SchemaOrTable} ${infer Alias}`
        ? Alias extends FromTerminators
            ? ParseSchemaTable<SchemaOrTable> extends [
                infer Schema extends string | undefined,
                infer Table extends string,
            ] ? TableRef<Table, Table, Schema>
            : TableRef<
                RemoveQuotes<SchemaOrTable>,
                RemoveQuotes<SchemaOrTable>,
                undefined
            >
        : ParseSchemaTable<SchemaOrTable> extends [
            infer Schema extends string | undefined,
            infer Table extends string,
        ] ? TableRef<Table, RemoveQuotes<Alias>, Schema>
        : TableRef<RemoveQuotes<SchemaOrTable>, RemoveQuotes<Alias>, undefined>
    : ParseSchemaTable<T> extends
        [infer Schema extends string | undefined, infer Table extends string]
        ? TableRef<Table, Table, Schema>
    : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>;

/**
 * Parse schema.table syntax, returns [schema, table] or [undefined, table]
 */
export type ParseSchemaTable<T extends string> =
    // Pattern: "schema"."table"
    Trim<T> extends `"${infer Schema}"."${infer Table}"` ? [Schema, Table]
        // Pattern: schema."table"
        : Trim<T> extends `${infer Schema}."${infer Table}"`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table]
            : [undefined, RemoveQuotes<T>]
        // Pattern: "schema".table
        : Trim<T> extends `"${infer Schema}".${infer Table}`
            ? IsSimpleIdentifier<Table> extends true
                ? [Schema, RemoveQuotes<Table>]
            : [undefined, RemoveQuotes<T>]
        // Pattern: schema.table (both unquoted)
        : Trim<T> extends `${infer Schema}.${infer Table}`
            ? IsSimpleIdentifier<Schema> extends true
                ? IsSimpleIdentifier<Table> extends true ? [Schema, Table]
                : [undefined, RemoveQuotes<T>]
            : [undefined, RemoveQuotes<T>]
        // No schema, just table
        : [undefined, RemoveQuotes<T>];
