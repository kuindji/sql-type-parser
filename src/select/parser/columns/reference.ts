/**
 * Column reference parsing utilities
 */

import type {
    ColumnRefType,
    TableColumnRef,
    UnboundColumnRef,
} from "../../../common/ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";
import type { IsSimpleIdentifier } from "./utils.js";

// ============================================================================
// Column Reference Parsing
// ============================================================================

/**
 * Parse a column reference (schema.table.column, table.column, or just column)
 */
export type ParseColumnRefType<T extends string> =
    // Check for three-part identifier: schema.table.column
    [ParseThreePartIdentifier<Trim<T>>] extends [never]
        ? ParseTwoOrOnePartIdentifier<T>
        : ParseThreePartIdentifier<Trim<T>> extends [
            infer Schema extends string,
            infer Table extends string,
            infer Col extends string,
        ] ? TableColumnRef<Table, Col, Schema>
        : ParseTwoOrOnePartIdentifier<T>;

/**
 * Parse two-part (table.column) or single-part (column) identifier
 */
type ParseTwoOrOnePartIdentifier<T extends string> =
    // Check for two-part identifier: table.column
    Trim<T> extends `${infer Table}.${infer Col}`
        ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Col>, undefined>
        // Single identifier: column
        : UnboundColumnRef<RemoveQuotes<T>>;

/**
 * Parse a three-part identifier: schema.table.column
 * Returns [schema, table, column] or never if not a three-part identifier
 */
export type ParseThreePartIdentifier<T extends string> =
    // Pattern: "schema"."table"."column"
    T extends `"${infer Schema}"."${infer Table}"."${infer Col}"`
        ? [Schema, Table, Col]
        // Pattern: "schema"."table".column
        : T extends `"${infer Schema}"."${infer Table}".${infer Col}`
            ? [Schema, Table, RemoveQuotes<Col>]
        // Pattern: "schema".table."column"
        : T extends `"${infer Schema}".${infer Table}."${infer Col}"`
            ? [Schema, RemoveQuotes<Table>, Col]
        // Pattern: "schema".table.column
        : T extends `"${infer Schema}".${infer Table}.${infer Col}`
            ? IsSimpleIdentifier<Table> extends true
                ? IsSimpleIdentifier<Col> extends true ? [Schema, Table, Col]
                : never
            : never
        // Pattern: schema."table"."column"
        : T extends `${infer Schema}."${infer Table}"."${infer Col}"`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table, Col]
            : never
        // Pattern: schema."table".column
        : T extends `${infer Schema}."${infer Table}".${infer Col}`
            ? IsSimpleIdentifier<Schema> extends true
                ? [Schema, Table, RemoveQuotes<Col>]
            : never
        // Pattern: schema.table."column"
        : T extends `${infer Schema}.${infer Table}."${infer Col}"`
            ? IsSimpleIdentifier<Schema> extends true
                ? IsSimpleIdentifier<Table> extends true
                    ? [Schema, Table, Col]
                : never
            : never
        // Pattern: schema.table.column (all unquoted)
        : T extends `${infer Part1}.${infer Part2}.${infer Part3}`
            ? IsSimpleIdentifier<Part1> extends true
                ? IsSimpleIdentifier<Part2> extends true
                    ? IsSimpleIdentifier<Part3> extends true
                        ? [Part1, Part2, Part3]
                    : never
                : never
            : never
        : never;
