/**
 * SELECT Builder withParams() Tests
 *
 * Tests for parameter handling with withParams().
 */

import { describe, expect, it } from "bun:test";

import type {
    BuilderReturnType,
} from "../../../src/select/builder-types/return-type.js";

import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
} from "../../../src/select/builder-types/helpers.js";

import type {
    SelectQueryBuilder,
} from "../../../src/select/builder-types/builder.js";

import type { HasProperty, RequireTrue } from "../../helpers.js";

import type { DatabaseSchema } from "../../../src/common/schema.js";
import { createSelectQuery } from "../../../src/index.js";

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

    // Reusable builder function that adds date period filtering.
    // Uses whereIf() internally for O(1) type computation per call.
    function setPeriod<
        Schema extends DatabaseSchema,
        State extends AnyBuilderStateTag,
        Sql extends AnyBuilderSqlTag,
    >(
        b: SelectQueryBuilder<Schema, State, Sql>,
        field: string,
    ): SelectQueryBuilder<Schema, State, Sql> {
        const [ start, end ] = [
            startDate,
            `2025-01-31`,
        ];

        return b
            .whereIf(
                !!start && !!end,
                `${field} between '${start}' and '${end}'`,
            )
            .whereIf(!!start && !end, `${field} >= '${start}'`)
            .whereIf(
                !start && !!end,
                `${field} <= '${end}'`,
            ) as SelectQueryBuilder<Schema, State, Sql>;
    }

    it("accumulates params and preserves placeholder literals", () => {
        // Using whereIf() and applyIf() instead of when() for O(1) type computation.
        // Use literal true/false to get precise types (no unions from boolean).
        const builder = createSelectQuery<B_ParamSchema>()
            .from("users u")
            .select([ "u.id", `u."createdAt"` ])
            .orderBy("u.id desc")
            .withParams({ userId: 1, isActive: true, status: "active" })
            .where(`u.id = :userId`)
            .where(`u.status IN (:isActive, :status)`)
            .offset(10 as number)
            .limit(10 as number)
            .where("u.id > 10")
            .whereIf(true, "u.active = TRUE")
            .whereIf(true, "u.id > 100")
            .whereIf(false, "u.id < 100")
            .applyIf(true, b => setPeriod(b, "u.createdAt"));

        type _ParamRow = BuilderReturnType<typeof builder>;

        // Runtime: only conditions that are true at runtime are included
        // - customCondition=true: includes "u.active = TRUE" and "u.id > 100", excludes "u.id < 100"
        // - setPeriod: since both start and end are truthy, only the "between" clause is added
        expect(builder.toString()).toBe(
            `SELECT u.id, u."createdAt" FROM users u WHERE u.id = $1 AND u.status IN ($2, $3) AND u.id > 10 AND u.active = TRUE AND u.id > 100 AND u.createdAt between '${startDate}' and '2025-01-31' ORDER BY u.id desc LIMIT 10 OFFSET 10`,
        );
        expect(builder.getParams()).toEqual([ 1, true, "active" ]);
    });

    it("infers correct row type from builder", () => {
        // Separate test for type-level inference with simpler builder chain
        const builder = createSelectQuery<B_ParamSchema>()
            .from("users u")
            .select([ "u.id", `u."createdAt"` ]);

        type ParamRow = BuilderReturnType<typeof builder>;

        // Type-level: verify the row type is inferred correctly
        type _RowHasId = RequireTrue<HasProperty<ParamRow, "id">>;
        type _RowHasCreatedAt = RequireTrue<HasProperty<ParamRow, "createdAt">>;
    });

    it("handles whereIf with potentially undefined constants", () => {
        // Simulate filter parameters that may or may not be provided
        const userId: number | undefined = 42;
        const status: string | undefined = "active";
        const minTotal: number | false = false;
        const isActive: boolean | undefined = true;
        const createdAfter: string | undefined = "2024-01-01";
        const deletedAt: string | undefined = undefined;

        const builder = createSelectQuery<B_ParamSchema>()
            .from("users u")
            .select([ "u.id", "u.status", "u.active" ])
            .withParams({
                userId: userId!,
                status: status!,
                minTotal: minTotal!,
                isActive: isActive!,
                createdAfter: createdAfter!,
                deletedAt: deletedAt!,
            })
            // Only add WHERE clauses when the filter value is defined
            .whereIf(!!userId, `u.id = :userId`)
            .whereIf(!!status, `u.status = :status`)
            .whereIf(!!minTotal, `u.id > :minTotal`)
            .whereIf(!!isActive, `u.active = :isActive`)
            .whereIf(!!createdAfter, `u."createdAt" >= :createdAfter`)
            .whereIf(!!deletedAt, `u."createdAt" <= :deletedAt`);

        // Runtime: only conditions with defined values should be included
        // - userId: 42 (defined) -> included
        // - status: "active" (defined) -> included
        // - minTotal: undefined -> excluded
        // - isActive: true (defined) -> included
        // - createdAfter: "2024-01-01" (defined) -> included
        // - deletedAt: undefined -> excluded
        const sql = builder.toString();
        console.log("Generated SQL:", sql);

        expect(sql).toBe(
            `SELECT u.id, u.status, u.active FROM users u WHERE u.id = $1 AND u.status = $2 AND u.active = $3 AND u."createdAt" >= $4`,
        );
        expect(builder.getParams()).toEqual([
            42,
            "active",
            true,
            "2024-01-01",
        ]);
    });

    it("handles whereIf with all undefined constants", () => {
        // All filters are undefined
        const userId: number | undefined = undefined;
        const status: string | undefined = "active";
        const active: boolean | undefined = undefined;

        const builder = createSelectQuery<B_ParamSchema>()
            .withParams({ userId: userId!, status: status!, active: active! })
            .from("users u")
            .select([ "u.id" ])
            .whereIf(!!userId, `u.id = :userId`)
            .whereIf(!!status, `u.status = :status`)
            .whereIf(!!active, `u.active = :active`);

        const sql = builder.toString();
        console.log("Generated SQL (no filters):", sql);

        expect(sql).toBe(`SELECT u.id FROM users u WHERE u.status = $1`);
        expect(builder.getParams()).toEqual([ "active" ]);
    });

    it("handles whereIf with mixed constants and named params", () => {
        // Mix of always-present and conditional params
        const status: string = "active";
        const searchTerm: string | undefined = "john";
        const minId: number | undefined = undefined;
        const maxId: number | undefined = 100;

        const builder = createSelectQuery<B_ParamSchema>()
            .from("users u")
            .select([ "u.id", "u.status" ])
            .withParams({
                status,
                searchTerm: searchTerm!,
                minId: minId!,
                maxId: maxId!,
            })
            .where("u.status = :status")
            // Add conditional filters based on whether params are defined
            .whereIf(!!searchTerm, `u.status ILIKE '%' || :searchTerm || '%'`)
            .whereIf(!!minId, `u.id >= :minId`)
            .whereIf(!!maxId, `u.id <= :maxId`);

        const sql = builder.toString();
        console.log("Generated SQL (mixed):", sql);

        // status is always present -> $1
        // searchTerm is defined -> $2
        // minId is undefined -> excluded
        // maxId is defined -> $3
        expect(sql).toBe(
            `SELECT u.id, u.status FROM users u WHERE u.status = $1 AND u.status ILIKE '%' || $2 || '%' AND u.id <= $3`,
        );
        expect(builder.getParams()).toEqual([ "active", "john", 100 ]);
    });
});
