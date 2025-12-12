import type {
    ConditionTreeBuilder,
    QueryParamValue,
} from "../common/builder.js";
import type { DatabaseSchema } from "../common/schema.js";
import { assembleSelectSQL } from "./builder-runtime/assemble-select-sql.js";
import { EMPTY_RUNTIME_STATE } from "./builder-runtime/emptyState.js";
import type {
    RuntimeSelectState,
    SelectQueryBuilder,
    UntypedSelectBuilder,
} from "./builder-types/builder.js";
import type {
    AddColumnsForSchema,
    AnyBuilderSqlTag,
    BuilderSqlTag,
    BuilderStateTag,
    EmptyBuilderState,
    EmptySqlState,
    StateFromSql,
    WithFromForSchema,
    WithFromSql,
    WithGroupBySql,
    WithHavingSql,
    WithJoinContext,
    WithJoinSql,
    WithLimitSql,
    WithOffsetSql,
    WithOrderBySql,
    WithoutJoinSql,
    WithoutSelectSql,
    WithSelectSql,
    WithWhereSql,
} from "./builder-types/helpers.js";
import type { BuilderResultBrand } from "./builder-types/return-type.js";
import type { JoinStrictness } from "./builder-types/state.js";

/**
 * Entry point for creating a new SELECT builder.
 *
 * Schema is a generic-only parameter; there is no runtime schema value.
 */
export function createSelectQuery<
    Schema extends DatabaseSchema,
>(): SelectQueryBuilder<Schema, EmptyBuilderState, EmptySqlState> {
    return new SelectQueryBuilderImpl<
        Schema,
        BuilderStateTag<any, any, any>,
        EmptySqlState
    >(
        EMPTY_RUNTIME_STATE,
    ) as unknown as SelectQueryBuilder<
        Schema,
        EmptyBuilderState,
        EmptySqlState
    >;
}

/**
 * Create an untyped SELECT query builder.
 *
 * @template Result - The expected result row type (you declare this upfront)
 *
 * @example
 * ```ts
 * interface OrderSummary {
 *     orderId: number;
 *     customerName: string;
 *     total: number;
 * }
 *
 * const query = createUntypedQuery<OrderSummary>()
 *     .from("orders o")
 *     .join("LEFT JOIN customers c ON c.id = o.customer_id")
 *     .select(["o.id AS orderId", "c.name AS customerName", "o.total"])
 *     .where("o.status = 'completed'");
 *
 * // query.toString() works as expected
 * // Type is UntypedSelectBuilder<OrderSummary>
 * ```
 */
export function createUntypedQuery<
    Result = unknown,
>(): UntypedSelectBuilder<Result> {
    // Reuse the same runtime implementation – just cast the type
    return new SelectQueryBuilderImpl<any, any, any>(
        EMPTY_RUNTIME_STATE,
    ) as unknown as UntypedSelectBuilder<Result>;
}

export const createUntypedSelectQuery = createUntypedQuery;

/**
 * Internal concrete implementation. Methods always return a new instance
 * to preserve immutability and allow type-level State to progress.
 */
