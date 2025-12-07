import { beforeEach, describe, expect, it } from "bun:test";

import type { QueryHandler } from "../src/db.js";
import {
    createSelectFn,
    createSelectQuery,
    SelectBuilderResult,
    SelectBuilderResultArray,
    SelectResultArray,
    type ValidQueryBuilder,
} from "../src/index.js";

import type {
    AssertEqual,
    AssertExtends,
    AssertStartsWith,
    RequireTrue,
} from "./helpers.js";

type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                active: boolean;
            };
        };
    };
};

const qb = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "id", "name" ]);

const qbWithParams = createSelectQuery<TestSchema>()
    .from("users")
    .withParams(
        [ 1, "bob" ],
        (b, paramString) => b.select([ "id" ]).where(`id IN (${paramString})`),
    );

const invalidBuilder = createSelectQuery<TestSchema>()
    .from("unknown_table")
    .select([ "id" ]);

const calls: Array<{ sql: string; params?: unknown[]; }> = [];

const handler: QueryHandler = async (sql, params) => {
    calls.push({ sql, params });
    return [];
};

const select = createSelectFn<TestSchema>(handler);
const stringResultPromise = select("SELECT id, name FROM users" as const);
const builderResultPromise = select(qb);

// Type expectations for overload resolution and result inference
type QBRow = SelectBuilderResult<typeof qb>;
type _QBRowShape = RequireTrue<
    AssertEqual<QBRow, { id: number; name: string; }>
>;

type StringReturn = Awaited<typeof stringResultPromise>;
type _StringReturnShape = RequireTrue<
    AssertEqual<
        StringReturn,
        SelectResultArray<"SELECT id, name FROM users", TestSchema>
    >
>;

type BuilderReturn = Awaited<typeof builderResultPromise>;
type _BuilderReturnShape = RequireTrue<
    AssertEqual<BuilderReturn, SelectBuilderResultArray<typeof qb>>
>;

type ValidatedBuilder = ValidQueryBuilder<TestSchema, typeof qb>;
type _ValidatedBuilderIsSame = RequireTrue<
    AssertEqual<ValidatedBuilder, typeof qb>
>;

type InvalidBuilderResult = ValidQueryBuilder<
    TestSchema,
    typeof invalidBuilder
>;
type _InvalidBuilderIsError = RequireTrue<
    AssertExtends<InvalidBuilderResult, `[SQL Error] ${string}`>
>;
type _InvalidBuilderStartsWithError = RequireTrue<
    AssertStartsWith<InvalidBuilderResult & string, "[SQL Error]">
>;

// ---------------------------------------------------------------------------
// Runtime coverage: handler wiring and param fallback
// ---------------------------------------------------------------------------

describe("createSelectFn runtime behavior", () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it("passes explicit params for string queries", async () => {
        await select("SELECT id, name FROM users WHERE active = $1", [ true ]);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({
            sql: "SELECT id, name FROM users WHERE active = $1",
            params: [ true ],
        });
    });

    it("falls back to builder params when none are provided", async () => {
        await select(qbWithParams);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.sql).toBe(qbWithParams.toString());
        expect(calls[0]?.params).toEqual([ 1, "bob" ]);
    });

    it("prefers explicit params over builder params", async () => {
        await select(qbWithParams, [ 99 ]);

        expect(calls).toHaveLength(1);
        expect(calls[0]?.params).toEqual([ 99 ]);
    });
});

export type DbCreateSelectFnTestsPass = true;
