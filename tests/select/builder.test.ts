import { describe, expect, it } from "bun:test";
/**
 * SELECT Builder Type Tests (Phases 2–4)
 *
 * Tests for core type-level pieces of the SELECT builder:
 * - EmptyState / SelectBuilderState / ErrorState shapes
 * - JoinStrictness and CanReplaceJoin behavior
 * - Basic State-to-AST conversion scaffolding
 * - Branded result type on `.toBrandedString()` / BuilderReturnType
 *
 * If this file compiles without errors, these tests pass.
 */

import type {
    ColumnRef,
    ColumnRefType,
    CTEDefinition,
    JoinClause,
    OrderByItem,
    SelectClause,
    SelectItem,
    TableRef,
    TableSource,
    TableWildcard,
    UnboundColumnRef,
    UnionClause,
    UnionOperatorType,
    WhereExpr,
} from "../../src/index.js";

import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
    BuilderReturnType,
    BuilderSQL,
    BuilderSqlTag,
    BuilderStateTag,
    CanReplaceJoin,
    EmptyState,
    ErrorState,
    JoinStrictness,
    RuntimeSelectState,
    SelectBuilderAnyState,
    SelectBuilderState,
    SelectItemsFromState,
    SelectQueryBuilder,
    StateToSelectClause,
    StateToSelectQueryClause,
    ValidateBuilder,
} from "../../src/select/builder.js";

import type {
    AssertEqual,
    AssertExtends,
    HasProperty,
    RequireFalse,
    RequireTrue,
} from "../helpers.js";

import {
    assembleSelectSQL,
    createConditionTree,
    createSelectQuery,
} from "../../src/index.js";

import type { DatabaseSchema } from "../../src/common/schema.js";

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
// End-to-end Builder Query Construction Tests
// ============================================================================

