import { describe, expect, it } from "bun:test";
/**
 * Builder Complex Expression Tests
 *
 * Tests for building queries with complex SQL expressions.
 * Validates runtime SQL generation and type inference for complex patterns.
 *
 * If this file compiles without errors, type tests pass.
 * Runtime tests validate SQL string generation.
 */

import type {
    BuilderReturnType,
    BuilderSQL,
} from "../../src/select/builder.js";

import type { AssertEqual, AssertExtends, RequireTrue } from "../helpers.js";

import { createSelectQuery } from "../../src/index.js";

// ============================================================================
// Test Schema
// ============================================================================

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                given_name: string;
                family_name: string;
                email: string;
                active: boolean;
                created_at: string;
                deleted_at: string | null;
            };
            orders: {
                id: number;
                user_id: number;
                amount: number;
                commission: number;
                rate: number;
                currency: string;
                sale: number;
                order_date: string;
            };
            analytics: {
                id: number;
                user_id: number;
                seconds: number;
            };
        };
    };
};

// ============================================================================
// COALESCE Expression Builder Tests
// ============================================================================

describe("COALESCE expressions in builder", () => {
    it("builds simple COALESCE expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("COALESCE(given_name, 'Anonymous') AS name");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT COALESCE(given_name, 'Anonymous') AS name FROM users",
        );

        type SqlLiteral = BuilderSQL<typeof builder>;
        type _SqlMatches = RequireTrue<
            AssertEqual<
                SqlLiteral,
                "SELECT COALESCE(given_name, 'Anonymous') AS name FROM users"
            >
        >;
    });

    it("builds COALESCE with multiple fallbacks", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select(
                "COALESCE(deleted_at, created_at, 'unknown')::text AS date",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT COALESCE(deleted_at, created_at, 'unknown')::text AS date FROM users",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { date: string; }>
        >;
    });

    it("builds COALESCE with type cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("COALESCE(commission * rate, 0)::float8 AS computed_rate");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT COALESCE(commission * rate, 0)::float8 AS computed_rate FROM orders",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { computed_rate: number; }>
        >;
    });
});

// ============================================================================
// CASE WHEN Expression Builder Tests
// ============================================================================

describe("CASE WHEN expressions in builder", () => {
    it("builds simple CASE WHEN expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("CASE WHEN active THEN 1 ELSE 0 END AS flag");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT CASE WHEN active THEN 1 ELSE 0 END AS flag FROM users",
        );
    });

    it("builds CASE WHEN with comparison", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select(
                "CASE WHEN amount > 100 THEN 'large' ELSE 'small' END AS size",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT CASE WHEN amount > 100 THEN 'large' ELSE 'small' END AS size FROM orders",
        );
    });

    it("builds complex CASE with arithmetic and COALESCE", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select(
                "(CASE WHEN commission > 0 THEN commission - COALESCE(commission * rate, 0) ELSE 0 END)::float8 AS revenue",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (CASE WHEN commission > 0 THEN commission - COALESCE(commission * rate, 0) ELSE 0 END)::float8 AS revenue FROM orders",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { revenue: number; }>
        >;
    });

    it("builds CASE WHEN with multiple conditions", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select(
                "CASE WHEN commission > 0 AND sale > 0 THEN commission / sale ELSE NULL END AS rate",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT CASE WHEN commission > 0 AND sale > 0 THEN commission / sale ELSE NULL END AS rate FROM orders",
        );
    });
});

// ============================================================================
// EXTRACT Expression Builder Tests
// ============================================================================

describe("EXTRACT expressions in builder", () => {
    it("builds EXTRACT epoch expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("EXTRACT(epoch FROM created_at) AS epoch");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT EXTRACT(epoch FROM created_at) AS epoch FROM users",
        );
    });

    it("builds EXTRACT with division for days", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("analytics")
            .select("(EXTRACT(epoch FROM now()) / 86400)::float8 AS days");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (EXTRACT(epoch FROM now()) / 86400)::float8 AS days FROM analytics",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { days: number; }>
        >;
    });
});

// ============================================================================
// TO_CHAR Expression Builder Tests
// ============================================================================

describe("TO_CHAR expressions in builder", () => {
    it("builds TO_CHAR with date format", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("TO_CHAR(order_date, 'YYYY-MM-DD') AS formatted_date");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT TO_CHAR(order_date, 'YYYY-MM-DD') AS formatted_date FROM orders",
        );
    });

    it("builds TO_CHAR for month grouping", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("TO_CHAR(order_date, 'YYYY-MM') AS month")
            .select("SUM(amount)::float8 AS total")
            .groupBy("TO_CHAR(order_date, 'YYYY-MM')");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT TO_CHAR(order_date, 'YYYY-MM') AS month, SUM(amount)::float8 AS total FROM orders GROUP BY TO_CHAR(order_date, 'YYYY-MM')",
        );
    });
});

// ============================================================================
// Array Aggregate Builder Tests
// ============================================================================

describe("Array aggregate expressions in builder", () => {
    it("builds ARRAY_AGG expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("ARRAY_AGG(id) AS ids");

        const sql = builder.toString();
        expect(sql).toBe("SELECT ARRAY_AGG(id) AS ids FROM users");
    });

    it("builds STRING_AGG expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("STRING_AGG(given_name, ', ')::text AS names");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT STRING_AGG(given_name, ', ')::text AS names FROM users",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { names: string; }>
        >;
    });

    it("builds ARRAY_AGG with concatenation", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select(
                "(ARRAY_AGG(given_name || ' ' || family_name))[1] AS first_name",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (ARRAY_AGG(given_name || ' ' || family_name))[1] AS first_name FROM users",
        );
    });
});

