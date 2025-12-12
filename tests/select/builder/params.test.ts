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

import type {
    HasProperty,
    RequireTrue,
} from "../../helpers.js";

import { createSelectQuery } from "../../../src/index.js";
import type { DatabaseSchema } from "../../../src/common/schema.js";

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
});
