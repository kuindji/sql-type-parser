/**
 * UntypedSelectBuilder Tests
 *
 * Tests for UntypedSelectBuilder - query building without schema type computation.
 */

import { describe, expect, it } from "bun:test";

import type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
} from "../../../src/select/builder-types/helpers.js";

import type {
    SelectQueryBuilder,
    UntypedSelectBuilder,
} from "../../../src/select/builder-types/builder.js";

import type {
    AssertEqual,
    AssertExtends,
    RequireTrue,
} from "../../helpers.js";

import { createUntypedQuery } from "../../../src/index.js";
import type { DatabaseSchema } from "../../../src/common/schema.js";

describe("UntypedSelectBuilder", () => {
    // Define a result type upfront – no schema needed
    interface OrderSummary {
        orderId: number;
        customerName: string;
        total: number;
    }

    it("generates correct SQL without type computation", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders o")
            .join("LEFT JOIN customers c ON c.id = o.customer_id")
            .select([ "o.id AS orderId", "c.name AS customerName", "o.total" ])
            .where("o.status = 'completed'")
            .orderBy("o.total DESC")
            .limit(10)
            .offset(5);

        expect(query.toString()).toBe(
            "SELECT o.id AS orderId, c.name AS customerName, o.total "
                + "FROM orders o "
                + "LEFT JOIN customers c ON c.id = o.customer_id "
                + "WHERE o.status = 'completed' "
                + "ORDER BY o.total DESC "
                + "LIMIT 10 "
                + "OFFSET 5",
        );
    });

    it("preserves Result type through method chaining", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders")
            .select("*");

        // Type should be UntypedSelectBuilder<OrderSummary>, not computed
        type QueryType = typeof query;
        type _CheckType = RequireTrue<
            AssertExtends<QueryType, UntypedSelectBuilder<OrderSummary>>
        >;
    });

    it("supports whereIf() conditional execution", () => {
        const includeInactive = false;
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .whereIf(includeInactive, "active = FALSE")
            .whereIf(!includeInactive, "active = TRUE");

        // Runtime: only the TRUE condition is applied
        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );
    });

    it("supports withParams()", () => {
        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .withParams({ id: 42, status: "active" })
            .where(`id = :id AND status = :status`);

        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE id = $1 AND status = $2",
        );
        expect(query.getParams()).toEqual([ 42, "active" ]);
    });

    it("is assignable to functions expecting SelectQueryBuilder<any, any, any>", () => {
        // This helper function is typed for SelectQueryBuilder
        function addPagination<
            Schema extends DatabaseSchema,
            State extends AnyBuilderStateTag,
            Sql extends AnyBuilderSqlTag,
        >(
            b: SelectQueryBuilder<Schema, State, Sql>,
            page: number,
            size: number,
        ) {
            return b.limit(size).offset((page - 1) * size);
        }

        const untypedQuery = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id");

        // Untyped builder should work with typed helper functions
        const paginatedQuery = addPagination(
            untypedQuery as unknown as SelectQueryBuilder<any, any, any>,
            2,
            10,
        );

        expect(paginatedQuery.toString()).toBe(
            "SELECT id FROM users LIMIT 10 OFFSET 10",
        );
    });

    it("supports apply() for composition", () => {
        function addActiveFilter(b: UntypedSelectBuilder<any>) {
            return b.where("active = TRUE");
        }

        const query = createUntypedQuery<{ id: number; }>()
            .from("users")
            .select("id")
            .apply(addActiveFilter);

        expect(query.toString()).toBe(
            "SELECT id FROM users WHERE active = TRUE",
        );
    });

    it("supports groupBy and having", () => {
        interface CategoryStats {
            category: string;
            count: number;
        }

        const query = createUntypedQuery<CategoryStats>()
            .from("products")
            .select([ "category", "COUNT(*) AS count" ])
            .groupBy("category")
            .having("COUNT(*) > 5");

        expect(query.toString()).toBe(
            "SELECT category, COUNT(*) AS count FROM products GROUP BY category HAVING COUNT(*) > 5",
        );
    });

    it("extracts Result type via branded string", () => {
        const query = createUntypedQuery<OrderSummary>()
            .from("orders")
            .select("*");

        const branded = query.toBrandedString();

        // The branded string carries the Result type
        type BrandedResult = typeof branded.__type;
        type _CheckBrand = RequireTrue<
            AssertEqual<BrandedResult, OrderSummary>
        >;
    });
});
