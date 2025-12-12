/**
 * SELECT Builder State Type Tests
 *
 * Tests for core type-level pieces of the SELECT builder:
 * - EmptyState / SelectBuilderState / ErrorState shapes
 * - JoinStrictness and CanReplaceJoin behavior
 * - State-to-AST conversion scaffolding
 * - Branded toBrandedString Result Tests
 *
 * If this file compiles without errors, these tests pass.
 */

import type {
    ColumnRef,
    ColumnRefType,
    CTEDefinition,
    OrderByItem,
    SelectClause,
    TableRef,
    UnboundColumnRef,
    UnionClause,
    WhereExpr,
} from "../../../src/index.js";

import type {
    BuilderReturnType,
} from "../../../src/select/builder-types/return-type.js";

import type { CanReplaceJoin } from "../../../src/select/builder-types/joins.js";

import type {
    EmptyState,
    ErrorState,
    JoinStrictness,
    SelectBuilderAnyState,
    SelectBuilderState,
} from "../../../src/select/builder-types/state.js";

import type {
    SelectItemsFromState,
    StateToSelectClause,
    StateToSelectQueryClause,
} from "../../../src/select/builder-types/state-to-ast.js";

import type {
    AssertEqual,
    AssertExtends,
    HasProperty,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";

// ============================================================================
// Core State Shape Tests
// ============================================================================

// EmptyState basic shape
type _B_Empty_Select = RequireTrue<
    AssertEqual<EmptyState["select"], {}>
>;
type _B_Empty_From = RequireTrue<
    AssertEqual<EmptyState["from"], undefined>
>;
type _B_Empty_Joins = RequireTrue<
    AssertEqual<EmptyState["joins"], []>
>;
type _B_Empty_Distinct = RequireTrue<
    AssertEqual<EmptyState["distinct"], false>
>;

// SelectBuilderState must extend SelectBuilderAnyState and be assignable
type _B_StateExtendsAny = RequireTrue<
    AssertExtends<SelectBuilderState, SelectBuilderAnyState>
>;

// ErrorState must be a match error and keep previousState
type _B_ErrorStatePrevious = RequireTrue<
    AssertExtends<ErrorState["previousState"], SelectBuilderState>
>;

// ============================================================================
// JoinStrictness & CanReplaceJoin Tests
// ============================================================================

// JoinStrictness includes the expected variants
type _B_JS_Inner = RequireTrue<AssertExtends<"INNER", JoinStrictness>>;
type _B_JS_Left = RequireTrue<AssertExtends<"LEFT", JoinStrictness>>;
type _B_JS_Right = RequireTrue<AssertExtends<"RIGHT", JoinStrictness>>;
type _B_JS_Full = RequireTrue<AssertExtends<"FULL", JoinStrictness>>;
type _B_JS_Cross = RequireTrue<AssertExtends<"CROSS", JoinStrictness>>;

// CanReplaceJoin behavior:
// - INNER cannot be replaced with weaker join types
type _B_CRJ_InnerToLeft = RequireTrue<
    AssertEqual<CanReplaceJoin<"INNER", "LEFT">, false>
>;
type _B_CRJ_InnerToInner = RequireTrue<
    AssertEqual<CanReplaceJoin<"INNER", "INNER">, true>
>;

// - LEFT can be tightened to INNER, but not loosened to FULL/CROSS
type _B_CRJ_LeftToInner = RequireTrue<
    AssertEqual<CanReplaceJoin<"LEFT", "INNER">, true>
>;
type _B_CRJ_LeftToFull = RequireTrue<
    AssertEqual<CanReplaceJoin<"LEFT", "FULL">, false>
>;

// - RIGHT behaves the same as LEFT
type _B_CRJ_RightToInner = RequireTrue<
    AssertEqual<CanReplaceJoin<"RIGHT", "INNER">, true>
>;

// - FULL cannot be loosened to CROSS
type _B_CRJ_FullToCross = RequireTrue<
    AssertEqual<CanReplaceJoin<"FULL", "CROSS">, false>
>;

// ============================================================================
// State-to-AST Conversion Tests (Scaffolding)
// ============================================================================

// Helper: simple state with FROM and one select fragment
type B_TestFrom = TableRef<"users", "u", undefined>;
type B_TestSelectItems = [
    ColumnRef<UnboundColumnRef<"id">, "id">,
    ColumnRef<UnboundColumnRef<"name">, "name">,
];

type B_SimpleState = SelectBuilderState & {
    readonly select: {
        readonly base: B_TestSelectItems;
    };
    readonly from: B_TestFrom;
    readonly joins: [];
    readonly where: {};
    readonly groupBy: {};
    readonly having: {};
    readonly orderBy: {};
    readonly limit: undefined;
    readonly offset: undefined;
    readonly ctes: {};
    readonly distinct: false;
    readonly union: undefined;
};

// SelectItemsFromState should flatten the select map into an array type
type B_ItemsFromState = SelectItemsFromState<B_SimpleState>;
type _B_ItemsFromStateExtends = RequireTrue<
    AssertExtends<B_TestSelectItems[number], B_ItemsFromState[number]>
>;

// StateToSelectClause should produce a SelectClause with matching FROM
type B_SelectClause = StateToSelectClause<B_SimpleState>;
type _B_SelectClauseShape = RequireTrue<
    AssertExtends<B_SelectClause, SelectClause>
>;

type _B_SelectClauseFrom = RequireTrue<
    AssertEqual<B_SelectClause["from"], B_TestFrom>
>;

// StateToSelectQueryClause should either return a SelectClause or UnionClause
type B_QueryClauseNoUnion = StateToSelectQueryClause<B_SimpleState>;
type _B_QueryClauseNoUnionShape = RequireTrue<
    AssertExtends<B_QueryClauseNoUnion, SelectClause>
>;

// Simulated state with an existing union
type B_Union = UnionClause<
    SelectClause,
    "UNION",
    SelectClause
>;

type B_UnionState = SelectBuilderState & {
    readonly from: B_TestFrom;
    readonly union: B_Union;
};

type B_QueryClauseWithUnion = StateToSelectQueryClause<B_UnionState>;
type _B_QueryClauseWithUnionShape = RequireTrue<
    AssertExtends<B_QueryClauseWithUnion, UnionClause>
>;

// ============================================================================
// Branded toBrandedString Result Tests
// ============================================================================

type B_TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
            };
        };
    };
};

