/**
 * SELECT Builder assembleSelectSQL Utility Tests
 *
 * Tests for assembleSelectSQL utility coverage.
 */

import { describe, expect, it } from "bun:test";

import type {
    RuntimeSelectState,
} from "../../../src/select/builder-types/builder.js";

import { assembleSelectSQL } from "../../../src/index.js";

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
            namedParams: {},
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
