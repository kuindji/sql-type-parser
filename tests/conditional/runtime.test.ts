/**
 * Runtime tests for conditional SQL processing.
 */

import { describe, expect, test } from "bun:test";
import {
    conditionalSQL,
    normalizeWhitespace,
    processConditionalSQL,
    processParams,
} from "../../src/conditional/runtime.js";

// ============================================================================
// processConditionalSQL tests
// ============================================================================

describe("processConditionalSQL", () => {
    describe("basic conditions", () => {
        test("should include content when condition is true", () => {
            const template = "SELECT * /*if:flag*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, { flag: true });
            expect(result).toBe("SELECT * WHERE a = 1");
        });

        test("should exclude content when condition is false", () => {
            const template = "SELECT * /*if:flag*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, { flag: false });
            expect(result).toBe("SELECT * ");
        });

        test("should exclude content when condition is missing", () => {
            const template = "SELECT * /*if:flag*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, {});
            expect(result).toBe("SELECT * ");
        });
    });

    describe("negation", () => {
        test("should include content when negated condition is false", () => {
            const template = "SELECT * /*if:!skip*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, { skip: false });
            expect(result).toBe("SELECT * WHERE a = 1");
        });

        test("should exclude content when negated condition is true", () => {
            const template = "SELECT * /*if:!skip*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, { skip: true });
            expect(result).toBe("SELECT * ");
        });

        test("should include content when negated condition is missing", () => {
            const template = "SELECT * /*if:!skip*/WHERE a = 1/*endif*/";
            const result = processConditionalSQL(template, {});
            expect(result).toBe("SELECT * WHERE a = 1");
        });
    });

    describe("dot notation (nested properties)", () => {
        test("should resolve nested property", () => {
            const template =
                "SELECT * /*if:user.isAdmin*/WHERE admin = true/*endif*/";
            const result = processConditionalSQL(template, {
                user: { isAdmin: true },
            });
            expect(result).toBe("SELECT * WHERE admin = true");
        });

        test("should handle missing nested property", () => {
            const template =
                "SELECT * /*if:user.isAdmin*/WHERE admin = true/*endif*/";
            const result = processConditionalSQL(template, { user: {} });
            expect(result).toBe("SELECT * ");
        });

        test("should handle deeply nested property", () => {
            const template =
                "SELECT * /*if:config.features.beta*/WHERE beta = true/*endif*/";
            const result = processConditionalSQL(template, {
                config: { features: { beta: true } },
            });
            expect(result).toBe("SELECT * WHERE beta = true");
        });

        test("should handle negated nested property", () => {
            const template =
                "SELECT * /*if:!user.isGuest*/WHERE user_id IS NOT NULL/*endif*/";
            const result = processConditionalSQL(template, {
                user: { isGuest: false },
            });
            expect(result).toBe("SELECT * WHERE user_id IS NOT NULL");
        });
    });

    describe("nested conditions", () => {
        test("should handle nested conditions - both true", () => {
            const template =
                "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/FROM t";
            const result = processConditionalSQL(template, { a: true, b: true });
            expect(result).toBe("SELECT A BFROM t");
        });

        test("should handle nested conditions - outer true, inner false", () => {
            const template =
                "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/FROM t";
            const result = processConditionalSQL(template, {
                a: true,
                b: false,
            });
            expect(result).toBe("SELECT A FROM t");
        });

        test("should handle nested conditions - outer false", () => {
            const template =
                "SELECT /*if:a*/A /*if:b*/B/*endif*//*endif*/FROM t";
            const result = processConditionalSQL(template, {
                a: false,
                b: true,
            });
            expect(result).toBe("SELECT FROM t");
        });
    });

    describe("multiple conditions", () => {
        test("should process multiple independent conditions", () => {
            const template = `
                SELECT *
                FROM users
                WHERE 1=1
                /*if:filterActive*/AND active = true/*endif*/
                /*if:filterVerified*/AND verified = true/*endif*/
            `;
            const result = processConditionalSQL(template, {
                filterActive: true,
                filterVerified: false,
            });
            expect(result).toContain("AND active = true");
            expect(result).not.toContain("AND verified = true");
        });

        test("should handle adjacent conditions", () => {
            const template = "SELECT a/*if:b*/, b/*endif*//*if:c*/, c/*endif*/ FROM t";
            const result = processConditionalSQL(template, { b: true, c: false });
            expect(result).toBe("SELECT a, b FROM t");
        });
    });

    describe("SQL-specific patterns", () => {
        test("should handle conditional SELECT columns", () => {
            const template =
                "SELECT id, name/*if:extra*/, email, phone/*endif*/ FROM users";
            const result = processConditionalSQL(template, { extra: true });
            expect(result).toBe("SELECT id, name, email, phone FROM users");
        });

        test("should handle conditional JOIN", () => {
            const template = `
                SELECT u.id, u.name
                FROM users u
                /*if:withOrders*/LEFT JOIN orders o ON o.user_id = u.id/*endif*/
            `;
            const result = processConditionalSQL(template, { withOrders: true });
            expect(result).toContain("LEFT JOIN orders o ON o.user_id = u.id");
        });

        test("should handle conditional WHERE clause", () => {
            const template = `
                SELECT * FROM orders
                WHERE 1=1
                /*if:userId*/AND user_id = :userId/*endif*/
                /*if:status*/AND status = :status/*endif*/
            `;
            const result = processConditionalSQL(template, {
                userId: 123,
                status: null,
            });
            expect(result).toContain("AND user_id = :userId");
            expect(result).not.toContain("AND status = :status");
        });

        test("should handle conditional ORDER BY", () => {
            const template = `
                SELECT * FROM users
                /*if:orderByName*/ORDER BY name ASC/*endif*/
            `;
            const result = processConditionalSQL(template, { orderByName: true });
            expect(result).toContain("ORDER BY name ASC");
        });

        test("should handle conditional LIMIT", () => {
            const template = `
                SELECT * FROM users
                /*if:paginate*/LIMIT :limit OFFSET :offset/*endif*/
            `;
            const result = processConditionalSQL(template, { paginate: true });
            expect(result).toContain("LIMIT :limit OFFSET :offset");
        });
    });

    describe("edge cases", () => {
        test("should handle empty template", () => {
            const result = processConditionalSQL("", { flag: true });
            expect(result).toBe("");
        });

        test("should handle template without conditions", () => {
            const template = "SELECT * FROM users WHERE id = 1";
            const result = processConditionalSQL(template, { flag: true });
            expect(result).toBe("SELECT * FROM users WHERE id = 1");
        });

        test("should preserve multiline content", () => {
            const template = `SELECT *
FROM users
/*if:withJoin*/
LEFT JOIN orders ON orders.user_id = users.id
/*endif*/
WHERE 1=1`;
            const result = processConditionalSQL(template, { withJoin: true });
            expect(result).toContain(
                "LEFT JOIN orders ON orders.user_id = users.id",
            );
        });
    });
});

