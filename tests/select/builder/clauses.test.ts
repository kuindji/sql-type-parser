/**
 * SELECT Builder Clause Assembly Tests
 *
 * Tests for clause assembly and typing (complex queries, group by, having, order by, subqueries).
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type {
    AssertEqual,
    AssertExtends,
    RequireTrue,
} from "../../helpers.js";

import {
    createConditionTree,
    createSelectQuery,
} from "../../../src/index.js";

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
            .select(/*sql*/ `array_agg(o."id") as "paymentIds"`)
            .groupBy([ `o."userId"`, `o.status` ])
            .having(havingTree)
            .orderBy([ `o."userId" asc nulls first`, `o.status desc` ]);

        const groupedSql = grouped.toString();

        expect(groupedSql).toBe(
            `SELECT o."userId", o.status, (o.status || ' ' || o."userId")::text as combined, array_agg(o."id") as "paymentIds" FROM "Orders_Table" o GROUP BY o."userId", o.status HAVING (COUNT(o.id) > 1) ORDER BY o."userId" asc nulls first, o.status desc`,
        );

        type GroupedSql = BuilderSQL<typeof grouped>;
        type _GroupedSqlMatches = RequireTrue<
            AssertEqual<
                GroupedSql,
                `SELECT o."userId", o.status, (o.status || ' ' || o."userId")::text as combined, array_agg(o."id") as "paymentIds" FROM "Orders_Table" o GROUP BY o."userId", o.status HAVING (COUNT(o.id) > 1) ORDER BY o."userId" asc nulls first, o.status desc`
            >
        >;

        type GroupedRow = BuilderReturnType<typeof grouped>;
        type _GroupedRowMatches = RequireTrue<
            AssertEqual<GroupedRow, {
                userId: OrderUserId;
                status: OrderStatus;
                combined: string;
                paymentIds: unknown;
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