describe("basic query building", () => {
    it("should build a basic query", () => {
        type B_RuntimeSchema = {
            defaultSchema: "public";
            schemas: {
                public: {
                    users: {
                        id: number;
                        name: string;
                        email: string;
                        active: boolean;
                    };
                };
            };
        };

        const includeEmail = false;

        const builderQuery = createSelectQuery<B_RuntimeSchema>()
            .from("users")
            .select("id")
            .select("name")
            .when(includeEmail, b => b.select("email"))
            .where("active = TRUE", "active_filter")
            .limit(10);

        const builderSql = builderQuery.toString();

        // Runtime string validation – focuses on assembly order and keywords.
        expect(builderSql).toBe(
            "SELECT id, name FROM users WHERE active = TRUE LIMIT 10",
        );

        type BuilderSqlLiteral = BuilderSQL<typeof builderQuery>;
        type _TypeSqlIncludesConditionalSelect = RequireTrue<
            AssertEqual<
                BuilderSqlLiteral,
                "SELECT id, name, email FROM users WHERE active = TRUE LIMIT 10"
            >
        >;

        const brandedSql = builderQuery.toBrandedString();
        expect(brandedSql as string).toBe(builderSql);

        type ReturnType = BuilderReturnType<typeof builderQuery>;
        type IsValidReturnType = RequireTrue<
            AssertEqual<ReturnType, {
                id: number;
                name: string;
                email: string | undefined;
            }>
        >;
    });

    it("should cast types", () => {
        // Complex expressions / type casting should reuse the existing parser +
        // matcher so that updates there are automatically reflected here.

        type B_CastSchema = {
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

        const castBuilder = createSelectQuery<B_CastSchema>()
            .from("users")
            .select("id::text");

        const castSql = castBuilder.toString();

        expect(castSql).toBe(
            "SELECT id::text FROM users",
        );

        type CastSql = BuilderSQL<typeof castBuilder>;
        type _CastSqlMatches = RequireTrue<
            AssertEqual<CastSql, "SELECT id::text FROM users">
        >;

        type B_CastResult = BuilderReturnType<typeof castBuilder>;
        type IsValidCastResult = RequireTrue<
            AssertEqual<B_CastResult, {
                id: string;
            }>
        >;
    });

    it("supports limit with offset and preserves ordering", () => {
        type B_OffsetSchema = {
            defaultSchema: "public";
            schemas: {
                public: {
                    users: {
                        id: number;
                    };
                };
            };
        };

        const builder = createSelectQuery<B_OffsetSchema>()
            .from("users")
            .select("id")
            .offset(5)
            .limit(10);

        const sql = builder.toString();
        expect(sql).toBe("SELECT id FROM users LIMIT 10 OFFSET 5");

        type OffsetSql = BuilderSQL<typeof builder>;
        type _OffsetSqlMatches = RequireTrue<
            AssertEqual<OffsetSql, "SELECT id FROM users LIMIT 10 OFFSET 5">
        >;

        type OffsetRow = BuilderReturnType<typeof builder>;
        type _OffsetRowMatches = RequireTrue<
            AssertEqual<OffsetRow, { id: number; }>
        >;
    });

    it("supports offset without limit", () => {
        type B_OffsetOnlySchema = {
            defaultSchema: "public";
            schemas: {
                public: {
                    users: {
                        id: number;
                    };
                };
            };
        };

        const builder = createSelectQuery<B_OffsetOnlySchema>()
            .from("users")
            .select("id")
            .offset(3);

        const sql = builder.toString();
        expect(sql).toBe("SELECT id FROM users OFFSET 3");

        type OffsetOnlySql = BuilderSQL<typeof builder>;
        type _OffsetOnlySqlMatches = RequireTrue<
            AssertEqual<OffsetOnlySql, "SELECT id FROM users OFFSET 3">
        >;

        type OffsetOnlyRow = BuilderReturnType<typeof builder>;
        type _OffsetOnlyRowMatches = RequireTrue<
            AssertEqual<OffsetOnlyRow, { id: number; }>
        >;
    });
});

// ============================================================================
// Join + Joined Table Columns (lightweight state tag)
// ============================================================================

describe("join query building", () => {
    type User_id = string & { __type: "Users_Table.id"; };
    type Order_id = string & { __type: "Orders_Table.id"; };
    type B_JoinSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: User_id;
                    name: string;
                };
                orders: {
                    id: Order_id;
                    user_id: number;
                    total: number;
                };
            };
        };
    };

    it("should build a basic join query", () => {
        const joinBuilder = createSelectQuery<B_JoinSchema>()
            .from("users")
            .select([ "id", "name" ])
            .join("INNER JOIN orders ON orders.user_id = users.id")
            .select("orders.total");

        const joinSql = joinBuilder.toString();

        expect(joinSql).toBe(
            "SELECT id, name, orders.total FROM users INNER JOIN orders ON orders.user_id = users.id",
        );

        type JoinSql = BuilderSQL<typeof joinBuilder>;
        type _JoinSqlMatches = RequireTrue<
            AssertEqual<
                JoinSql,
                "SELECT id, name, orders.total FROM users INNER JOIN orders ON orders.user_id = users.id"
            >
        >;

        type B_JoinResult = BuilderReturnType<typeof joinBuilder>;

        type IsValidJoinResult = RequireTrue<
            AssertEqual<B_JoinResult, {
                id: User_id;
                name: string;
                total: number;
            }>
        >;
    });

    // Conditional join + conditional column select: columns coming only from
    // inside the `.when()` callback should be optional in the result type.
    it("should support conditional joins and selects", () => {
        const joinCondition: boolean = false;
        const selectCondition: boolean = false;

        const conditionalJoinBuilder = createSelectQuery<B_JoinSchema>()
            .from("users u")
            .select("u.id")
            .when(
                selectCondition,
                b => b.select("u.name"),
            )
            .when(
                joinCondition,
                b => b
                    .join("INNER JOIN orders o ON o.user_id = u.id")
                    .select("o.total"),
            );

        const conditionalJoinSql = conditionalJoinBuilder.toString();

        expect(conditionalJoinSql).toBe(
            "SELECT u.id FROM users u",
        );

        type ConditionalJoinSql = BuilderSQL<typeof conditionalJoinBuilder>;
        type _ConditionalJoinSqlMatches = RequireTrue<
            AssertEqual<
                ConditionalJoinSql,
                "SELECT u.id, u.name, o.total FROM users u INNER JOIN orders o ON o.user_id = u.id"
            >
        >;

        type B_ConditionalJoinResult = BuilderReturnType<
            typeof conditionalJoinBuilder
        >;
        type IsValidConditionalJoinResult = RequireTrue<
            AssertEqual<B_ConditionalJoinResult, {
                id: User_id;
                name: string | undefined;
                total: number | undefined;
            }>
        >;
    });

    it("should support when() with two callbacks (ifTrue and ifFalse)", () => {
        const condition: boolean = false;

        // Using two-callback when() instead of chaining two when() calls
        // ifTrue: select name, ifFalse: join orders and select total
        const twoCallbackBuilder = createSelectQuery<B_JoinSchema>()
            .from("users u")
            .select("u.id")
            .when(
                condition,
                b => b.select("u.name"),
                b => b.join("INNER JOIN orders o ON o.user_id = u.id").select("o.total"),
            );

        // Runtime: condition is false, so ifFalse branch executes
        expect(twoCallbackBuilder.toString()).toBe(
            "SELECT u.id, o.total FROM users u INNER JOIN orders o ON o.user_id = u.id",
        );

        // Type-level SQL: merged string with ifTrue parts first, then ifFalse parts
        type TwoCallbackSql = BuilderSQL<typeof twoCallbackBuilder>;
        type _TwoCallbackSqlMatches = RequireTrue<
            AssertEqual<
                TwoCallbackSql,
                "SELECT u.id, u.name, o.total FROM users u INNER JOIN orders o ON o.user_id = u.id"
            >
        >;

        // Type-level: both branches are tracked, new columns are optional
        type TwoCallbackResult = BuilderReturnType<typeof twoCallbackBuilder>;
        type _TwoCallbackResultMatches = RequireTrue<
            AssertEqual<TwoCallbackResult, {
                id: User_id;
                name: string | undefined;
                total: number | undefined;
            }>
        >;
    });

    it("should support when() with two callbacks - true branch", () => {
        const condition: boolean = true;

        const builder = createSelectQuery<B_JoinSchema>()
            .from("users u")
            .select("u.id")
            .when(
                condition,
                b => b.select("u.name"),
                b => b.join("INNER JOIN orders o ON o.user_id = u.id").select("o.total"),
            );

        // Runtime: condition is true, so ifTrue branch executes
        expect(builder.toString()).toBe(
            "SELECT u.id, u.name FROM users u",
        );

        // Type-level SQL: merged string with ifTrue parts first, then ifFalse parts
        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<
                Sql,
                "SELECT u.id, u.name, o.total FROM users u INNER JOIN orders o ON o.user_id = u.id"
            >
        >;
    });

    it("should support when() with two callbacks including joins", () => {
        const includeOrders: boolean = false;

        const builder = createSelectQuery<B_JoinSchema>()
            .from("users u")
            .select("u.id")
            .when(
                includeOrders,
                b => b
                    .join("INNER JOIN orders o ON o.user_id = u.id")
                    .select("o.total"),
                b => b.select("u.name"),
            );

        // Runtime: condition is false, so ifFalse branch executes (no join)
        expect(builder.toString()).toBe(
            "SELECT u.id, u.name FROM users u",
        );

        // Type-level SQL: merged string with ifTrue parts first, then ifFalse parts
        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<
                Sql,
                "SELECT u.id, o.total, u.name FROM users u INNER JOIN orders o ON o.user_id = u.id"
            >
        >;

        // Type-level: both branches tracked
        type Result = BuilderReturnType<typeof builder>;
        type _ResultMatches = RequireTrue<
            AssertEqual<Result, {
                id: User_id;
                total: number | undefined;
                name: string | undefined;
            }>
        >;
    });
});

