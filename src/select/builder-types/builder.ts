import type { QueryParamValue } from "../../common/builder.js";
import type { ConditionTreeBuilder } from "../../common/builder.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type {
    AddColumnsForSchema,
    AnyBuilderSqlTag,
    BuilderSqlTag,
    BuilderStateTag,
    ConditionalSqlUpdate,
    ConditionalStateUpdate,
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
} from "./helpers.js";
import type { BuilderResultBrand } from "./return-type.js";
import type { SelectBuilderState } from "./state.js";

// ============================================================================
// Runtime SELECT Builder Skeleton
// ============================================================================

/**
 * Runtime representation of builder state mirrors SelectBuilderState but
 * can store raw string fragments for SQL assembly alongside AST fragments
 * tracked at the type level.
 */
export interface RuntimeSelectState extends SelectBuilderState {
    /**
     * Raw SELECT fragments by ID (used for SQL string assembly).
     * The type-level part continues to use SelectBuilderState["select"].
     */
    readonly selectSql: { readonly [id: string]: string[]; };
    /** Raw FROM fragment (if present) */
    readonly fromSql?: string;
    /** Raw JOIN fragments by ID (preserving order via joins array) */
    readonly joinSql: { readonly [id: string]: string; };
    /** Raw WHERE fragments by ID (can include ConditionTreeBuilder usage) */
    readonly whereSql: { readonly [id: string]: string; };
    /** Raw GROUP BY fragments by ID */
    readonly groupBySql: { readonly [id: string]: string; };
    /** Raw HAVING fragments by ID */
    readonly havingSql: { readonly [id: string]: string; };
    /** Raw ORDER BY fragments by ID */
    readonly orderBySql: { readonly [id: string]: string; };
    /** Raw CTE fragments by ID */
    readonly cteSql: { readonly [id: string]: string; };
    /** Raw UNION fragment (if any) */
    readonly unionSql?: string;
    /** Collected query parameter values (positional) - legacy, prefer namedParams */
    readonly params: ReadonlyArray<QueryParamValue>;
    /** Named parameters - keys become :name placeholders, values go to params array */
    readonly namedParams: Record<string, QueryParamValue>;
}

/**
 * Public SELECT builder interface.
 *
 * - `Schema` is the database schema used for type inference.
 * - `State` is a lightweight tag (`BuilderStateTag`) that tracks the
 *   primary FROM table and the currently inferred result row type.
 * - `Sql` is a lightweight tag (`BuilderSqlTag`) that tracks assembled SQL
 *   fragments for type-level reconstruction and validation.
 */
export interface SelectQueryBuilder<
    Schema extends DatabaseSchema,
    State extends BuilderStateTag<any, any, any>,
    Sql extends AnyBuilderSqlTag = EmptySqlState,
