/**
 * String Manipulation Utilities
 *
 * Type-level utilities for parsing and manipulating SQL string fragments.
 */

import type { MapSQLTypeToTS } from "../../../common/ast.js";

/**
 * Helper to detect literal string types (as opposed to plain `string`).
 */
export type IsLiteralString<T> = T extends string
    ? string extends T ? false : true
    : false;

/** Detect `unknown` specifically (not just assignable to unknown). */
export type IsUnknown<T> = unknown extends T ? [T] extends [unknown] ? true
    : false
    : false;

export type TrimStr<S extends string> = S extends ` ${infer T}` ? TrimStr<T>
    : S extends `${infer T} ` ? TrimStr<T>
    : S;

export type FirstToken<S extends string> = TrimStr<S> extends
    `${infer Head} ${string}` ? Head
    : TrimStr<S>;

// ============================================================================
// Cast Handling
// ============================================================================

/** Strip simple PostgreSQL-style casts (`expr::type`). */
export type StripCast<S extends string> = S extends `${infer Base}::${string}`
    ? Base
    : S;

export type StripAliasFromCast<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${string}` ? StripAliasFromCast<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${string}`
        ? StripAliasFromCast<TrimStr<Before>>
    : S;

export type StripCastParams<S extends string> = S extends
    `${infer Base}(${string})` ? Base
    : S;

export type NormalizeCastTarget<S extends string> = Lowercase<
    StripCastParams<FirstToken<StripAliasFromCast<TrimStr<S>>>>
>;

/**
 * Extract the final (outermost) cast type from an expression.
 * The naive pattern `${string}::${infer Cast}` matches the FIRST ::,
 * but we need the LAST one for expressions like `sum(x::int)::float8`.
 */
export type ExtractFinalCast<S extends string> = S extends
    `${string}::${infer After}`
    ? After extends `${string}::${infer _Deeper}` ? ExtractFinalCast<After>
    : After
    : undefined;

export type CastTarget<Expr extends string> = ExtractFinalCast<Expr> extends
    infer Cast extends string ? NormalizeCastTarget<Cast>
    : Expr extends `CAST(${string} AS ${infer Cast})${string}`
        ? NormalizeCastTarget<Cast>
    : undefined;

export type CastReturnType<Cast extends string> = MapSQLTypeToTS<Cast> extends
    infer M ? IsUnknown<M> extends true ? string
    : M
    : string;

// ============================================================================
// Identifier Handling
// ============================================================================

/**
 * Remove surrounding double quotes from an identifier segment.
 * Keeps the inner content intact so case-sensitive names survive.
 */
export type StripIdentifierQuotes<S extends string> = S extends
    `"${infer Inner}"` ? Inner
    : S;

// ============================================================================
// Alias Extraction
// ============================================================================

export type ExtractAlias<S extends string> = TrimStr<S> extends
    `${infer _Before} AS ${infer After}`
    ? ExtractAlias<TrimStr<After>> extends infer Alias extends string ? Alias
    : TrimStr<After>
    : TrimStr<S> extends `${infer _Before} as ${infer After}`
        ? ExtractAlias<TrimStr<After>> extends infer Alias extends string
            ? Alias
        : TrimStr<After>
    : undefined;

export type ExprWithoutAlias<S extends string> = TrimStr<S> extends
    `${infer Before} AS ${infer _After}` ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S> extends `${infer Before} as ${infer _After}`
        ? ExprWithoutAlias<TrimStr<Before>>
    : TrimStr<S>;

export type SplitAlias<S extends string> = [
    ExprWithoutAlias<S>,
    ExtractAlias<S>,
];

export type StripAliasIdentifier<S extends string> = S extends
    `${infer _Expr} AS ${infer Alias}` ? TrimStr<Alias>
    : S;

/** Extract the final identifier part of a column expression (alias wins). */
export type ExtractColumnIdentifier<S extends string> = SplitAlias<S> extends [
    infer Expr extends string,
    infer Alias extends string | undefined,
] ? Alias extends string ? StripIdentifierQuotes<Alias>
    : StripIdentifierQuotes<
        StripCast<Expr> extends `${string}.${infer Tail}` ? Tail
            : StripCast<Expr>
    >
    : StripIdentifierQuotes<StripCast<S>>;

// ============================================================================
// Array/Tuple Utilities
// ============================================================================

export type IsTuple<T extends readonly any[]> = number extends T["length"]
    ? false
    : true;

/**
 * Convert a union of types into an intersection (A | B -> A & B).
 * Used to merge column rows derived from non-tuple string arrays.
 */
export type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;

export type ToStringArray<T extends string | readonly string[]> =
    // Preserve tuple shapes to keep literal ordering for SQL reconstruction.
    T extends
        readonly [infer First extends string, ...infer Rest extends string[]]
        ? [First, ...Rest]
        : T extends readonly (infer S extends string)[] ? S[]
        : [T];

export type ColumnQuery<
    State extends { contextSQL: string | undefined; },
    Col extends string,
> = State["contextSQL"] extends string ? `SELECT ${Col} ${State["contextSQL"]}`
    : never;
