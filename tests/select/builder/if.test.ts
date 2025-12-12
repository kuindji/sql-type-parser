import { describe, expect, it } from "bun:test";
/**
 * SELECT Builder *If() Methods Tests
 *
 * Tests for conditional *If() methods that provide a more performant
 * alternative to when() for simple conditional clauses:
 * - selectIf, joinIf, whereIf, groupByIf, havingIf, orderByIf, limitIf, offsetIf
 *
 * These methods avoid callback type inference, making them significantly
 * faster for TypeScript to process than nested when() calls.
 */

import type { SelectQueryBuilder } from "../../../src/select/builder-types/builder.js";
import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
} from "../../../src/select/builder-types/helpers.js";
import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../../src/select/builder-types/return-type.js";

import type { AssertEqual, AssertExtends, RequireTrue } from "../../helpers.js";

import {
    createConditionTree,
    createSelectQuery,
    createUntypedQuery,
} from "../../../src/index.js";

import type { DatabaseSchema } from "../../../src/common/schema.js";

// ============================================================================
// Test Schema
// ============================================================================

type UserId = string & { __type: "users.id"; };
type UserName = string & { __type: "users.name"; };
type OrderId = string & { __type: "orders.id"; };
type OrderTotal = number & { __type: "orders.total"; };

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: UserId;
                name: UserName;
                email: string;
                active: boolean;
                createdAt: string;
            };
            orders: {
                id: OrderId;
                userId: UserId;
                total: OrderTotal;
                status: string;
            };
        };
    };
};

// ============================================================================
// whereIf() Tests
// ============================================================================

describe("whereIf()", () => {
    it("should add WHERE clause when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(true, "active = TRUE");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users WHERE active = TRUE">
        >;
    });

    it("should NOT add WHERE clause when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(false, "active = TRUE");

        expect(builder.toString()).toBe("SELECT id FROM users");

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users">
        >;
    });

    it("should work with runtime boolean conditions", () => {
        const condition: boolean = Math.random() > 0.5;

        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(condition, "active = TRUE");

        // Type-level: both possibilities are tracked
        type Sql = BuilderSQL<typeof builder>;
        type _SqlIsUnion = RequireTrue<
            AssertExtends<
                Sql,
                | "SELECT id FROM users WHERE active = TRUE"
                | "SELECT id FROM users"
            >
        >;
    });

    it("should chain multiple whereIf() calls", () => {
        const includeActive = true;
        const includeEmail = false;

        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(includeActive, "active = TRUE")
            .whereIf(includeEmail, "email IS NOT NULL");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );

        // Type-level: second whereIf has literal false, so it's not in the type
        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<
                Sql,
                "SELECT id FROM users WHERE active = TRUE"
            >
        >;
    });

    it("should chain multiple whereIf() calls with all true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(true, "active = TRUE")
            .whereIf(true, "email IS NOT NULL");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE AND email IS NOT NULL",
        );

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<
                Sql,
                "SELECT id FROM users WHERE active = TRUE AND email IS NOT NULL"
            >
        >;
    });

    it("should handle complex conditionals with whereIf()", () => {
        // Use whereIf() for conditional WHERE clauses - avoids type complexity

        // New pattern:
        const period = false;
        const start = "2024-01-01";
        const end = "2024-12-31";

        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .whereIf(!period && !!start, `u."createdAt" >= '${start}'`)
            .whereIf(!period && !!end, `u."createdAt" <= '${end}'`);

        expect(builder.toString()).toBe(
            `SELECT u.id FROM users u WHERE u."createdAt" >= '2024-01-01' AND u."createdAt" <= '2024-12-31'`,
        );
    });

    it("should work with ConditionTreeBuilder", () => {
        const filters = createConditionTree("and")
            .add("active = TRUE", "active")
            .add("id > 0", "positive_id");

        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .whereIf(true, filters);

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE (active = TRUE AND id > 0)",
        );
    });
});

// ============================================================================
// selectIf() Tests
// ============================================================================

