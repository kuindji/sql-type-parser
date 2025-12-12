import type { DatabaseSchema } from "../../common/schema.js";
import type {
    Flatten,
    MatchError,
    UnionQueryError,
} from "../../common/utils.js";
import type { SelectQueryBuilder } from "./builder.js";
import type {
    AnyBuilderSqlTag,
    AssembleBuilderSql,
    BuilderSqlTag,
    BuilderStateTag,
    ColumnsArrayToRow,
    ContextSqlFromTag,
    IsUnionSqlError,
    SelectClauseString,
} from "./helpers.js";
import type {
    BuilderTablesValid,
    LightweightTablesValid,
} from "./validation.js";

/**
 * Distributing wrapper for AssembleBuilderSql.
 * When Sql is a union, this distributes over each member.
 */
type AssembleBuilderSqlDistributive<
    Sql extends AnyBuilderSqlTag,
> = Sql extends AnyBuilderSqlTag ? AssembleBuilderSql<Sql> : never;

/**
 * Extract the assembled SQL string literal for a given builder type.
 */
export type BuilderSQL<B> = B extends SelectQueryBuilder<
    any,
    any,
    infer Sql extends AnyBuilderSqlTag
> ? AssembleBuilderSqlDistributive<Sql>
    : never;

/** Helper: base row from the lightweight state tag. */
type BuilderBaseRow<State extends BuilderStateTag<any, any, any>> = Flatten<
    State["row"]
>;

/** Split a comma-separated SELECT list into individual column expressions. */
type SplitSelectList<S extends string> = S extends
    `${infer First}, ${infer Rest}` ? [ First, ...SplitSelectList<Rest> ]
    : [ S ];

/** Map a SELECT list string into a row type using ColumnRow. */
type SelectListToRow<
    Schema extends DatabaseSchema,
    Sel extends string,
    ContextSQL extends string | undefined = undefined,
> = SplitSelectList<Sel> extends infer Cols extends readonly string[]
    ? ColumnsArrayToRow<Schema, BuilderStateTag<any, any, ContextSQL>, Cols>
    : {};

/** Helper: row inferred from the assembled SELECT fragment. */
export type BuilderFullRow<
    Schema extends DatabaseSchema,
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
    : SelectClauseString<Sql> extends infer Sel extends string
        ? SelectListToRow<Schema, Sel, ContextSqlFromTag<Sql>>
    : {};

type BuilderReturnForParts<
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
    : BuilderTablesValid<Schema, Sql> extends true ? Flatten<State["row"]>
    : MatchError<BuilderTablesValid<Schema, Sql> & string>;

/**
 * Result type of the builder query string.
 *
 * Uses lightweight extraction of only the from/joins fields needed for
 * table validation, avoiding deep type instantiation of complex Sql tags.
 *
 * Returns UnionQueryError if the Sql tag indicates a union type was detected.
 */
export type BuilderReturnType<B> = B extends SelectQueryBuilder<
    infer Schema extends DatabaseSchema,
    infer State extends BuilderStateTag<any, any, any>,
    infer Sql extends AnyBuilderSqlTag
> ? IsUnionSqlError<Sql> extends true ? UnionQueryError
    : LightweightTablesValid<Schema, Sql["from"], Sql["joins"]> extends true
        ? Flatten<State["row"]>
    : MatchError<
        LightweightTablesValid<Schema, Sql["from"], Sql["joins"]> & string
    >
    : never;

/**
 * Internal helper: branded result type for `.toBrandedString()`.
 *
 * It reuses the lightweight row stored on the BuilderStateTag. Table-level
 * errors (FROM/JOIN) are surfaced as a MatchError on the branded `__type`.
 */
export type BuilderResultBrand<
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
> = BuilderReturnForParts<Schema, State, Sql>;