describe("removal by id", () => {
    type B_RemoveSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    name: string;
                    email: string;
                };
                logins: {
                    id: number;
                    user_id: number;
                };
                profiles: {
                    id: number;
                    user_id: number;
                    bio: string;
                };
            };
        };
    };

    it("removes select fragments by id", () => {
        const builder = createSelectQuery<B_RemoveSchema>()
            .from("users")
            .select("id", "id_part")
            .select("name", "name_part")
            .removeSelect("id_part");

        expect(builder.toString()).toBe("SELECT name FROM users");

        type RemovalSql = BuilderSQL<typeof builder>;
        type _RemovalSqlMatches = RequireTrue<
            AssertEqual<RemovalSql, "SELECT name FROM users">
        >;

        type RemovedRow = BuilderReturnType<typeof builder>;
        type _RemovedRowShape = RequireTrue<
            AssertEqual<RemovedRow, { name: string; }>
        >;
        type _RemovedRowHasNoId = RequireFalse<HasProperty<RemovedRow, "id">>;
    });

    it("removes joins by id and keeps remaining fragments", () => {
        const joinRemoval = createSelectQuery<B_RemoveSchema>()
            .from("users u")
            .select("u.id")
            .join("LEFT JOIN logins l ON l.user_id = u.id", "logins")
            .join("LEFT JOIN profiles p ON p.user_id = u.id", "profiles")
            .removeJoin("logins");

        expect(joinRemoval.toString()).toBe(
            "SELECT u.id FROM users u LEFT JOIN profiles p ON p.user_id = u.id",
        );

        type JoinRemovalRow = BuilderReturnType<typeof joinRemoval>;
        type _JoinRemovalRow = RequireTrue<
            AssertEqual<JoinRemovalRow, { id: number; }>
        >;

        type JoinRemovalSql = BuilderSQL<typeof joinRemoval>;
        type _JoinSqlMatches = RequireTrue<
            AssertEqual<
                JoinRemovalSql,
                "SELECT u.id FROM users u LEFT JOIN profiles p ON p.user_id = u.id"
            >
        >;
    });

    it("is a no-op inside when() on the type level", () => {
        const conditionalRemoval = createSelectQuery<B_RemoveSchema>()
            .from("users")
            .select("id", "user_id")
            .when(true, b => b.removeSelect("user_id"));

        expect(conditionalRemoval.toString()).toBe("SELECT * FROM users");

        type ConditionalSql = BuilderSQL<typeof conditionalRemoval>;
        type _ConditionalSqlMatches = RequireTrue<
            AssertEqual<ConditionalSql, "SELECT * FROM users">
        >;

        type ConditionalRow = BuilderReturnType<typeof conditionalRemoval>;
        type _ConditionalHasId = RequireTrue<HasProperty<ConditionalRow, "id">>;
        type _ConditionalIdIsNumber = RequireTrue<
            AssertExtends<ConditionalRow["id"], number>
        >;
    });
});

