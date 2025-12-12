/**
 * SELECT Builder Reusable Parts Tests
 *
 * Tests for reusable parts and composition via apply().
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
} from "../../../src/select/builder-types/helpers.js";

import type {
    SelectQueryBuilder,
} from "../../../src/select/builder-types/builder.js";

import type {
    AssertEqual,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";
import type { DatabaseSchema } from "../../../src/common/schema.js";

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