// ============================================================================
// processParams tests
// ============================================================================

describe("processParams", () => {
    test("should replace single param", () => {
        const result = processParams("SELECT * FROM users WHERE id = :id", {
            id: 123,
        });
        expect(result.sql).toBe("SELECT * FROM users WHERE id = $1");
        expect(result.params).toEqual([123]);
    });

    test("should replace multiple params in order", () => {
        const result = processParams(
            "SELECT * FROM users WHERE id = :id AND name = :name",
            { id: 123, name: "John" },
        );
        expect(result.sql).toBe(
            "SELECT * FROM users WHERE id = $1 AND name = $2",
        );
        expect(result.params).toEqual([123, "John"]);
    });

    test("should handle repeated params", () => {
        const result = processParams(
            "SELECT * FROM users WHERE id = :id OR parent_id = :id",
            { id: 123 },
        );
        expect(result.sql).toBe(
            "SELECT * FROM users WHERE id = $1 OR parent_id = $1",
        );
        expect(result.params).toEqual([123]);
    });

    test("should handle params with underscores", () => {
        const result = processParams(
            "SELECT * FROM users WHERE user_id = :user_id",
            { user_id: 456 },
        );
        expect(result.sql).toBe("SELECT * FROM users WHERE user_id = $1");
        expect(result.params).toEqual([456]);
    });

    test("should handle null params", () => {
        const result = processParams(
            "INSERT INTO users (name, email) VALUES (:name, :email)",
            { name: "John", email: null },
        );
        expect(result.sql).toBe(
            "INSERT INTO users (name, email) VALUES ($1, $2)",
        );
        expect(result.params).toEqual(["John", null]);
    });

    test("should handle boolean params", () => {
        const result = processParams(
            "UPDATE users SET active = :active WHERE id = :id",
            { active: true, id: 1 },
        );
        expect(result.sql).toBe("UPDATE users SET active = $1 WHERE id = $2");
        expect(result.params).toEqual([true, 1]);
    });

    test("should not replace text that looks like param but is not", () => {
        const result = processParams(
            "SELECT * FROM users WHERE email LIKE '%:domain'",
            {},
        );
        expect(result.sql).toBe(
            "SELECT * FROM users WHERE email LIKE '%:domain'",
        );
        expect(result.params).toEqual([]);
    });

    test("should ignore params not in provided object", () => {
        const result = processParams("SELECT * FROM users WHERE id = :id", {});
        expect(result.sql).toBe("SELECT * FROM users WHERE id = :id");
        expect(result.params).toEqual([]);
    });
});