describe("when() coverage", () => {
    type B_WhenSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    name: string;
                    email: string;
                    active: boolean;
                };
                orders: {
                    id: number;
                    user_id: number;
                    total: number;
                    status: string;
                };
            };
        };
    };

    it("supports the full builder API inside conditional branches", () => {
        const applyConditional: boolean = true;
        const includeOrderExtras: boolean = true;

        const filters = createConditionTree("and")
            .add("u.active = TRUE", "active")
            .add("o.total > 50", "min_total");

        const conditionalBuilder = createSelectQuery<B_WhenSchema>()
            .from("users u")
            .select("u.id")
            .offset(10)
            .when(
                applyConditional,
                b => b
                    .join("LEFT JOIN orders o ON o.user_id = u.id", "orders")
                    .where(filters, "filters")
                    .limit(20)
                    .select([ "u.name", "u.email AS email_alias" ])
                    .when(
                        includeOrderExtras,
                        inner => inner.select([ "o.total", "o.status" ]),
                    ),
            );

        const conditionalSql = conditionalBuilder.toString();

        expect(conditionalSql).toBe(
            "SELECT u.id, u.name, u.email AS email_alias, o.total, o.status FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE (u.active = TRUE AND o.total > 50) LIMIT 20 OFFSET 10",
        );

        type ConditionalSqlLiteral = BuilderSQL<typeof conditionalBuilder>;
        type _ConditionalSqlLiteralMatches = RequireTrue<
            AssertEqual<
                ConditionalSqlLiteral,
                "SELECT u.id, u.name, u.email AS email_alias, o.total, o.status FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE (u.active = TRUE AND o.total > 50) LIMIT 20 OFFSET 10"
            >
        >;

        type ConditionalRow = BuilderReturnType<typeof conditionalBuilder>;
        type _ConditionalRowMatches = RequireTrue<
            AssertEqual<ConditionalRow, {
                id: number;
                name: string | undefined;
                email_alias: string | undefined;
                total: number | undefined;
                status: string | undefined;
            }>
        >;
    });
});

// ============================================================================
// Additional feature coverage
// ============================================================================

describe("clause assembly and typing", () => {
    type B_FullSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    name: string;
                    active: boolean;
                };
                orders: {
                    id: number;
                    user_id: number;
                    total: number;
                };
            };
        };
    };

    it("builds complex queries with arrays, aliases, and trees", () => {
        const filters = createConditionTree("and")
            .add("u.active = TRUE", "active")
            .add("o.total > 0", "total");

        const fullBuilder = createSelectQuery<B_FullSchema>()
            .from("public.users u")
            .select([ "u.id", "u.name" ])
            .join("LEFT JOIN orders o ON o.user_id = u.id", "orders")
            .select("o.total")
            .where(filters, "filters")
            .limit(5);

        const fullSql = fullBuilder.toString();

        expect(fullSql).toBe(
            "SELECT u.id, u.name, o.total FROM public.users u LEFT JOIN orders o ON o.user_id = u.id WHERE (u.active = TRUE AND o.total > 0) LIMIT 5",
        );

        type FullSql = BuilderSQL<typeof fullBuilder>;
        type _FullSqlMatches = RequireTrue<
            AssertEqual<
                FullSql,
                "SELECT u.id, u.name, o.total FROM public.users u LEFT JOIN orders o ON o.user_id = u.id WHERE (u.active = TRUE AND o.total > 0) LIMIT 5"
            >
        >;

        type FullRow = BuilderReturnType<typeof fullBuilder>;
        type _FullRowMatches = RequireTrue<
            AssertEqual<FullRow, {
                id: number;
                name: string;
                total: number;
            }>
        >;
    });

    it("supports group by, having, and order by", () => {
        type OrderItemId = string & { __type: "Orders_Table.id"; };
        type OrderUserId = string & { __type: "Orders_Table.userId"; };
        type OrderStatus = string & { __type: "Orders_Table.status"; };
        type OrderTotal = string & { __type: "Orders_Table.total"; };
        type UserId = string & { __type: "Users_Table.id"; };
        type UserName = string & { __type: "Users_Table.name"; };
        type ProductId = string & { __type: "Products_Table.id"; };
        type ProductName = string & { __type: "Products_Table.name"; };
        type B_GroupSchema = {
            defaultSchema: "public";
            schemas: {
                public: {
                    Orders_Table: {
                        id: OrderItemId;
                        userId: OrderUserId;
                        status: OrderStatus;
                        total: OrderTotal;
                    };
                    Users_Table: {
                        id: UserId;
                        name: UserName;
                    };
                    Products_Table: {
                        id: ProductId;
                        name: ProductName;
                        price: number;
                    };
                };
            };
        };

        const havingTree = createConditionTree("and").add(
            "COUNT(o.id) > 1",
            "min_count",
        );

        const grouped = createSelectQuery<B_GroupSchema>()
            .from(`"Orders_Table" o`)
            .select([
                `o."userId"`,
                `o.status`,
                `(o.status || ' ' || o."userId")::text as combined`,
            ])
            .groupBy([ `o."userId"`, `o.status` ])
            .having(havingTree)
            .orderBy([ `o."userId" asc nulls first`, `o.status desc` ]);

        const groupedSql = grouped.toString();

        expect(groupedSql).toBe(
            `SELECT o."userId", o.status, (o.status || ' ' || o."userId")::text as combined FROM "Orders_Table" o GROUP BY o."userId", o.status HAVING (COUNT(o.id) > 1) ORDER BY o."userId" asc nulls first, o.status desc`,
        );

        type GroupedSql = BuilderSQL<typeof grouped>;
        type _GroupedSqlMatches = RequireTrue<
            AssertEqual<
                GroupedSql,
                `SELECT o."userId", o.status, (o.status || ' ' || o."userId")::text as combined FROM "Orders_Table" o GROUP BY o."userId", o.status HAVING (COUNT(o.id) > 1) ORDER BY o."userId" asc nulls first, o.status desc`
            >
        >;

        type GroupedRow = BuilderReturnType<typeof grouped>;
        type _GroupedRowMatches = RequireTrue<
            AssertEqual<GroupedRow, {
                userId: OrderUserId;
                status: OrderStatus;
                combined: string;
            }>
        >;
    });

    it("supports subqueries as FROM sources", () => {
        const inner = createSelectQuery<B_FullSchema>()
            .from("orders")
            .select("user_id")
            .where("total > 100");

        const outer = createSelectQuery<B_FullSchema>()
            .from(inner)
            .select("user_id");

        const outerSql = outer.toString();

        expect(outerSql).toBe(
            "SELECT user_id FROM "
                + "(SELECT user_id FROM orders WHERE total > 100)",
        );

        type OuterSql = BuilderSQL<typeof outer>;
        type _OuterSqlFallsBackToString = RequireTrue<
            AssertExtends<OuterSql, string>
        >;

        type ReturnType = BuilderReturnType<typeof outer>;
        const _outerIdType: number = null as unknown as ReturnType["user_id"];
        type _ReturnTypeMatches = RequireTrue<
            AssertEqual<ReturnType, {
                user_id: number;
            }>
        >;
    });
});