describe("selectIf()", () => {
    it("should add columns when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .selectIf(true, "name");

        expect(builder.toString()).toBe("SELECT id, name FROM users");

        type Row = BuilderReturnType<typeof builder>;
        type _RowMatches = RequireTrue<
            AssertEqual<Row, { id: UserId; name: UserName; }>
        >;
    });

    it("should NOT add columns when condition is literal false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .selectIf(false, "name");

        expect(builder.toString()).toBe("SELECT id FROM users");

        // With literal false, the column is definitely not added
        type Row = BuilderReturnType<typeof builder>;
        type _RowMatches = RequireTrue<AssertEqual<Row, { id: UserId; }>>;
    });

    it("should mark columns as optional when condition is runtime boolean", () => {
        const includeEmail: boolean = Math.random() > 0.5;
        const includeName: boolean = Math.random() > 0.5;
        const includeActive: boolean = Math.random() > 0.5;

        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .selectIf(includeEmail, "email")
            .selectIf(includeName, "name")
            .selectIf(includeActive, "active");

        // Type-level: conditional columns are marked as type | undefined
        // This is a single merged type, NOT a union explosion
        type Row = BuilderReturnType<typeof builder>;

        // The row should have id always, and optional fields as type | undefined
        type _RowMatches = RequireTrue<
            AssertEqual<
                Row,
                {
                    id: UserId;
                    email: string | undefined;
                    name: UserName | undefined;
                    active: boolean | undefined;
                }
            >
        >;
    });

    it("should support array of columns", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .selectIf(true as boolean, [ "name", "email" ]);

        expect(builder.toString()).toBe("SELECT id, name, email FROM users");

        type Row = BuilderReturnType<typeof builder>;
        type _RowMatches = RequireTrue<
            AssertEqual<
                Row,
                {
                    id: UserId;
                    name: UserName | undefined;
                    email: string | undefined;
                }
            >
        >;
    });
});

// ============================================================================
// joinIf() Tests
// ============================================================================

describe("joinIf()", () => {
    it("should add JOIN when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .joinIf(true, "LEFT JOIN orders o ON o.userId = u.id")
            .select("o.total");

        expect(builder.toString()).toBe(
            "SELECT u.id, o.total FROM users u LEFT JOIN orders o ON o.userId = u.id",
        );
    });

    it("should NOT add JOIN when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .joinIf(false, "LEFT JOIN orders o ON o.userId = u.id");

        expect(builder.toString()).toBe("SELECT u.id FROM users u");
    });

    it("should support join id parameter", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .joinIf(
                true,
                "LEFT JOIN orders o ON o.userId = u.id",
                "orders_join",
            );

        expect(builder.toString()).toBe(
            "SELECT u.id FROM users u LEFT JOIN orders o ON o.userId = u.id",
        );
    });
});

// ============================================================================
// groupByIf() Tests
// ============================================================================

describe("groupByIf()", () => {
    it("should add GROUP BY when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("active")
            .select("COUNT(*) as count")
            .groupByIf(true, "active");

        expect(builder.toString()).toBe(
            "SELECT active, COUNT(*) as count FROM users GROUP BY active",
        );
    });

    it("should NOT add GROUP BY when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .groupByIf(false, "active");

        expect(builder.toString()).toBe("SELECT id FROM users");
    });

    it("should support array of columns", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select([ "status", "COUNT(*) as count" ])
            .groupByIf(true, [ "status", "userId" ]);

        expect(builder.toString()).toBe(
            "SELECT status, COUNT(*) as count FROM orders GROUP BY status, userId",
        );
    });
});

// ============================================================================
// havingIf() Tests
// ============================================================================

describe("havingIf()", () => {
    it("should add HAVING when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select([ "active", "COUNT(*) as count" ])
            .groupBy("active")
            .havingIf(true, "COUNT(*) > 5");

        expect(builder.toString()).toBe(
            "SELECT active, COUNT(*) as count FROM users GROUP BY active HAVING COUNT(*) > 5",
        );
    });

    it("should NOT add HAVING when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select([ "active", "COUNT(*) as count" ])
            .groupBy("active")
            .havingIf(false, "COUNT(*) > 5");

        expect(builder.toString()).toBe(
            "SELECT active, COUNT(*) as count FROM users GROUP BY active",
        );
    });

    it("should work with ConditionTreeBuilder", () => {
        const havingFilters = createConditionTree("and")
            .add("COUNT(*) > 5", "min_count")
            .add("SUM(total) > 100", "min_total");

        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select([ "status", "COUNT(*) as count" ])
            .groupBy("status")
            .havingIf(true, havingFilters);

        expect(builder.toString()).toBe(
            "SELECT status, COUNT(*) as count FROM orders GROUP BY status HAVING (COUNT(*) > 5 AND SUM(total) > 100)",
        );
    });
});

// ============================================================================
// orderByIf() Tests
// ============================================================================

describe("orderByIf()", () => {
    it("should add ORDER BY when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .orderByIf(true, "id DESC");

        expect(builder.toString()).toBe(
            "SELECT id FROM users ORDER BY id DESC",
        );
    });

    it("should NOT add ORDER BY when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .orderByIf(false, "id DESC");

        expect(builder.toString()).toBe("SELECT id FROM users");
    });

    it("should support array of columns", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .orderByIf(true, [ "name ASC", "id DESC" ]);

        expect(builder.toString()).toBe(
            "SELECT id FROM users ORDER BY name ASC, id DESC",
        );
    });
});