// ============================================================================
// Type Casting Builder Tests
// ============================================================================

describe("Type casting in builder", () => {
    it("builds float8 cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("amount::float8 AS amount");

        const sql = builder.toString();
        expect(sql).toBe("SELECT amount::float8 AS amount FROM orders");

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { amount: number; }>
        >;
    });

    it("builds numeric cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("(amount)::numeric AS amount");

        const sql = builder.toString();
        expect(sql).toBe("SELECT (amount)::numeric AS amount FROM orders");
    });

    it("builds text cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("id::text AS id_str");

        const sql = builder.toString();
        expect(sql).toBe("SELECT id::text AS id_str FROM users");

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { id_str: string; }>
        >;
    });

    it("builds boolean cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("(id IS NOT NULL)::boolean AS has_id");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (id IS NOT NULL)::boolean AS has_id FROM users",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { has_id: boolean; }>
        >;
    });
});

// ============================================================================
// Arithmetic Expression Builder Tests
// ============================================================================

describe("Arithmetic expressions in builder", () => {
    it("builds multiplication expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("(amount * rate)::float8 AS computed");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (amount * rate)::float8 AS computed FROM orders",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { computed: number; }>
        >;
    });

    it("builds division by literal", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("analytics")
            .select("(seconds / 86400)::float8 AS days");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (seconds / 86400)::float8 AS days FROM analytics",
        );
    });

    it("builds complex arithmetic with subtraction", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("(amount - COALESCE(commission, 0))::float8 AS net");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (amount - COALESCE(commission, 0))::float8 AS net FROM orders",
        );
    });
});

// ============================================================================
// Boolean Expression Builder Tests
// ============================================================================

describe("Boolean expressions in builder", () => {
    it("builds IS NOT NULL expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users")
            .select("(deleted_at IS NULL)::boolean AS active");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (deleted_at IS NULL)::boolean AS active FROM users",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { active: boolean; }>
        >;
    });
});

// ============================================================================
// NULLIF Expression Builder Tests
// ============================================================================

describe("NULLIF expressions in builder", () => {
    it("builds NULLIF in division (prevent division by zero)", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("(amount / NULLIF(sale, 0))::float8 AS rate");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT (amount / NULLIF(sale, 0))::float8 AS rate FROM orders",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { rate: number; }>
        >;
    });
});

// ============================================================================
// GREATEST/LEAST Expression Builder Tests
// ============================================================================

describe("GREATEST/LEAST expressions in builder", () => {
    it("builds GREATEST expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("GREATEST(amount, commission) AS max_val");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT GREATEST(amount, commission) AS max_val FROM orders",
        );
    });

    it("builds LEAST expression with cast", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("LEAST(amount, 100)::float8 AS capped");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT LEAST(amount, 100)::float8 AS capped FROM orders",
        );
    });
});

// ============================================================================
// ROUND/FLOOR/CEIL Expression Builder Tests
// ============================================================================

describe("ROUND/FLOOR/CEIL expressions in builder", () => {
    it("builds ROUND expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("ROUND(amount, 2)::numeric AS rounded");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT ROUND(amount, 2)::numeric AS rounded FROM orders",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { rounded: number; }>
        >;
    });

    it("builds FLOOR expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("FLOOR(amount)::int AS floor_amount");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT FLOOR(amount)::int AS floor_amount FROM orders",
        );
    });

    it("builds CEIL expression", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("CEIL(amount)::int AS ceil_amount");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT CEIL(amount)::int AS ceil_amount FROM orders",
        );
    });
});

// ============================================================================
// Complex Combined Patterns Builder Tests
// ============================================================================

describe("Complex combined patterns in builder", () => {
    it("builds revenue calculation pattern", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("orders o")
            .select("o.id")
            .select(
                "(CASE WHEN o.commission > 0 THEN o.commission - COALESCE(o.commission * o.rate, 0) ELSE 0 END)::float8 AS revenue",
            );

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT o.id, (CASE WHEN o.commission > 0 THEN o.commission - COALESCE(o.commission * o.rate, 0) ELSE 0 END)::float8 AS revenue FROM orders o",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<ReturnType, { id: number; revenue: number; }>
        >;
    });

    it("builds mixed regular and complex expressions", () => {
        const builder = createSelectQuery<TestSchema>()
            .from("users u")
            .select("u.id")
            .select("u.given_name")
            .select("COALESCE(u.deleted_at, 'active')::text AS status")
            .select("(u.active)::boolean AS is_active");

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT u.id, u.given_name, COALESCE(u.deleted_at, 'active')::text AS status, (u.active)::boolean AS is_active FROM users u",
        );

        type ReturnType = BuilderReturnType<typeof builder>;
        type _ReturnMatches = RequireTrue<
            AssertEqual<
                ReturnType,
                {
                    id: number;
                    given_name: string;
                    status: string;
                    is_active: boolean;
                }
            >
        >;
    });

    it("builds query with conditional complex expression", () => {
        const includeRevenue = true;

        const builder = createSelectQuery<TestSchema>()
            .from("orders")
            .select("id")
            .select("amount")
            .when(includeRevenue, (b) =>
                b.select(
                    "(CASE WHEN commission > 0 THEN commission - COALESCE(commission * rate, 0) ELSE 0 END)::float8 AS revenue",
                ));

        const sql = builder.toString();
        expect(sql).toBe(
            "SELECT id, amount, (CASE WHEN commission > 0 THEN commission - COALESCE(commission * rate, 0) ELSE 0 END)::float8 AS revenue FROM orders",
        );
    });
});

// ============================================================================
// Export for verification
// ============================================================================

export type BuilderComplexTestsPass = true;