describe("complex expressions in select()", () => {
    type B_ExprSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    name: string;
                    active: boolean;
                    meta: unknown;
                    settings: unknown;
                };
                orders: {
                    id: number;
                    user_id: number;
                    total: number;
                };
            };
        };
    };

    it("supports nested functions, casts, and case expressions", () => {
        const exprBuilder = createSelectQuery<B_ExprSchema>()
            .from("users u")
            .select(
                "COALESCE(u.name, 'n/a') AS display_name",
            )
            .select(
                "CASE WHEN u.active THEN 1 ELSE 0 END AS active_flag",
            )
            .select(`(u.id is not null)::boolean as id_not_null`)
            .select("CAST(u.id AS TEXT) AS id_text")
            .where("u.active = TRUE");

        const exprSql = exprBuilder.toString();

        expect(exprSql).toBe(
            "SELECT COALESCE(u.name, 'n/a') AS display_name, CASE WHEN u.active THEN 1 ELSE 0 END AS active_flag, (u.id is not null)::boolean as id_not_null, CAST(u.id AS TEXT) AS id_text FROM users u WHERE u.active = TRUE",
        );

        type ExprSql = BuilderSQL<typeof exprBuilder>;
        type _ExprSqlMatches = RequireTrue<
            AssertEqual<
                ExprSql,
                "SELECT COALESCE(u.name, 'n/a') AS display_name, CASE WHEN u.active THEN 1 ELSE 0 END AS active_flag, (u.id is not null)::boolean as id_not_null, CAST(u.id AS TEXT) AS id_text FROM users u WHERE u.active = TRUE"
            >
        >;

        type ReturnType = BuilderReturnType<typeof exprBuilder>;
        // Debug assignment to surface inferred shape in compiler errors if mismatched
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _dbgReturnType: ReturnType = null as unknown as {
            display_name: unknown;
            active_flag: unknown;
            id_not_null: boolean;
            id_text: string;
        };
        type _ReturnTypeMatches = RequireTrue<
            AssertEqual<ReturnType, {
                display_name: unknown;
                active_flag: unknown;
                id_not_null: boolean;
                id_text: string;
            }>
        >;
    });

    it("supports JSON operators and scalar subqueries", () => {
        const exprBuilder = createSelectQuery<B_ExprSchema>()
            .from("users u")
            .select("u.meta->>'foo' AS foo")
            .select("json_extract_path_text(u.meta, 'bar') AS bar")
            .select("u.settings#>>'{emails,0}' AS first_email")
            .select(
                "(SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count",
            );

        const exprSql = exprBuilder.toString();

        expect(exprSql).toBe(
            "SELECT u.meta->>'foo' AS foo, json_extract_path_text(u.meta, 'bar') AS bar, u.settings#>>'{emails,0}' AS first_email, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u",
        );

        type ExprSqlLiteral = BuilderSQL<typeof exprBuilder>;
        type _ExprSqlLiteralMatches = RequireTrue<
            AssertEqual<
                ExprSqlLiteral,
                "SELECT u.meta->>'foo' AS foo, json_extract_path_text(u.meta, 'bar') AS bar, u.settings#>>'{emails,0}' AS first_email, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u"
            >
        >;
        type ReturnType = BuilderReturnType<typeof exprBuilder>;
        type _ReturnTypeMatches = RequireTrue<
            AssertEqual<ReturnType, {
                foo: unknown;
                bar: unknown;
                first_email: unknown;
                order_count: number;
            }>
        >;
    });
});

