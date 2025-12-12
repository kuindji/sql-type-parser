/**
 * SELECT Builder Basic Query Tests
 *
 * Tests for basic query building functionality.
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

        const includeEmail: boolean = false;

        const builderQuery = createSelectQuery<B_RuntimeSchema>()
            .from("users")
            .select("id")
            .select("name")
            .selectIf(includeEmail as boolean, "email")
            .where("active = TRUE", "active_filter")
            .limit(10);

        const builderSql = builderQuery.toString();

        // Runtime string validation – focuses on assembly order and keywords.
        expect(builderSql).toBe(
            "SELECT id, name FROM users WHERE active = TRUE LIMIT 10",
        );

        // Type-level: with boolean condition, selectIf() includes the column
        // in the SQL (optimistic) and marks it as optional in the result type
        type BuilderSqlLiteral = BuilderSQL<typeof builderQuery>;
        type _TypeSqlIncludesConditionalSelect = RequireTrue<
            AssertExtends<
                BuilderSqlLiteral,
                string
            >
        >;

        const brandedSql = builderQuery.toBrandedString();
        expect(brandedSql as string).toBe(builderSql);

        type ReturnType = BuilderReturnType<typeof builderQuery>;
        type _ReturnHasId = RequireTrue<HasProperty<ReturnType, "id">>;
        type _ReturnHasName = RequireTrue<HasProperty<ReturnType, "name">>;
        type _ReturnHasEmail = RequireTrue<HasProperty<ReturnType, "email">>;
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

    it("should use outermost cast type with nested casts", () => {
        // When an expression contains nested casts like `(x::numeric)::float8`,
        // the outermost cast (float8) should determine the result type.

        type B_NestedCastSchema = {
            defaultSchema: "public";
            schemas: {
                public: {
                    users: {
                        id: number;
                        amount: string;
                    };
                };
            };
        };

        const nestedCastBuilder = createSelectQuery<B_NestedCastSchema>()
            .from("users")
            .select(/*sql*/ `sum(
                    convert_currency(
                        p."amount"::numeric,
                        'USD'::text,
                        'GBP'::text,
                        p."createdAt"::date
                    ) +
                    convert_currency(
                        p."vat"::numeric,
                        'USD'::text,
                        'EUR'::text,
                        p."createdAt"::date
                    )
                )::float8 as "total"`);

        const nestedCastSql = nestedCastBuilder.toString();

        expect(nestedCastSql).toBe(
            `SELECT sum(
                    convert_currency(
                        p."amount"::numeric,
                        'USD'::text,
                        'GBP'::text,
                        p."createdAt"::date
                    ) +
                    convert_currency(
                        p."vat"::numeric,
                        'USD'::text,
                        'EUR'::text,
                        p."createdAt"::date
                    )
                )::float8 as "total" FROM users`,
        );

        type NestedCastResult = BuilderReturnType<typeof nestedCastBuilder>;
        type _NestedCastIsNumber = RequireTrue<
            AssertEqual<NestedCastResult, {
                total: number;
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