// ============================================================================
// limitIf() and offsetIf() Tests
// ============================================================================

describe("limitIf()", () => {
    it("should add LIMIT when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .limitIf(true, 10);

        expect(builder.toString()).toBe("SELECT id FROM users LIMIT 10");

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users LIMIT 10">
        >;
    });

    it("should NOT add LIMIT when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .limitIf(false, 10);

        expect(builder.toString()).toBe("SELECT id FROM users");

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users">
        >;
    });
});

describe("offsetIf()", () => {
    it("should add OFFSET when condition is true", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .offsetIf(true, 20);

        expect(builder.toString()).toBe("SELECT id FROM users OFFSET 20");

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users OFFSET 20">
        >;
    });

    it("should NOT add OFFSET when condition is false", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .offsetIf(false, 20);

        expect(builder.toString()).toBe("SELECT id FROM users");

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users">
        >;
    });

    it("should work with limitIf()", () => {
        const paginate = true;
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .limitIf(paginate, 10)
            .offsetIf(paginate, 20);

        expect(builder.toString()).toBe(
            "SELECT id FROM users LIMIT 10 OFFSET 20",
        );

        type Sql = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<Sql, "SELECT id FROM users LIMIT 10 OFFSET 20">
        >;
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("*If() methods integration", () => {
    it("should chain all *If() methods together", () => {
        const includeOrders = true;
        const filterActive = true;
        const groupByStatus = false;
        const paginate = true;

        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .selectIf(includeOrders, "o.total")
            .joinIf(includeOrders, "LEFT JOIN orders o ON o.userId = u.id")
            .whereIf(filterActive, "u.active = TRUE")
            .groupByIf(groupByStatus, "o.status")
            .havingIf(groupByStatus, "COUNT(*) > 1")
            .orderByIf(paginate, "u.id DESC")
            .limitIf(paginate, 10)
            .offsetIf(paginate, 0);

        expect(builder.toString()).toBe(
            "SELECT u.id, o.total FROM users u LEFT JOIN orders o ON o.userId = u.id WHERE u.active = TRUE ORDER BY u.id DESC LIMIT 10 OFFSET 0",
        );
    });

    it("should mix *If() methods with regular methods", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .select("u.name")
            .whereIf(true, "u.active = TRUE")
            .where("u.id > 0")
            .orderBy("u.name")
            .orderByIf(true, "u.id DESC")
            .limit(5);

        expect(builder.toString()).toBe(
            "SELECT u.id, u.name FROM users u WHERE u.active = TRUE AND u.id > 0 ORDER BY u.name, u.id DESC LIMIT 5",
        );
    });

    it("should work with whereIf() for complex conditionals", () => {
        // Use *If() methods for all conditionals - no when() needed
        const period = { start: "2024-01-01", end: "2024-12-31" };
        const sortByTotal = true;
        const hasPeriod = !!period;

        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .whereIf(hasPeriod, `u."createdAt" >= '${period.start}'`)
            .whereIf(hasPeriod, `u."createdAt" <= '${period.end}'`)
            .orderByIf(sortByTotal, "u.id DESC");

        expect(builder.toString()).toBe(
            `SELECT u.id FROM users u WHERE u."createdAt" >= '2024-01-01' AND u."createdAt" <= '2024-12-31' ORDER BY u.id DESC`,
        );
    });

    it("should support the real-world example from the issue", () => {
        // Simulating the original problematic query pattern
        const userId = "123";
        const period = null; // No period filter
        const start = "2024-01-01";
        const end = "2024-12-31";
        const limit = 10;
        const offset = 0;

        const builder = createSelectQuery<TestSchema>()
            .from(`users u`)
            .select([
                "u.id",
                "u.name",
                "u.email",
                `u."createdAt"`,
            ])
            .withParams({ odUserId: userId })
            .where(`u.id = :odUserId`)
            .where(`u.active = TRUE`)
            .orderBy(`u."createdAt" desc`)
            .limit(limit)
            .offset(offset)
            // Instead of nested when() calls, use whereIf():
            .whereIf(!period && !!start, `u."createdAt" >= '${start}'`)
            .whereIf(!period && !!end, `u."createdAt" <= '${end}'`);

        expect(builder.toString()).toBe(
            `SELECT u.id, u.name, u.email, u."createdAt" FROM users u WHERE u.id = $1 AND u.active = TRUE AND u."createdAt" >= '2024-01-01' AND u."createdAt" <= '2024-12-31' ORDER BY u."createdAt" desc LIMIT 10 OFFSET 0`,
        );
        expect(builder.getParams()).toEqual([ "123" ]);
    });
});

// ============================================================================
// UntypedSelectBuilder *If() Tests
// ============================================================================

describe("UntypedSelectBuilder *If() methods", () => {
    it("should support all *If() methods", () => {
        interface Result {
            id: number;
            name: string;
        }

        const builder = createUntypedQuery<Result>()
            .from("users u")
            .select("u.id")
            .selectIf(true, "u.name")
            .joinIf(false, "LEFT JOIN orders o ON o.user_id = u.id")
            .whereIf(true, "u.active = TRUE")
            .groupByIf(false, "u.status")
            .havingIf(false, "COUNT(*) > 1")
            .orderByIf(true, "u.id DESC")
            .limitIf(true, 10)
            .offsetIf(true, 5);

        expect(builder.toString()).toBe(
            "SELECT u.id, u.name FROM users u WHERE u.active = TRUE ORDER BY u.id DESC LIMIT 10 OFFSET 5",
        );
    });
});

// ============================================================================
// Reusable Parts with *If() Tests
// ============================================================================

describe("reusable parts with *If() methods", () => {
    // Reusable function using *If() methods
    function addPeriodFilter<
        Schema extends DatabaseSchema,
        State extends AnyBuilderStateTag,
        Sql extends AnyBuilderSqlTag,
    >(
        b: SelectQueryBuilder<Schema, State, Sql>,
        field: string,
        start: string | null,
        end: string | null,
    ) {
        return b
            .whereIf(!!start, `${field} >= '${start}'`)
            .whereIf(!!end, `${field} <= '${end}'`);
    }

    it("should work with reusable functions", () => {
        const builder = addPeriodFilter(
            createSelectQuery<TestSchema>()
                .from("users u")
                .select("u.id"),
            `u."createdAt"`,
            "2024-01-01",
            "2024-12-31",
        );

        expect(builder.toString()).toBe(
            `SELECT u.id FROM users u WHERE u."createdAt" >= '2024-01-01' AND u."createdAt" <= '2024-12-31'`,
        );
    });

    it("should work with partial filters", () => {
        const builder = addPeriodFilter(
            createSelectQuery<TestSchema>()
                .from("users u")
                .select("u.id"),
            `u."createdAt"`,
            "2024-01-01",
            null,
        );

        expect(builder.toString()).toBe(
            `SELECT u.id FROM users u WHERE u."createdAt" >= '2024-01-01'`,
        );
    });
});

// ============================================================================
// Named Parameters (withParams) Tests
// ============================================================================

describe("withParams() with named parameters", () => {
    it("should replace :name with $N placeholders", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .withParams({ userId: 123, status: "active" })
            .where("id = :userId")
            .where("active = :status");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE id = $1 AND active = $2",
        );
    });

    it("should return params as array in key order", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .withParams({ first: 1, second: "two", third: true });

        expect(builder.getParams()).toEqual([ 1, "two", true ]);
    });

    it("should handle multiple occurrences of same param", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .withParams({ val: 100 })
            .where("id > :val")
            .where("id < :val + 50");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE id > $1 AND id < $1 + 50",
        );
    });

    it("should not replace similar param names", () => {
        // :user should not replace part of :userId
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .withParams({ user: 1, userId: 2 })
            .where("owner = :user")
            .where("id = :userId");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE owner = $1 AND id = $2",
        );
    });

    it("should work with joins and complex queries", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .withParams({ userId: 123, minTotal: 100 })
            .select("u.id")
            .join(
                "LEFT JOIN orders o ON o.userId = u.id AND o.total > :minTotal",
            )
            .select("o.total")
            .where("u.id = :userId");

        expect(builder.toString()).toBe(
            "SELECT u.id, o.total FROM users u LEFT JOIN orders o ON o.userId = u.id AND o.total > $2 WHERE u.id = $1",
        );
        expect(builder.getParams()).toEqual([ 123, 100 ]);
    });

    it("should work with whereIf and other *If methods", () => {
        const includeStatus = true;
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id")
            .withParams({ userId: 1, status: "active" })
            .where("id = :userId")
            .whereIf(includeStatus, "active = :status");

        expect(builder.toString()).toBe(
            "SELECT id FROM users WHERE id = $1 AND active = $2",
        );
    });
});

// ============================================================================
// Export for verification
// ============================================================================

export type BuilderIfTestsPass = true;