describe("type safety and helper exposure", () => {
    type B_TypeSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    name: string;
                    active: boolean;
                };
                orders: {
                    id: number;
                    user_id: number;
                    total: number;
                };
            };
        };
    };

    it("defers column validation to runtime/toString", () => {
        const unvalidated = createSelectQuery<B_TypeSchema>()
            .from("users")
            .select("missing");

        const sql = unvalidated.toString();

        expect(sql).toBe("SELECT missing FROM users");

        type UnvalidatedSql = BuilderSQL<typeof unvalidated>;
        type _UnvalidatedSqlMatches = RequireTrue<
            AssertEqual<UnvalidatedSql, "SELECT missing FROM users">
        >;
    });

    it("surfaces schema errors on the branded return type", () => {
        const invalidBuilder = createSelectQuery<B_TypeSchema>()
            .from("missing_table")
            .select("id");

        const invalidSql = invalidBuilder.toString();
        const brandedInvalidSql = invalidBuilder.toBrandedString();

        expect(invalidSql).toBe(
            "SELECT id FROM missing_table",
        );
        expect(brandedInvalidSql as string).toBe(invalidSql);

        type InvalidSql = BuilderSQL<typeof invalidBuilder>;
        type _InvalidSqlMatches = RequireTrue<
            AssertEqual<InvalidSql, "SELECT id FROM missing_table">
        >;

        type InvalidReturn = BuilderReturnType<typeof invalidBuilder>;
        type _IsMatchError = RequireTrue<
            AssertExtends<
                InvalidReturn,
                { __error: true; message: string; }
            >
        >;

        type BuilderValidation = ValidateBuilder<typeof invalidBuilder>;
        type _ValidateBuilder = RequireTrue<
            AssertExtends<BuilderValidation, string>
        >;
    });

    it("exposes BuilderSQL literals alongside runtime SQL", () => {
        const literalBuilder = createSelectQuery<B_TypeSchema>()
            .from("users")
            .select("id")
            .select("name", "name_fragment")
            .where("active = TRUE");

        type LiteralSQL = BuilderSQL<typeof literalBuilder>;
        type _LiteralSqlMatches = RequireTrue<
            AssertEqual<
                LiteralSQL,
                "SELECT id, name FROM users WHERE active = TRUE"
            >
        >;

        const literalSql = literalBuilder.toString();

        expect(literalSql).toBe(
            "SELECT id, name FROM users WHERE active = TRUE",
        );

        const brandedLiteralSql = literalBuilder.toBrandedString();
        expect(brandedLiteralSql as string).toBe(literalSql);

        type LiteralRow = BuilderReturnType<typeof literalBuilder>;
        type _LiteralRow = RequireTrue<
            AssertEqual<LiteralRow, { id: number; name: string; }>
        >;
    });

    it("tracks LIMIT in BuilderSQL without calling toBrandedString", () => {
        const limitedBuilder = createSelectQuery<B_TypeSchema>()
            .from("users")
            .select("id")
            .limit(3);

        type LimitedSQL = BuilderSQL<typeof limitedBuilder>;
        type _LimitedSqlMatches = RequireTrue<
            AssertEqual<LimitedSQL, "SELECT id FROM users LIMIT 3">
        >;

        const limitedSql = limitedBuilder.toString();
        expect(limitedSql).toBe("SELECT id FROM users LIMIT 3");
    });
});

describe("withParams()", () => {
    type User_id = string & { __type: "Users_Table.id"; };
    type Order_id = string & { __type: "Orders_Table.id"; };
    type B_ParamSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: number;
                    active: boolean;
                    status: string;
                    createdAt: string;
                };
                Orders_Table: {
                    id: Order_id;
                    user_id: number;
                    total: number;
                };
            };
        };
    };

    const startDate = `${Math.floor(Math.random() * 10000)}-01-01`;

    function setPeriod<
        Schema extends DatabaseSchema,
        State extends AnyBuilderStateTag,
        Sql extends AnyBuilderSqlTag,
        Field extends string,
    >(
        b: SelectQueryBuilder<Schema, State, Sql>,
        field: Field,
    ) {
        const [ start, end ] = [
            startDate,
            `2025-01-31`,
        ];

        return b
            .when(
                !!start && !!end,
                (b) => b.where(`${field} between '${start}' and '${end}'`),
            )
            .when(!!start && !end, b => b.where(`${field} >= '${start}'`))
            .when(!start && !!end, b => b.where(`${field} <= '${end}'`));
    }

    it("accumulates params and preserves placeholder literals", () => {
        // Use deterministic conditions for runtime testing
        const customCondition = true;
        const builder = createSelectQuery<B_ParamSchema>()
            .from("users u")
            .select([ "u.id", `u."createdAt"` ])
            .orderBy("u.id desc")
            .withParams([ 1 ] as const, (b, paramString) => {
                const _firstPlaceholder: "$1" = paramString;
                return b.where(`u.id = ${paramString}`);
            })
            .withParams([ true, "active" ] as const, (b, paramString) => {
                const _secondPlaceholder: "$2, $3" = paramString;
                return b.where(`u.status IN (${paramString})`);
            })
            .offset(10 as number)
            .limit(10 as number)
            .where("u.id > 10")
            .when(customCondition, (b) => b.where("u.active = TRUE"))
            .when(customCondition, (b) => b.where("u.id > 100"))
            .when(!customCondition, (b) => b.where("u.id < 100"))
            .when(true, b => setPeriod(b, "u.createdAt"));

        // Runtime: only conditions that are true at runtime are included
        // - customCondition=true: includes "u.active = TRUE" and "u.id > 100", excludes "u.id < 100"
        // - setPeriod: since both start and end are truthy, only the "between" clause is added
        expect(builder.toString()).toBe(
            `SELECT u.id, u."createdAt" FROM users u WHERE u.id = $1 AND u.status IN ($2, $3) AND u.id > 10 AND u.active = TRUE AND u.id > 100 AND u.createdAt between '${startDate}' and '2025-01-31' ORDER BY u.id desc LIMIT 10 OFFSET 10`,
        );
        expect(builder.getParams()).toEqual([ 1, true, "active" ]);

        type ParamRow = BuilderReturnType<typeof builder>;

        // Type-level: ALL .when() branches are tracked regardless of runtime conditions
        type ParamSql = BuilderSQL<typeof builder>;
        const _paramSqlLiteral:
            `SELECT u.id, u."createdAt" FROM users u WHERE u.id = $1 AND u.status IN ($2, $3) AND u.id > 10 AND u.active = TRUE AND u.id > 100 AND u.id < 100 AND u.createdAt between '${string}' and '${string}' AND u.createdAt >= '${string}' AND u.createdAt <= '${string}' ORDER BY u.id desc LIMIT ${number} OFFSET ${number}` =
                null as any as ParamSql;
    });
});

