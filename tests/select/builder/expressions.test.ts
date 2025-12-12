/**
 * SELECT Builder Complex Expression Tests
 *
 * Tests for complex expressions in select() - nested functions, casts, case expressions, JSON operators.
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type {
    AssertEqual,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";

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
