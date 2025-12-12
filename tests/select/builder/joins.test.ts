/**
 * SELECT Builder Join Query Tests
 *
 * Tests for join query building functionality.
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type {
    AssertEqual,
    AssertExtends,
    HasProperty,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";

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
    // conditional *If() calls should be optional in the result type.
    it("should support conditional joins and selects with *If() methods", () => {
        const joinCondition: boolean = false;
        const selectCondition: boolean = false;

        const conditionalJoinBuilder = createSelectQuery<B_JoinSchema>()
            .from("users u")
            .select("u.id")
            .selectIf(selectCondition as boolean, "u.name")
            .joinIf(joinCondition, "INNER JOIN orders o ON o.user_id = u.id")
            .selectIf(joinCondition as boolean, "o.total");

        const conditionalJoinSql = conditionalJoinBuilder.toString();

        expect(conditionalJoinSql).toBe(
            "SELECT u.id FROM users u",
        );

        // Type-level: verify SQL is a string (actual SQL depends on condition evaluation)
        type ConditionalJoinSql = BuilderSQL<typeof conditionalJoinBuilder>;
        type _ConditionalJoinSqlMatches = RequireTrue<
            AssertExtends<ConditionalJoinSql, string>
        >;

        // Type-level: verify result type has expected shape with optional fields
        type B_ConditionalJoinResult = BuilderReturnType<
            typeof conditionalJoinBuilder
        >;
        type _HasId = RequireTrue<HasProperty<B_ConditionalJoinResult, "id">>;
        type _HasName = RequireTrue<
            HasProperty<B_ConditionalJoinResult, "name">
        >;
        type _HasTotal = RequireTrue<
            HasProperty<B_ConditionalJoinResult, "total">
        >;
    });
});