describe("assembleSelectSQL utility coverage", () => {
    it("renders every clause in order", () => {
        const runtimeState: RuntimeSelectState = {
            select: {},
            from: undefined,
            joins: [
                {
                    id: "j1",
                    ast: undefined as any,
                    strictness: "LEFT",
                    optional: false,
                },
            ],
            where: {},
            groupBy: {},
            having: {},
            orderBy: {},
            limit: 10,
            offset: 5,
            ctes: {},
            distinct: true,
            union: undefined,
            params: [],
            selectSql: {
                base: [ "users.id", "o.total" ],
            },
            fromSql: "users",
            joinSql: {
                j1: "LEFT JOIN orders o ON o.user_id = users.id",
            },
            whereSql: {
                w1: "(users.active = TRUE)",
                w2: "(o.total > 0)",
            },
            groupBySql: {
                g1: "users.id, o.total",
            },
            havingSql: {
                h1: "o.total > 0",
            },
            orderBySql: {
                o1: "o.total DESC",
            },
            cteSql: {
                c1: "active_users AS (SELECT id FROM users WHERE active = TRUE)",
            },
            unionSql: "UNION SELECT * FROM archived_users",
        };

        const assembled = assembleSelectSQL(runtimeState);

        expect(assembled).toBe(
            "WITH active_users AS (SELECT id FROM users WHERE active = TRUE) SELECT DISTINCT users.id, o.total FROM users LEFT JOIN orders o ON o.user_id = users.id WHERE (users.active = TRUE) AND (o.total > 0) GROUP BY users.id, o.total HAVING o.total > 0 ORDER BY o.total DESC LIMIT 10 OFFSET 5 UNION SELECT * FROM archived_users",
        );
    });
});

describe("reusable parts", () => {
    type UserId = string & { __type: "Users_Table.id"; };
    type UserName = string & { __type: "Users_Table.name"; };
    type UserActive = boolean & { __type: "Users_Table.active"; };
    type OrderId = string & { __type: "Orders_Table.id"; };
    type OrderUserId = string & { __type: "Orders_Table.userId"; };
    type OrderTotal = string & { __type: "Orders_Table.total"; };
    type B_ReuseSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                users: {
                    id: UserId;
                    name: UserName;
                    active: UserActive;
                };
                orders: {
                    id: OrderId;
                    userId: OrderUserId;
                    total: OrderTotal;
                };
            };
        };
    };

    // Reusable part: adds WHERE clause
    const addActiveFilter = <
        Schema extends DatabaseSchema,
        State extends AnyBuilderStateTag,
        Sql extends AnyBuilderSqlTag,
    >(
        b: SelectQueryBuilder<Schema, State, Sql>,
    ) => b.where("active = TRUE");

    // Reusable part: adds SELECT
    const selectName = <
        Schema extends DatabaseSchema,
        State extends AnyBuilderStateTag,
        Sql extends AnyBuilderSqlTag,
    >(
        b: SelectQueryBuilder<Schema, State, Sql>,
    ) => b.select("name");

    it("applies reusable parts using .apply()", () => {
        const builder = createSelectQuery<B_ReuseSchema>()
            .from("users")
            .select("id")
            .apply(addActiveFilter)
            .apply(selectName);

        const sql = builder.toString();
        expect(sql).toBe("SELECT id, name FROM users WHERE active = TRUE");

        type ReuseSql = BuilderSQL<typeof builder>;
        type _ReuseSqlMatches = RequireTrue<
            AssertEqual<
                ReuseSql,
                "SELECT id, name FROM users WHERE active = TRUE"
            >
        >;

        type ReuseRow = BuilderReturnType<typeof builder>;
        type _ReuseRowIdMatches = RequireTrue<
            AssertEqual<ReuseRow["id"], UserId>
        >;
        type _ReuseRowKeys = RequireTrue<
            AssertEqual<keyof ReuseRow, "id" | "name">
        >;
        type _ReuseRowMatches = RequireTrue<
            AssertEqual<ReuseRow, { id: UserId; name: UserName; }>
        >;
    });
});