// ============================================================================
// conditionalSQL (combined) tests
// ============================================================================

describe("conditionalSQL", () => {
    test("should process both conditions and params", () => {
        const template = `
            SELECT id, name
            /*if:showEmail*/, email/*endif*/
            FROM users
            WHERE id = :userId
            /*if:activeOnly*/AND active = true/*endif*/
        `;
        const result = conditionalSQL(
            template,
            { showEmail: true, activeOnly: true },
            { userId: 123 },
        );

        expect(result.sql).toContain(", email");
        expect(result.sql).toContain("WHERE id = $1");
        expect(result.sql).toContain("AND active = true");
        expect(result.params).toEqual([123]);
    });

    test("should handle empty params", () => {
        const result = conditionalSQL(
            "SELECT * /*if:all*/FROM users/*endif*/",
            { all: true },
        );
        expect(result.sql).toBe("SELECT * FROM users");
        expect(result.params).toEqual([]);
    });

    test("should handle complex query", () => {
        const template = `
            SELECT 
                o.id,
                o.total
                /*if:includeUser*/, u.name AS user_name/*endif*/
            FROM orders o
            /*if:includeUser*/LEFT JOIN users u ON u.id = o.user_id/*endif*/
            WHERE o.status = :status
            /*if:minTotal*/AND o.total >= :minTotal/*endif*/
            ORDER BY o.created_at DESC
            /*if:limit*/LIMIT :limit/*endif*/
        `;

        const result = conditionalSQL(
            template,
            { includeUser: true, minTotal: true, limit: false },
            { status: "completed", minTotal: 100 },
        );

        expect(result.sql).toContain(", u.name AS user_name");
        expect(result.sql).toContain("LEFT JOIN users u ON u.id = o.user_id");
        expect(result.sql).toContain("WHERE o.status = $1");
        expect(result.sql).toContain("AND o.total >= $2");
        expect(result.sql).not.toContain("LIMIT");
        expect(result.params).toEqual(["completed", 100]);
    });
});

// ============================================================================
// normalizeWhitespace tests
// ============================================================================

describe("normalizeWhitespace", () => {
    test("should collapse multiple spaces", () => {
        expect(normalizeWhitespace("SELECT  *  FROM  users")).toBe(
            "SELECT * FROM users",
        );
    });

    test("should collapse newlines and tabs", () => {
        expect(normalizeWhitespace("SELECT *\n\tFROM\n\tusers")).toBe(
            "SELECT * FROM users",
        );
    });

    test("should normalize comma spacing", () => {
        expect(normalizeWhitespace("SELECT a,b,  c FROM t")).toBe(
            "SELECT a, b, c FROM t",
        );
    });

    test("should normalize parentheses", () => {
        expect(normalizeWhitespace("COUNT( * )")).toBe("COUNT(*)");
    });

    test("should trim leading/trailing whitespace", () => {
        expect(normalizeWhitespace("  SELECT * FROM t  ")).toBe(
            "SELECT * FROM t",
        );
    });
});

