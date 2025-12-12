/**
 * Wildcard parsing utilities (*, table.*, schema.table.*)
 */

import type { TableWildcard } from "../../../common/ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";
import type { IsSimpleIdentifier } from "./utils.js";

// ============================================================================
// Wildcard Parsing
// ============================================================================

/**
 * Check if this is a table.* or alias.* or schema.table.* pattern
 */
export type IsTableWildcard<T extends string> = Trim<T> extends `${string}.*`
    ? true
    : Trim<T> extends `${string}. *` ? true
    : false;

/**
 * Parse a table.* or schema.table.* wildcard into a TableWildcard type
 */
export type ParseTableWildcard<T extends string> =
    // Check for schema.table.* pattern first
    [ParseSchemaTableWildcard<Trim<T>>] extends [never]
        ? ParseSimpleTableWildcard<T>
        : ParseSchemaTableWildcard<Trim<T>> extends
            [infer Schema extends string, infer Table extends string]
            ? TableWildcard<Table, Schema>
        : ParseSimpleTableWildcard<T>;

/**
 * Parse simple table.* pattern (no schema)
 */
type ParseSimpleTableWildcard<T extends string> = Trim<T> extends
    `${infer Table}.*` ? TableWildcard<RemoveQuotes<Table>, undefined>
    : Trim<T> extends `${infer Table}. *`
        ? TableWildcard<RemoveQuotes<Table>, undefined>
    : never;

/**
 * Parse schema.table.* pattern, returns [schema, table] or never
 */
type ParseSchemaTableWildcard<T extends string> =
    // Pattern: "schema"."table".*
    T extends `"${infer Schema}"."${infer Table}".*` ? [Schema, Table]
        : T extends `"${infer Schema}"."${infer Table}". *` ? [Schema, Table]
        // Pattern: "schema".table.*
        : T extends `"${infer Schema}".${infer Table}.*`
            ? IsSimpleIdentifier<Table> extends true ? [Schema, Table]
            : never
        : T extends `"${infer Schema}".${infer Table}. *`
            ? IsSimpleIdentifier<Table> extends true ? [Schema, Table]
            : never
        // Pattern: schema."table".*
        : T extends `${infer Schema}."${infer Table}".*`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table]
            : never
        : T extends `${infer Schema}."${infer Table}". *`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table]
            : never
        // Pattern: schema.table.* (check it has exactly 2 dots before *)
        : T extends `${infer Part1}.${infer Part2}.*`
            ? IsSimpleIdentifier<Part1> extends true
                ? Part2 extends `${string}.${string}` ? never // More than 2 parts, not schema.table.*
                : IsSimpleIdentifier<Part2> extends true ? [Part1, Part2]
                : never
            : never
        : T extends `${infer Part1}.${infer Part2}. *`
            ? IsSimpleIdentifier<Part1> extends true
                ? Part2 extends `${string}.${string}` ? never
                : IsSimpleIdentifier<Part2> extends true ? [Part1, Part2]
                : never
            : never
        : never;
