/**
 * SELECT Builder Removal Tests
 *
 * Tests for removal by id functionality (removeSelect, removeJoin).
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
    RequireFalse,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";

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

    it("is a no-op inside applyIf() on the type level", () => {
        const conditionalRemoval = createSelectQuery<B_RemoveSchema>()
            .from("users")
            .select("id", "user_id")
            .applyIf(true, b => b.removeSelect("user_id"));

        expect(conditionalRemoval.toString()).toBe("SELECT * FROM users");

        type ConditionalSql = BuilderSQL<typeof conditionalRemoval>;
        type _ConditionalSqlMatches = RequireTrue<
            AssertEqual<ConditionalSql, "SELECT id FROM users">
        >;

        type ConditionalRow = BuilderReturnType<typeof conditionalRemoval>;
        type _ConditionalHasId = RequireTrue<HasProperty<ConditionalRow, "id">>;
        type _ConditionalIdIsNumber = RequireTrue<
            AssertExtends<ConditionalRow["id"], number>
        >;
    });
});
