/**
 * SELECT Builder Type Safety Tests
 *
 * Tests for type safety and helper exposure.
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type { ValidateBuilder } from "../../../src/select/builder-types/validation.js";

import type {
    AssertEqual,
    AssertExtends,
    HasProperty,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";

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
