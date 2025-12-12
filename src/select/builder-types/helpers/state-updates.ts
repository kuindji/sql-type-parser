/**
 * State Update Types
 *
 * Type-level utilities for updating builder state (FROM, JOIN, etc.).
 */

import type { DatabaseSchema } from "../../../common/schema.js";
import type { ParseTableRef } from "../../parser.js";
import type { SelectQueryBuilder } from "../builder.js";
import type { TableNameOf } from "./schema-utils.js";
import type { AnyBuilderStateTag, BuilderStateTag } from "./state-tags.js";

// ============================================================================
// FROM State Updates
// ============================================================================

export type WithFromForSchema<
    Schema extends DatabaseSchema,
    State extends AnyBuilderStateTag,
    Src,
> = Src extends string
    ? ParseTableRef<Src> extends infer Ref
        ? Ref extends { table: infer T extends string; }
            ? T extends TableNameOf<Schema> ? BuilderStateTag<
                    T,
                    State["row"],
                    `FROM ${Src}`
                >
            : BuilderStateTag<
                State["fromTable"],
                State["row"],
                `FROM ${Src}`
            >
        : BuilderStateTag<
            State["fromTable"],
            State["row"],
            `FROM ${Src}`
        >
    : BuilderStateTag<
        State["fromTable"],
        State["row"],
        `FROM ${Src}`
    >
    // FROM (subquery) - the subquery SQL is not visible at the type level
    // (only `string` from toString), so we conservatively leave contextSQL
    // as-is. Column typing for subqueries is future work for a heavier
    // builder state.
    : Src extends SelectQueryBuilder<
        Schema,
        infer SubState extends AnyBuilderStateTag,
        any
    > ? BuilderStateTag<
            SubState["fromTable"],
            State["row"],
            State["contextSQL"]
        >
    : State;

// ============================================================================
// JOIN State Updates
// ============================================================================

export type WithJoinContext<
    State extends AnyBuilderStateTag,
    JoinSql extends string,
> = BuilderStateTag<
    State["fromTable"],
    State["row"],
    State["contextSQL"] extends string ? `${State["contextSQL"]} ${JoinSql}`
        : JoinSql
>;
