/**
 * Column to Row Conversion Types
 *
 * Type-level utilities for converting column specifications to row types.
 */

import type { DatabaseSchema } from "../../../common/schema.js";
import type { Flatten, IsUnion } from "../../../common/utils.js";
import type { ColumnRow } from "./schema-utils.js";
import type {
    AnyBuilderStateTag,
    BuilderStateTag,
    UnionColumnsError,
} from "./state-tags.js";
import type { IsTuple, UnionToIntersection } from "./string-utils.js";

// ============================================================================
// Column Array to Row Conversion
// ============================================================================

/**
 * Convert an array of column strings to a row type.
 * Uses accumulator pattern with single flatten at the end for better performance.
 */
export type ColumnsArrayToRow<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Cols extends readonly string[],
    Acc = {},
> = Cols extends readonly [
    infer First extends string,
    ...infer Rest extends readonly string[],
] ? ColumnsArrayToRow<
        Schema,
        State,
        Rest,
        // NOTE: we intersect with ColumnRow<...> here, but do not try to
        // over‑optimize alias resolution at the type level; complex alias
        // cases fall back to whatever QueryResult can infer from contextSQL.
        Acc & ColumnRow<Schema, State, First>
    >
    : Flatten<Acc>; // Single flatten at the end

export type ColumnsToRow<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    ColSpec extends string | readonly string[],
> =
    // Single column selection.
    ColSpec extends string ? ColumnRow<Schema, State, ColSpec>
        // Tuple/readonly array of columns – map each entry to its column row and
        // intersect the results. For non-literal arrays we deliberately fall
        // back to per-entry union via ColumnRow instead of dropping typing.
        : ColSpec extends readonly (infer S extends string)[]
            ? IsTuple<ColSpec> extends true
                ? ColumnsArrayToRow<Schema, State, ColSpec>
            : UnionToIntersection<ColumnRow<Schema, State, S>>
        : {};

// ============================================================================
// Add Columns to State
// ============================================================================

/**
 * Internal helper that adds columns to the builder state.
 * Does not check for unions - use AddColumnsForSchema instead.
 */
type AddColumnsForSchemaInternal<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    ColSpec extends string | readonly string[],
> = BuilderStateTag<
    State["fromTable"],
    State["row"] & ColumnsToRow<Schema, State, ColSpec>,
    State["contextSQL"]
>;

/**
 * Add columns to the builder state, with union type detection.
 *
 * When ColSpec is a union type (e.g., from template literals with union interpolations
 * like `"GBP" | "USD"`), this returns UnionColumnsError early to prevent
 * exponential type computation from TypeScript distributing over the union.
 *
 * Users should cast such values to `string` to bypass type checking, or use
 * a single literal value.
 */
export type AddColumnsForSchema<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    ColSpec extends string | readonly string[],
> = IsUnion<ColSpec> extends true ? UnionColumnsError
    : AddColumnsForSchemaInternal<Schema, State, ColSpec>;