// ============================================================================
// UntypedSelectBuilder Tests
// ============================================================================

import { createUntypedQuery } from "../../src/index.js";
import type { UntypedSelectBuilder } from "../../src/select/builder.js";

describe("UntypedSelectBuilder", () => {
    // Define a result type upfront – no schema needed
    interface OrderSummary {
        orderId: number;
        customerName: string;
        total: number;
    }

    it("generates correct SQL without type computation", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders o")
            .join("LEFT JOIN customers c ON c.id = o.customer_id")
            .select([ "o.id AS orderId", "c.name AS customerName", "o.total" ])
            .where("o.status = 'completed'")
            .orderBy("o.total DESC")
            .limit(10)
            .offset(5);

        expect(query.toString()).toBe(
            "SELECT o.id AS orderId, c.name AS customerName, o.total "
                + "FROM orders o "
                + "LEFT JOIN customers c ON c.id = o.customer_id "
                + "WHERE o.status = 'completed' "
                + "ORDER BY o.total DESC "
                + "LIMIT 10 "
                + "OFFSET 5",
        );
    });

    it("preserves Result type through method chaining", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders")
            .select("*");

        // Type should be UntypedSelectBuilder<OrderSummary>, not computed
        type QueryType = typeof query;
        type _CheckType = RequireTrue<
            AssertExtends<QueryType, UntypedSelectBuilder<OrderSummary>>
        >;
    });

    it("supports when() conditional execution", () => {
        const includeInactive = false;
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .when(includeInactive, (b) => b.where("active = FALSE"))
            .when(!includeInactive, (b) => b.where("active = TRUE"));

        // Runtime: only the TRUE condition is applied
        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );
    });

    it("supports when() with two callbacks (ifTrue and ifFalse)", () => {
        const includeInactive = false;
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .when(
                includeInactive,
                (b) => b.where("active = FALSE"),
                (b) => b.where("active = TRUE"),
            );

        // Runtime: condition is false, so ifFalse branch executes
        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );
    });

    it("supports when() with two callbacks - true branch", () => {
        const includeInactive = true;
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .when(
                includeInactive,
                (b) => b.where("active = FALSE"),
                (b) => b.where("active = TRUE"),
            );

        // Runtime: condition is true, so ifTrue branch executes
        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = FALSE",
        );
    });

    it("supports withParams()", () => {
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .withParams([ 42, "active" ], (b, paramString) => {
                return b.where(
                    `id = ${paramString.split(", ")[0]} AND status = ${
                        paramString.split(", ")[1]
                    }`,
                );
            });

        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE id = $1 AND status = $2",
        );
        expect(query.getParams()).toEqual([ 42, "active" ]);
    });

    it("is assignable to functions expecting SelectQueryBuilder<any, any, any>", () => {
        // This helper function is typed for SelectQueryBuilder
        function addPagination<
            Schema extends DatabaseSchema,
            State extends AnyBuilderStateTag,
            Sql extends AnyBuilderSqlTag,
        >(
            b: SelectQueryBuilder<Schema, State, Sql>,
            page: number,
            size: number,
        ) {
            return b.when(true, b => b.limit(size).offset((page - 1) * size));
        }

        const untypedQuery = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id");

        // Untyped builder should work with typed helper functions
        const paginatedQuery = addPagination(
            untypedQuery as unknown as SelectQueryBuilder<any, any, any>,
            2,
            10,
        );

        expect(paginatedQuery.toString()).toBe(
            "SELECT id FROM users LIMIT 10 OFFSET 10",
        );
    });

    it("supports apply() for composition", () => {
        function addActiveFilter(b: UntypedSelectBuilder<any>) {
            return b.where("active = TRUE");
        }

        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .apply(addActiveFilter);

        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );
    });

    it("supports groupBy and having", () => {
        interface CategoryStats {
            category: string;
            count: number;
        }

        const query = createUntypedQuery<CategoryStats>()
            .from("products")
            .select([ "category", "COUNT(*) AS count" ])
            .groupBy("category")
            .having("COUNT(*) > 5");

        expect(query.toString()).toBe(
            "SELECT category, COUNT(*) AS count FROM products GROUP BY category HAVING COUNT(*) > 5",
        );
    });

    it("extracts Result type via branded string", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders")
            .select("*");

        const branded = query.toBrandedString();

        // The branded string carries the Result type
        type BrandedResult = typeof branded.__type;
        type _CheckBrand = RequireTrue<
            AssertEqual<BrandedResult, OrderSummary>
        >;
    });
});

// ============================================================================
// Export for verification
// ============================================================================

export type BuilderPhase2TestsPass = true;