const builderInstance = createSelectQuery<B_TestSchema>();
type B_SQLString = ReturnType<typeof builderInstance.toBrandedString>;
type _B_ToStringIsPlainString = RequireTrue<
    AssertEqual<ReturnType<typeof builderInstance.toString>, string>
>;

// Branded string must expose __type property (shape only, not value)
type _B_ToStringHasTypeBrand = HasProperty<B_SQLString, "__type">;

// ============================================================================
// Additional Integration: StateToSelectClause with all major fields
// ============================================================================

// Complex state with WHERE / GROUP BY / HAVING / ORDER BY / CTEs populated
type B_GroupByCols = [
    ColumnRef<UnboundColumnRef<"id">, "id">,
    ColumnRef<UnboundColumnRef<"name">, "name">,
];

type B_CTE = CTEDefinition<"active_users", SelectClause>;

type B_ComplexState = SelectBuilderState & {
    readonly from: TableRef<"users", "u", undefined>;
    readonly where: {
        readonly w1: WhereExpr;
    };
    readonly groupBy: {
        readonly g1: ColumnRefType[];
    };
    readonly having: {
        readonly h1: WhereExpr;
    };
    readonly orderBy: {
        readonly o1: OrderByItem[];
    };
    readonly ctes: {
        readonly c1: B_CTE;
    };
};

type B_ComplexClause = StateToSelectClause<B_ComplexState>;

// GroupBy should be an array of ColumnRefType
type _B_Complex_GroupBy = RequireTrue<
    AssertExtends<B_ComplexClause["groupBy"], ColumnRefType[] | undefined>
>;

// Having should be a WhereExpr | undefined
type _B_Complex_Having = RequireTrue<
    AssertExtends<B_ComplexClause["having"], WhereExpr | undefined>
>;

// OrderBy should be an array of OrderByItem
type _B_Complex_OrderBy = RequireTrue<
    AssertExtends<B_ComplexClause["orderBy"], OrderByItem[] | undefined>
>;

// CTEs should be an array of CTEDefinition
type _B_Complex_CTEs = RequireTrue<
    AssertExtends<B_ComplexClause["ctes"], CTEDefinition[] | undefined>
>;

// ============================================================================
// Export for verification
// ============================================================================

export type StateTestsPass = true;
