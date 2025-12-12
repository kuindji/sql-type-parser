import type { JoinClause } from "../../common/ast.js";
import type { ColumnRefType } from "../../common/ast.js";
import type { OrderByItem } from "../../common/ast.js";
import type { CTEDefinition } from "../../common/ast.js";
import type { SelectItem } from "../ast.js";
import type { UnionClause } from "../ast.js";
import type { UnionOperatorType } from "../ast.js";
import type { SelectClause } from "../ast.js";
import type { SelectBuilderState } from "./state.js";
// ============================================================================
// State-to-AST Conversion (Scaffolding)
// ============================================================================

/**
 * Extract all SELECT items from the state's select map and flatten them.
 *
 * Order is not preserved and is not semantically significant for
 * type-level behavior; the result is modelled as a SelectItem[].
 *
 * When no select fragments exist, callers should treat this as
 * "no explicit columns" and default to SELECT * at the SQL/string level.
 */
export type SelectItemsFromState<
    State extends SelectBuilderState,
> = State["select"][keyof State["select"]] extends infer V
    ? V extends SelectItem[] ? V[number][]
    : SelectItem[]
    : SelectItem[];

/**
 * Convert a builder state into a SelectClause AST.
 *
 * This is a structural projection only; it does not perform validation
 * or apply defaulting rules like "SELECT *" when no select() was called.
 *
 * - Columns: flattened select items (or "*" when explicitly requested
 *   by the caller via WithDefaultColumns).
 * - FROM / JOIN / WHERE / GROUP BY / HAVING / ORDER BY / LIMIT / OFFSET /
 *   DISTINCT / CTEs / UNION: mapped 1:1 from state fields.
 */
export type StateToSelectClause<
    State extends SelectBuilderState,
    Columns extends SelectItem[] | "*" = SelectItemsFromState<State>,
> = SelectClause<
    Columns,
    NonNullable<State["from"]>,
    State["joins"] extends ReadonlyArray<infer J>
        ? J extends { ast: infer A extends JoinClause; } ? A[] : undefined
        : undefined,
    // WHERE / HAVING are stored as maps keyed by ID; for validation and
    // type inference, they are typically combined with AND. For now we
    // expose the raw union-of-entries as WhereExpr | undefined; this is
    // sufficient scaffolding for later builder phases to refine.
    State["where"][keyof State["where"]] | undefined,
    State["groupBy"][keyof State["groupBy"]] extends infer GB
        ? GB extends ColumnRefType[] ? GB[number][]
        : ColumnRefType[] | undefined
        : ColumnRefType[] | undefined,
    State["having"][keyof State["having"]] | undefined,
    State["orderBy"][keyof State["orderBy"]] extends infer OB
        ? OB extends OrderByItem[] ? OB[number][]
        : OrderByItem[] | undefined
        : OrderByItem[] | undefined,
    State["limit"],
    State["offset"],
    State["distinct"],
    State["ctes"][keyof State["ctes"]] extends infer C
        ? C extends CTEDefinition ? C[]
        : CTEDefinition[] | undefined
        : CTEDefinition[] | undefined
>;

/**
 * Helper to wrap a SelectClause produced from state in a UnionClause
 * when the state's union field is present.
 *
 * This is a small convenience for later phases that need to pass a
 * SelectClause-or-UnionClause into validator/matcher logic.
 */
export type StateToSelectQueryClause<
    State extends SelectBuilderState,
    Columns extends SelectItem[] | "*" = SelectItemsFromState<State>,
> = State["union"] extends UnionClause<
    infer Left extends SelectClause,
    infer Op extends UnionOperatorType,
    infer Right
> ? UnionClause<Left, Op, Right>
    : StateToSelectClause<State, Columns>;
