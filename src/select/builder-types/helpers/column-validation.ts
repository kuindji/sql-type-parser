/**
 * Column Validation Types
 *
 * Type-level utilities for validating column references against schema.
 */

import type { DatabaseSchema } from "../../../common/schema.js";
import type { SchemaTables, TableNameOf } from "./schema-utils.js";
import type { AnyBuilderStateTag, BuilderStateTag } from "./state-tags.js";

// ============================================================================
// Column Validation Helpers
// ============================================================================

/**
 * Internal helper: base expression part of a column string (before first
 * whitespace). This intentionally ignores aliases and most expressions –
 * it's a lightweight approximation for validation only.
 */
export type ColumnBaseExpr<S extends string> = S extends
    `${infer Base} ${string}` ? Base
    : S;

/**
 * Internal helper: validate a single simple column against the current
 * builder state. This handles only:
 * - unqualified columns: "id"
 * - table-qualified: "users.id"
 * - schema + table + column: "public.users.id"
 *
 * More complex expressions are treated as valid to keep the validator shallow.
 */
export type SimpleColumnValid<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Col extends string,
> =
    // If we don't have a simple FROM context, skip validation.
    State["fromTable"] extends infer From extends TableNameOf<Schema>
        ? State["contextSQL"] extends infer C extends string
            ? C extends `${string}JOIN${string}` ? true
            : _SimpleColumnValidWithFrom<Schema, From, ColumnBaseExpr<Col>>
        : true
        : true;

export type _SimpleColumnValidWithFrom<
    Schema extends DatabaseSchema,
    From extends TableNameOf<Schema>,
    Expr extends string,
> =
    // Expressions with explicit casts (id::text, func(...)::type) – skip
    Expr extends `${string}::${string}` ? true
        // schema.table.column – validate directly against schema
        : Expr extends
            `${infer SchemaName}.${infer TableName}.${infer ColumnName}`
            ? SchemaName extends keyof Schema["schemas"]
                ? TableName extends keyof Schema["schemas"][SchemaName]
                    ? ColumnName extends
                        keyof Schema["schemas"][SchemaName][TableName] ? true
                    : `[SQL Error] Column '${ColumnName}' not found in '${SchemaName}.${TableName}'`
                : `[SQL Error] Table '${TableName}' not found in schema '${SchemaName}'`
            : `[SQL Error] Schema '${SchemaName}' not found`
        // table.column – only validate when table matches current FROM table
        : Expr extends `${infer TableName}.${infer ColumnName}`
            ? TableName extends From
                ? ColumnName extends keyof SchemaTables<Schema>[From] ? true
                : `[SQL Error] Column '${ColumnName}' not found in '${From}'`
            : true
        // unqualified column – validate against current FROM table
        : Expr extends string
            ? Expr extends keyof SchemaTables<Schema>[From] ? true
            : `[SQL Error] Column '${Expr}' not found in '${From}'`
        : true;

/**
 * Wrap a single column expression so that invalid columns produce a
 * descriptive string literal type that will not be assignable to the
 * original column string, surfacing an error at the call site.
 */
export type ValidColumn<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Col extends string,
> = SimpleColumnValid<Schema, State, Col> extends true ? Col
    : SimpleColumnValid<Schema, State, Col> & string;

/**
 * Wrap a column spec (string or readonly string[]) with ValidColumn.
 */
export type ValidColumns<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    ColSpec extends string | readonly string[],
> = ColSpec extends readonly string[] ? {
        [K in keyof ColSpec]: ColSpec[K] extends string
            ? ValidColumn<Schema, State, ColSpec[K]>
            : ColSpec[K];
    }
    : ColSpec extends string ? ValidColumn<Schema, State, ColSpec>
    : ColSpec;
