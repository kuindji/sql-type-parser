import type {
    ColumnRefType,
    CTEDefinition,
    JoinClause,
    OrderByItem,
    TableSource,
    WhereExpr,
} from "../../common/ast.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type { MatchError } from "../../common/utils.js";
import type { Flatten } from "../../common/utils.js";
import type { UnionQueryError } from "../../common/utils.js";
import type { SelectItem } from "../ast.js";
import type { UnionClause } from "../ast.js";
import type { ParseColumnList } from "../parser.js";
import type { ParseTableRef } from "../parser.js";
import type { BuilderStateTag } from "./helpers.js";
import type { BuilderSqlTag, IsUnionSqlError } from "./helpers.js";
import type { BuilderFullRow } from "./return-type.js";

// ============================================================================
// Core State Types
// ============================================================================

/**
 * Empty initial state for the SELECT builder.
 *
 * Mirrors the specification in BUILDER_SPECIFICATION.md.
 */
export type EmptyState = {
    select: {};
    from: undefined;
    joins: [];
    where: {};
    groupBy: {};
    having: {};
    orderBy: {};
    limit: undefined;
    offset: undefined;
    ctes: {};
    distinct: false;
    union: undefined;
};

/**
 * Join strictness levels used for replacement validation.
 *
 * Derived from JoinType but flattened to the minimal hierarchy used
 * by the builder (INNER > LEFT = RIGHT > FULL > CROSS).
 */
export type JoinStrictness = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";

/**
 * Main builder state interface for SELECT queries.
 *
 * All fields are purely type-level; runtime representation is added later.
 */
export interface SelectBuilderState {
    /**
     * Map of user-provided IDs to select item arrays.
     * ID-based replacement overwrites the array at the given key.
     */
    readonly select: { readonly [id: string]: SelectItem[]; };

    /** FROM clause source (table or derived table) */
    readonly from: TableSource | undefined;

    /**
     * Ordered list of JOIN clauses with metadata for replacement rules.
     */
    readonly joins: ReadonlyArray<{
        readonly id: string;
        readonly ast: JoinClause;
        readonly strictness: JoinStrictness;
        readonly optional: boolean;
    }>;

    /** WHERE clause fragments, keyed by ID */
    readonly where: { readonly [id: string]: WhereExpr; };

    /** GROUP BY fragments, keyed by ID */
    readonly groupBy: { readonly [id: string]: ColumnRefType[]; };

    /** HAVING clause fragments, keyed by ID */
    readonly having: { readonly [id: string]: WhereExpr; };

    /** ORDER BY fragments, keyed by ID */
    readonly orderBy: { readonly [id: string]: OrderByItem[]; };

    /** LIMIT value */
    readonly limit: number | undefined;

    /** OFFSET value */
    readonly offset: number | undefined;

    /** CTE definitions, keyed by ID */
    readonly ctes: { readonly [id: string]: CTEDefinition; };

    /** DISTINCT flag */
    readonly distinct: boolean;

    /** Union clause with another query (if any) */
    readonly union: UnionClause | undefined;
}

/**
 * Error state used when validation fails at the builder level.
 *
 * Matches MatchError<string> from common/utils for consistency, and
 * preserves the previous valid state for tooling.
 */
export type ErrorState = MatchError<string> & {
    readonly previousState: SelectBuilderState;
};

/**
 * Convenience union for "any" builder state.
 */
export type SelectBuilderAnyState = SelectBuilderState | ErrorState;

// ============================================================================
// Type-Level Helpers for State Transitions
// ============================================================================

type ToColumnArray<T> = T extends readonly (infer S extends string)[] ? S[]
    : T extends string ? [ T ]
    : string[];

type ParsedSelectItems<
    T extends string | readonly string[],
> = ParseColumnList<ToColumnArray<T>> extends infer R
    ? R extends SelectItem[] ? R
    : SelectItem[]
    : SelectItem[];

type WithFrom<
    State extends SelectBuilderState,
    Src extends string,
> = Flatten<
    State & {
        readonly from: ParseTableRef<Src>;
    }
>;

type WithSelect<
    State extends SelectBuilderState,
    Items extends SelectItem[],
    Id extends string | undefined,
> = Flatten<
    State & {
        readonly select:
            & State["select"]
            & (
                Id extends string ? { readonly [K in Id]: Items; }
                    : { readonly [k: string]: Items; }
            );
    }
>;

type MarkOptional<Item> = Item & { readonly optional: true; };

type OptionalizeItems<Items extends SelectItem[]> = {
    [K in keyof Items]: Items[K] extends SelectItem ? MarkOptional<Items[K]>
        : never;
};

type OptionalizeNewSelects<
    Before extends SelectBuilderState,
    After extends SelectBuilderState,
> = Flatten<
    After & {
        readonly select: {
            [K in keyof After["select"]]: K extends keyof Before["select"]
                ? Before["select"][K]
                : After["select"][K] extends SelectItem[]
                    ? OptionalizeItems<After["select"][K]>
                : After["select"][K];
        };
    }
>;

/**
 * Result type of builder `.toBrandedString()` branding.
 *
 * We keep the lightweight row accumulated in `BuilderStateTag["row"]`, but
 * enrich it with any additional columns that appear in the assembled SQL
 * fragments (for example, columns selected only inside `.when()` blocks),
 * using the existing `QueryResult` matcher.
 *
 * Returns UnionQueryError if a union type was detected during builder construction.
 */
export type BuilderResultType<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = IsUnionSqlError<Sql> extends true ? UnionQueryError
    : State["row"] extends UnionQueryError ? UnionQueryError
    :
        & Flatten<State["row"]>
        & {
            [
                K in Exclude<
                    keyof BuilderFullRow<Schema, Sql>,
                    keyof Flatten<State["row"]>
                >
            ]: BuilderFullRow<Schema, Sql>[K] | undefined;
        };