> {
    /**
     * Optional runtime-only accessor for debugging / tests.
     */
    readonly _state: RuntimeSelectState;

    /**
     * Add columns to the SELECT list.
     *
     * Type-level: updates SelectBuilderState.select using ParseColumnList.
     */
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
    >;

    /**
     * Set the FROM source (table or subquery as raw SQL).
     *
     * Type-level: updates SelectBuilderState.from using ParseTableRef.
     */
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
    >;

    /**
     * Add a raw JOIN fragment.
     *
     * Phase 7 note: this currently affects only the runtime SQL string. The
     * lightweight type-level state tag does not track join structure; columns
     * from joined tables are inferred purely from their qualified names when
     * selected (for example, "orders.total").
     */
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
    >;

    /**
     * Remove SELECT fragments by ID (runtime) while updating type-level SQL.
     *
     * Type-level: on the top level, removes the referenced SELECT fragment; when
     * used inside `.when()`, MergeConditionalState preserves prior columns so
     * conditional removals are effectively no-ops.
     */
    removeSelect<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutSelectSql<Sql, Id>>,
        WithoutSelectSql<Sql, Id>
    >;

    /**
     * Remove JOIN fragments by ID (runtime) while updating type-level SQL and
     * context string for column inference.
     *
     * Type-level: same semantics as removeSelect regarding conditional usage.
     */
    removeJoin<Id extends string>(
        id: Id,
    ): SelectQueryBuilder<
        Schema,
        StateFromSql<Schema, State, WithoutJoinSql<Sql, Id>>,
        WithoutJoinSql<Sql, Id>
    >;

    /**
     * Add a WHERE condition (string or ConditionTreeBuilder).
     */
    where<
        Cond extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithWhereSql<Sql, Cond>>;

    /**
     * Add GROUP BY columns (string or array).
     */
    groupBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithGroupBySql<Sql, Cols, Id>>;

    /**
     * Add a HAVING condition (string or ConditionTreeBuilder).
     */
    having<
        Cond extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        id?: string,
    ): SelectQueryBuilder<Schema, State, WithHavingSql<Sql, Cond>>;

    /**
     * Add ORDER BY columns (string or array).
     */
    orderBy<
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<Schema, State, WithOrderBySql<Sql, Cols, Id>>;

    /**
     * Set LIMIT value.
     */
    limit<const L extends number>(
        limit: L,
    ): SelectQueryBuilder<Schema, State, WithLimitSql<Sql, L>>;

    /**
     * Set OFFSET value.
     */
    offset<const O extends number>(
        offset: O,
    ): SelectQueryBuilder<Schema, State, WithOffsetSql<Sql, O>>;

    // -----------------------------------------------------------------------
    // Conditional *If() Methods
    // -----------------------------------------------------------------------

    /**
     * Conditionally add columns to the SELECT list.
     *
     * More performant than `.when()` for simple conditional selects because
     * it avoids callback type inference. When condition is a non-literal
     * boolean, new columns are marked as optional in the result type.
     */
    selectIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        ConditionalStateUpdate<
            Cond,
            State,
            AddColumnsForSchema<Schema, State, Cols>
        >,
        ConditionalSqlUpdate<
            Cond,
            WithSelectSql<Sql, Cols, Id>,
            Sql
        >
    >;

    /**
     * Conditionally add a JOIN fragment.
     *
     * More performant than `.when()` for simple conditional joins because
     * it avoids callback type inference.
     */
    joinIf<
        Cond extends boolean,
        JoinSql extends string,
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        joinSql: JoinSql,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        ConditionalStateUpdate<
            Cond,
            State,
            WithJoinContext<State, JoinSql>
        >,
        ConditionalSqlUpdate<
            Cond,
            WithJoinSql<Sql, JoinSql, Id>,
            Sql
        >
    >;

    /**
     * Conditionally add a WHERE condition.
     *
     * More performant than `.when()` for simple conditional filters because
     * it avoids callback type inference entirely.
     */
    whereIf<
        Cond extends boolean,
        W extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        clause: W,
        id?: string,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithWhereSql<Sql, W>, Sql>
    >;

    /**
     * Conditionally add GROUP BY columns.
     *
     * More performant than `.when()` for simple conditional grouping.
     */
    groupByIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithGroupBySql<Sql, Cols, Id>, Sql>
    >;

    /**
     * Conditionally add a HAVING condition.
     *
     * More performant than `.when()` for simple conditional having clauses.
     */
    havingIf<
        Cond extends boolean,
        H extends string | ConditionTreeBuilder,
    >(
        condition: Cond,
        condition_: H,
        id?: string,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithHavingSql<Sql, H>, Sql>
    >;

    /**
     * Conditionally add ORDER BY columns.
     *
     * More performant than `.when()` for simple conditional ordering.
     */
    orderByIf<
        Cond extends boolean,
        const Cols extends string | readonly string[],
        Id extends string | undefined = undefined,
    >(
        condition: Cond,
        columns: Cols,
        id?: Id,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithOrderBySql<Sql, Cols, Id>, Sql>
    >;

    /**
     * Conditionally set LIMIT value.
     *
     * More performant than `.when()` for simple conditional limits.
     */
    limitIf<
        Cond extends boolean,
        const L extends number,
    >(
        condition: Cond,
        limit: L,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithLimitSql<Sql, L>, Sql>
    >;

    /**
     * Conditionally set OFFSET value.
     *
     * More performant than `.when()` for simple conditional offsets.
     */
    offsetIf<
        Cond extends boolean,
        const O extends number,
    >(
        condition: Cond,
        offset: O,
    ): SelectQueryBuilder<
        Schema,
        State,
        ConditionalSqlUpdate<Cond, WithOffsetSql<Sql, O>, Sql>
    >;

    /**
     * Set named parameters for the query.
     *
     * Use `:paramName` syntax in SQL strings (WHERE, JOIN, etc.) and they will
     * be replaced with `$1`, `$2`, etc. at runtime based on object key order.
     *
     * Note: This method does not affect the type-level SQL tag to avoid
     * TypeScript depth limit issues when chaining many methods after withParams.
     * The params are only used at runtime for SQL string assembly.
     *
     * @example
     * ```typescript
     * builder
     *   .withParams({ userId: 123, status: 'active' })
     *   .where('user_id = :userId')
     *   .where('status = :status')
     * // SQL: "... WHERE user_id = $1 AND status = $2"
     * // Params: [123, 'active']
     * ```
     */
    withParams<P extends Record<string, QueryParamValue>>(
        params: P,
    ): SelectQueryBuilder<Schema, State, Sql>;

    /**
     * Apply a reusable builder function to this builder.
     *
     * Allows composing the builder with external functions that encapsulate
     * reusable logic (e.g. common filters, joins, or selections).
     */
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
    ): SelectQueryBuilder<Schema, NewState, NewSql>;

    /**
     * Conditionally apply a reusable builder function.
     *
     * More performant than `.when()` for applying reusable functions because
     * it avoids callback type inference entirely. The function must return
     * the same builder type it receives (State and Sql unchanged at type level).
     *
     * Use this for reusable functions that only add WHERE clauses, or when
     * you don't need type-level tracking of the function's modifications.
     *
     * @example
     * ```ts
     * function addDateFilter(b: SelectQueryBuilder<Schema, State, Sql>) {
     *     return b.where("created_at > NOW() - INTERVAL '1 day'");
     * }
     *
     * builder.applyIf(shouldFilter, addDateFilter);
     * ```
     */
    applyIf<Cond extends boolean>(
        condition: Cond,
        fn: (
            b: SelectQueryBuilder<Schema, State, Sql>,
        ) => SelectQueryBuilder<Schema, any, any>,
    ): SelectQueryBuilder<Schema, State, Sql>;

    /**
     * Generate the SQL string from the internal runtime state.
     * Branded return type exposes the inferred result type.
     */
    toBrandedString(): string & {
        __type: BuilderResultBrand<Schema, State, Sql>;
    };

    /** Retrieve accumulated positional query parameters. */
    getParams(): ReadonlyArray<QueryParamValue>;

    /**
     * Generate the SQL string from the internal runtime state without branding.
     */
    toString(): string;
}

// ============================================================================
// Untyped Select Builder (No Type-Level Computation)
// ============================================================================

/**
 * Untyped SELECT query builder interface.
 *
 * This interface mirrors `SelectQueryBuilder` but avoids all type-level
 * computation. Every method returns `UntypedSelectBuilder<Result>`, so
 * TypeScript doesn't spend cycles computing complex schema-driven types.
 *
 * Use this when:
 * - Your query has many complex SQL expressions that overwhelm TypeScript
 * - You know the result type upfront and don't need schema inference
 * - You want to compose with typed builder functions (it's assignable to
 *   `SelectQueryBuilder<any, any, any>`)
 *
 * The `Result` type parameter is your declared return type – it flows through
 * unchanged regardless of what columns/tables you add.
 */
export interface UntypedSelectBuilder<Result = unknown> {
    /** Runtime state accessor (same as typed builder). */
    readonly _state: RuntimeSelectState;

    /** Add columns to the SELECT list. */
    select(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Set the FROM source (table name or subquery SQL). */
    from(
        source: string | UntypedSelectBuilder<any>,
    ): UntypedSelectBuilder<Result>;

    /** Add a raw JOIN fragment. */
    join(joinSql: string, id?: string): UntypedSelectBuilder<Result>;

    /** Remove SELECT fragments by ID. */
    removeSelect(id: string): UntypedSelectBuilder<Result>;

    /** Remove JOIN fragments by ID. */
    removeJoin(id: string): UntypedSelectBuilder<Result>;

    /** Add a WHERE condition. */
    where(
        condition: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add GROUP BY columns. */
    groupBy(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add a HAVING condition. */
    having(
        condition: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Add ORDER BY columns. */
    orderBy(
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Set LIMIT value. */
    limit(limit: number): UntypedSelectBuilder<Result>;

    /** Set OFFSET value. */
    offset(offset: number): UntypedSelectBuilder<Result>;

    // -----------------------------------------------------------------------
    // Conditional *If() Methods
    // -----------------------------------------------------------------------

    /** Conditionally add columns to the SELECT list. */
    selectIf(
        condition: boolean,
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally add a JOIN fragment. */
    joinIf(
        condition: boolean,
        joinSql: string,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally add a WHERE condition. */
    whereIf(
        condition: boolean,
        clause: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally add GROUP BY columns. */
    groupByIf(
        condition: boolean,
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally add a HAVING condition. */
    havingIf(
        condition: boolean,
        havingClause: string | ConditionTreeBuilder,
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally add ORDER BY columns. */
    orderByIf(
        condition: boolean,
        columns: string | readonly string[],
        id?: string,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally set LIMIT value. */
    limitIf(
        condition: boolean,
        limit: number,
    ): UntypedSelectBuilder<Result>;

    /** Conditionally set OFFSET value. */
    offsetIf(
        condition: boolean,
        offset: number,
    ): UntypedSelectBuilder<Result>;

    /**
     * Set named parameters for the query.
     *
     * Use `:paramName` syntax in SQL strings and they will be replaced
     * with `$1`, `$2`, etc. at runtime based on object key order.
     */
    withParams<P extends Record<string, QueryParamValue>>(
        params: P,
    ): UntypedSelectBuilder<Result>;

    /**
     * Conditional execution helper.
     *
     * Unlike the typed builder, this doesn't merge conditional column types –
     * Result stays fixed.
     */
    when(
        condition: boolean,
        ifTrue: (
            b: UntypedSelectBuilder<Result>,
        ) => UntypedSelectBuilder<Result>,
        ifFalse?: (
            b: UntypedSelectBuilder<Result>,
        ) => UntypedSelectBuilder<Result>,
    ): UntypedSelectBuilder<Result>;

    /**
     * Apply a reusable builder function.
     */
    apply(
        fn: (b: UntypedSelectBuilder<Result>) => UntypedSelectBuilder<Result>,
    ): UntypedSelectBuilder<Result>;

    /** Generate the SQL string. */
    toBrandedString(): string & { __type: Result; };

    /** Retrieve accumulated positional query parameters. */
    getParams(): ReadonlyArray<QueryParamValue>;

    /** Generate the SQL string (unbranded). */
    toString(): string;
}