class SelectQueryBuilderImpl<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends AnyBuilderSqlTag = EmptySqlState,
> {
    readonly _state: RuntimeSelectState;

    constructor(state?: RuntimeSelectState) {
        this._state = state ?? EMPTY_RUNTIME_STATE;
    }

    // -----------------------------------------------------------------------
    // Immutable state cloning helper
    // -----------------------------------------------------------------------

    private clone(patch: Partial<RuntimeSelectState>): RuntimeSelectState {
        return {
            ...this._state,
            ...patch,
        };
    }

    // -----------------------------------------------------------------------
    // Core builder methods
    // -----------------------------------------------------------------------

    select<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        AddColumnsForSchema<Schema, State, Cols>,
        WithSelectSql<Sql, Cols, Id>
    > {
        const rawCols = Array.isArray(columns)
            ? (columns as readonly string[])
            : [ columns as string ];
        // Keep all provided columns for runtime SQL so array selects are fully
        // rendered; type-level typing continues to use AddColumnsForSchema.
        const cols = rawCols.length > 0 ? [ ...rawCols ] : [];
        const key = (id as string | undefined)
            ?? `select_${Object.keys(this._state.selectSql).length.toString()}`;

        const nextSelectSql: RuntimeSelectState["selectSql"] = {
            ...this._state.selectSql,
            [key]: cols,
        };

        const nextState = this.clone({ selectSql: nextSelectSql });
        return new SelectQueryBuilderImpl<
            Schema,
            AddColumnsForSchema<Schema, State, Cols>,
            WithSelectSql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            AddColumnsForSchema<Schema, State, Cols>,
            WithSelectSql<Sql, Cols, Id>
        >;
    }

    from<
        Src extends
            | string
            | SelectQueryBuilder<
                Schema,
                BuilderStateTag<any, any, any>,
                any
            >,
    >(
        source: Src,
    ): SelectQueryBuilder<
        Schema,
        WithFromForSchema<Schema, State, Src>,
        WithFromSql<Sql, Src>
    > {
        let fromSql: string | undefined;
        if (typeof source === "string") {
            fromSql = source;
        }
        else {
            // Runtime subquery: we only embed the SQL string; type-level
            // typing for subqueries is handled separately via QueryResult
            // when using string-based APIs.
            fromSql = `(${source.toString()})`;
        }
        const nextState = this.clone({ fromSql });
        return new SelectQueryBuilderImpl<
            Schema,
            WithFromForSchema<Schema, State, Src>,
            WithFromSql<Sql, Src>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            WithFromForSchema<Schema, State, Src>,
            WithFromSql<Sql, Src>
        >;
    }

    where<Cond extends string | ConditionTreeBuilder>(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithWhereSql<Sql, Cond>> {
        const key = id
            ?? `where_${Object.keys(this._state.whereSql).length.toString()}`;
        const sql = typeof condition === "string"
            ? condition
            : condition.toString();

        const nextWhereSql: RuntimeSelectState["whereSql"] = {
            ...this._state.whereSql,
            [key]: sql,
        };

        const nextState = this.clone({ whereSql: nextWhereSql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithWhereSql<Sql, Cond>
        >(nextState) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithWhereSql<Sql, Cond>
        >;
    }

    groupBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithGroupBySql<Sql, Cols, Id>> {
        const rawCols = Array.isArray(columns) ? [ ...columns ] : [ columns ];
        const key = id
            ?? `group_${Object.keys(this._state.groupBySql).length.toString()}`;

        const nextGroupBySql: RuntimeSelectState["groupBySql"] = {
            ...this._state.groupBySql,
            [key]: rawCols.join(", "),
        };

        const nextState = this.clone({ groupBySql: nextGroupBySql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithGroupBySql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithGroupBySql<Sql, Cols, Id>
        >;
    }

    having<Cond extends string | ConditionTreeBuilder>(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithHavingSql<Sql, Cond>> {
        const key = id
            ?? `having_${Object.keys(this._state.havingSql).length.toString()}`;
        const sql = typeof condition === "string"
            ? condition
            : condition.toString();

        const nextHavingSql: RuntimeSelectState["havingSql"] = {
            ...this._state.havingSql,
            [key]: sql,
        };

        const nextState = this.clone({ havingSql: nextHavingSql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithHavingSql<Sql, Cond>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithHavingSql<Sql, Cond>
        >;
    }

    orderBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithOrderBySql<Sql, Cols, Id>> {
        const rawCols = Array.isArray(columns) ? [ ...columns ] : [ columns ];
        const key = id
            ?? `order_${Object.keys(this._state.orderBySql).length.toString()}`;

        const nextOrderBySql: RuntimeSelectState["orderBySql"] = {
            ...this._state.orderBySql,
            [key]: rawCols.join(", "),
        };

        const nextState = this.clone({ orderBySql: nextOrderBySql });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithOrderBySql<Sql, Cols, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithOrderBySql<Sql, Cols, Id>
        >;
    }

    join<
        JoinSql extends string,
        Id extends string | undefined = undefined,
    >(
        joinSql: JoinSql,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        WithJoinContext<State, JoinSql>,
        WithJoinSql<Sql, JoinSql, Id>
    > {
        const key = id
            ?? `join_${this._state.joins.length.toString()}`;

        const nextJoinSql: RuntimeSelectState["joinSql"] = {
            ...this._state.joinSql,
            [key]: joinSql,
        };

        const existing = this._state.joins.find(j => j.id === key);
        const newEntry = existing ?? {
            id: key,
            ast: undefined as any,
            strictness: "INNER" as JoinStrictness,
            optional: false,
        };

        const filtered = this._state.joins.filter(j => j.id !== key);
        const nextJoins = [
            ...filtered,
            newEntry,
        ] as RuntimeSelectState["joins"];

        const nextState = this.clone({
            joinSql: nextJoinSql,
            joins: nextJoins,
        });

        return new SelectQueryBuilderImpl<
            Schema,
            WithJoinContext<State, JoinSql>,
            WithJoinSql<Sql, JoinSql, Id>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            WithJoinContext<State, JoinSql>,
            WithJoinSql<Sql, JoinSql, Id>
        >;
    }

    removeSelect<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
        WithoutSelectSql<Sql, Id>
    > {
        const nextSelectSql = { ...this._state.selectSql };
        if (!(id in nextSelectSql)) {
            return this as unknown as SelectQueryBuilder<
                Schema,
                StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
                WithoutSelectSql<Sql, Id>
            >;
        }

        delete (nextSelectSql as any)[id];

        const nextState = this.clone({ selectSql: nextSelectSql });
        type NewSql = WithoutSelectSql<Sql, Id>;
        type NewState = StateFromSql<Schema, State, NewSql>;

        return new SelectQueryBuilderImpl<Schema, NewState, NewSql>(
            nextState,
        ) as unknown as SelectQueryBuilder<Schema, NewState, NewSql>;
    }

    removeJoin<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
        WithoutJoinSql<Sql, Id>
    > {
        const nextJoinSql = { ...this._state.joinSql };
        const hadSql = id in nextJoinSql;
        delete (nextJoinSql as any)[id];

        const nextJoins = this._state.joins.filter(j => j.id !== id);
        if (!hadSql && nextJoins.length === this._state.joins.length) {
            return this as unknown as SelectQueryBuilder<
                Schema,
                StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
                WithoutJoinSql<Sql, Id>
            >;
        }

        const nextState = this.clone({
            joinSql: nextJoinSql,
            joins: nextJoins,
        });
        type NewSql = WithoutJoinSql<Sql, Id>;
        type NewState = StateFromSql<Schema, State, NewSql>;

        return new SelectQueryBuilderImpl<Schema, NewState, NewSql>(
            nextState,
        ) as unknown as SelectQueryBuilder<Schema, NewState, NewSql>;
    }

    limit<const L extends number>(
        limit: L,
    ): SelectQueryBuilder<Schema, State, WithLimitSql<Sql, L>> {
        const nextState = this.clone({ limit });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithLimitSql<Sql, L>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithLimitSql<Sql, L>
        >;
    }

    offset<const O extends number>(
        offset: O,
    ): SelectQueryBuilder<Schema, State, WithOffsetSql<Sql, O>> {
        const nextState = this.clone({ offset });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            WithOffsetSql<Sql, O>
        >(
            nextState,
        ) as unknown as SelectQueryBuilder<
            Schema,
            State,
            WithOffsetSql<Sql, O>
        >;
    }

    // -----------------------------------------------------------------------
    // Conditional *If() Runtime Implementations
    // -----------------------------------------------------------------------

    selectIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.select(columns, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    joinIf<
        Cond extends boolean,
        JoinSql extends string,
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        joinSql: JoinSql,
        id?: Id,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.join(joinSql, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    whereIf<
        Cond extends boolean,
        W extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        clause: W,
        id?: string,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.where(clause, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    groupByIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.groupBy(columns, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    havingIf<
        Cond extends boolean,
        H extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        havingClause: H,
        id?: string,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.having(havingClause, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    orderByIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.orderBy(columns, id) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    limitIf<
        Cond extends boolean,
        const L extends number,
    >(
        condition: Cond,
        limit: L,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.limit(limit) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    offsetIf<
        Cond extends boolean,
        const O extends number,
    >(
        condition: Cond,
        offset: O,
    ): SelectQueryBuilder<Schema, any, any> {
        if (!condition) {
            return this as unknown as SelectQueryBuilder<Schema, any, any>;
        }
        return this.offset(offset) as unknown as SelectQueryBuilder<
            Schema,
            any,
            any
        >;
    }

    withParams<P extends Record<string, QueryParamValue>>(
        params: P,
    ): SelectQueryBuilder<Schema, State, Sql> {
        const nextState = this.clone({ namedParams: params });
        return new SelectQueryBuilderImpl<
            Schema,
            State,
            Sql
        >(nextState) as unknown as SelectQueryBuilder<
            Schema,
            State,
            Sql
        >;
    }

    apply<
        NewState extends BuilderStateTag<any, any, any>,
        NewSql extends BuilderSqlTag<
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
    >(
        fn: (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, NewState, NewSql>,
    ): SelectQueryBuilder<Schema, NewState, NewSql> {
        return fn(this as unknown as SelectQueryBuilder<Schema, State, Sql>);
    }

    applyIf<Cond extends boolean>(
        condition: Cond,
        fn: (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, any, any>,
    ): SelectQueryBuilder<Schema, State, Sql> {
        if (condition) {
            return fn(
                this as unknown as SelectQueryBuilder<Schema, State, Sql>,
            ) as unknown as SelectQueryBuilder<Schema, State, Sql>;
        }
        return this as unknown as SelectQueryBuilder<Schema, State, Sql>;
    }

    getParams(): ReadonlyArray<QueryParamValue> {
        // Return named params values in key order (same order as $N placeholders)
        const namedParams = this._state.namedParams;
        if (namedParams && Object.keys(namedParams).length > 0) {
            return Object.values(namedParams);
        }
        // Fallback to legacy positional params
        return this._state.params;
    }

    // -----------------------------------------------------------------------
    // SQL String Assembly
    // -----------------------------------------------------------------------

    toBrandedString(): string & {
        __type: BuilderResultBrand<Schema, State, Sql>;
    } {
        // Runtime: just assemble SQL string from fragments.
        const sql = assembleSelectSQL(this._state);
        return sql as string & {
            __type: BuilderResultBrand<Schema, State, Sql>;
        };
    }

    toString(): string {
        return assembleSelectSQL(this._state);
    }
}
