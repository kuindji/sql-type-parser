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
            orders: {
                id: number;
                user_id: number;
                total: number;
                "created_at": string;
            };
        };
        analytics: {
            events: {
                id: number;
                event_type: string;
                payload: string;
            };
        };
    };
};

const qb = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "id", "name" ]);

const qbWithParams = createSelectQuery<TestSchema>()
    .from("users")
    .withParams({ id: 1, name: "bob" })
    .select([ "id" ])
    .where(`id IN (:id, :name)`);

const invalidBuilder = createSelectQuery<TestSchema>()
    .from("unknown_table")
    .select([ "id" ]);

const invalidColumnBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "id1", "nonexistent" ]);

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

// Test invalid column validation
type InvalidColumnBuilderResult = ValidQueryBuilder<
    TestSchema,
    typeof invalidColumnBuilder
>;
type _InvalidColumnBuilderIsError = RequireTrue<
    AssertExtends<InvalidColumnBuilderResult, `[SQL Error] ${string}`>
>;
type _InvalidColumnBuilderHasColumnError = RequireTrue<
    AssertEqual<
        InvalidColumnBuilderResult,
        "[SQL Error] Column 'id1' not found in table 'users'"
    >
>;

// ===========================================================================
// POSITIVE TESTS: Valid quoted column patterns
// ===========================================================================

// Test: table alias with quoted column - alias."columnName"
const aliasQuotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select([ `u."name"` ]);

type AliasQuotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof aliasQuotedColumnBuilder
>;
type _AliasQuotedColumnIsValid = RequireTrue<
    AssertEqual<AliasQuotedColumnResult, typeof aliasQuotedColumnBuilder>
>;

// Test: schema.table."columnName" pattern
const schemaTableQuotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("analytics.events")
    .select([ `analytics.events."event_type"` ]);

type SchemaTableQuotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof schemaTableQuotedColumnBuilder
>;
type _SchemaTableQuotedColumnIsValid = RequireTrue<
    AssertEqual<
        SchemaTableQuotedColumnResult,
        typeof schemaTableQuotedColumnBuilder
    >
>;

// Test: expression with quoted column reference - UPPER("name") as "Name"
const expressionQuotedBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `UPPER("name") as "userName"` ]);

type ExpressionQuotedResult = ValidQueryBuilder<
    TestSchema,
    typeof expressionQuotedBuilder
>;
type _ExpressionQuotedIsValid = RequireTrue<
    AssertEqual<ExpressionQuotedResult, typeof expressionQuotedBuilder>
>;

// Test: table."columnName" without schema
const tableQuotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `users."name"` ]);

type TableQuotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof tableQuotedColumnBuilder
>;
type _TableQuotedColumnIsValid = RequireTrue<
    AssertEqual<TableQuotedColumnResult, typeof tableQuotedColumnBuilder>
>;

// Test: simple quoted column name
const simpleQuotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("orders")
    .select([ `"created_at"` ]);

type SimpleQuotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof simpleQuotedColumnBuilder
>;
type _SimpleQuotedColumnIsValid = RequireTrue<
    AssertEqual<SimpleQuotedColumnResult, typeof simpleQuotedColumnBuilder>
>;

// Test: COALESCE expression with quoted alias
const coalesceExprBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `COALESCE(name, 'Unknown') as "displayName"` ]);

type CoalesceExprResult = ValidQueryBuilder<
    TestSchema,
    typeof coalesceExprBuilder
>;
type _CoalesceExprIsValid = RequireTrue<
    AssertEqual<CoalesceExprResult, typeof coalesceExprBuilder>
>;

// Test: CAST expression
const castExprBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `id::text as "stringId"` ]);

type CastExprResult = ValidQueryBuilder<TestSchema, typeof castExprBuilder>;
type _CastExprIsValid = RequireTrue<
    AssertEqual<CastExprResult, typeof castExprBuilder>
>;

// ===========================================================================
// NEGATIVE TESTS: Invalid quoted column patterns
// ===========================================================================

// Test: alias."invalidColumn" - column doesn't exist
const aliasInvalidQuotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select([ `u."nonexistent"` ]);

type AliasInvalidQuotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof aliasInvalidQuotedColumnBuilder
>;
type _AliasInvalidQuotedColumnIsError = RequireTrue<
    AssertExtends<AliasInvalidQuotedColumnResult, `[SQL Error] ${string}`>
>;

// Test: schema.table."invalidColumn" - column doesn't exist
const schemaTableInvalidQuotedBuilder = createSelectQuery<TestSchema>()
    .from("analytics.events")
    .select([ `analytics.events."badColumn"` ]);

type SchemaTableInvalidQuotedResult = ValidQueryBuilder<
    TestSchema,
    typeof schemaTableInvalidQuotedBuilder
>;
type _SchemaTableInvalidQuotedIsError = RequireTrue<
    AssertExtends<SchemaTableInvalidQuotedResult, `[SQL Error] ${string}`>
>;

// Test: table."invalidColumn" - column doesn't exist
const tableInvalidQuotedBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `users."badColumn"` ]);

type TableInvalidQuotedResult = ValidQueryBuilder<
    TestSchema,
    typeof tableInvalidQuotedBuilder
>;
type _TableInvalidQuotedIsError = RequireTrue<
    AssertExtends<TableInvalidQuotedResult, `[SQL Error] ${string}`>
>;

// Test: simple quoted invalid column
const simpleQuotedInvalidBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ `"invalid_column"` ]);

type SimpleQuotedInvalidResult = ValidQueryBuilder<
    TestSchema,
    typeof simpleQuotedInvalidBuilder
>;
type _SimpleQuotedInvalidIsError = RequireTrue<
    AssertExtends<SimpleQuotedInvalidResult, `[SQL Error] ${string}`>
>;

// ===========================================================================
// POSITIVE TESTS: Valid unquoted column patterns (lower case)
// ===========================================================================

// Test: simple unquoted column
const simpleUnquotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "id", "name", "active" ]);

type SimpleUnquotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof simpleUnquotedColumnBuilder
>;
type _SimpleUnquotedColumnIsValid = RequireTrue<
    AssertEqual<SimpleUnquotedColumnResult, typeof simpleUnquotedColumnBuilder>
>;

// Test: alias.column (unquoted)
const aliasUnquotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select([ "u.id", "u.name" ]);

type AliasUnquotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof aliasUnquotedColumnBuilder
>;
type _AliasUnquotedColumnIsValid = RequireTrue<
    AssertEqual<AliasUnquotedColumnResult, typeof aliasUnquotedColumnBuilder>
>;

// Test: table.column (unquoted, no alias)
const tableUnquotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "users.id", "users.name" ]);

type TableUnquotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof tableUnquotedColumnBuilder
>;
type _TableUnquotedColumnIsValid = RequireTrue<
    AssertEqual<TableUnquotedColumnResult, typeof tableUnquotedColumnBuilder>
>;

// Test: schema.table.column (unquoted)
const schemaTableUnquotedColumnBuilder = createSelectQuery<TestSchema>()
    .from("analytics.events")
    .select([ "analytics.events.id", "analytics.events.event_type" ]);

type SchemaTableUnquotedColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof schemaTableUnquotedColumnBuilder
>;
type _SchemaTableUnquotedColumnIsValid = RequireTrue<
    AssertEqual<
        SchemaTableUnquotedColumnResult,
        typeof schemaTableUnquotedColumnBuilder
    >
>;

// Test: wildcard columns
const wildcardColumnBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "*" ]);

type WildcardColumnResult = ValidQueryBuilder<
    TestSchema,
    typeof wildcardColumnBuilder
>;
type _WildcardColumnIsValid = RequireTrue<
    AssertEqual<WildcardColumnResult, typeof wildcardColumnBuilder>
>;

// Test: table wildcard
const tableWildcardBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select([ "u.*" ]);

type TableWildcardResult = ValidQueryBuilder<
    TestSchema,
    typeof tableWildcardBuilder
>;
type _TableWildcardIsValid = RequireTrue<
    AssertEqual<TableWildcardResult, typeof tableWildcardBuilder>
>;

// ===========================================================================
// NEGATIVE TESTS: Invalid unquoted column patterns
// ===========================================================================

// Test: alias.invalidColumn (unquoted)
const aliasInvalidUnquotedBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select([ "u.nonexistent" ]);

type AliasInvalidUnquotedResult = ValidQueryBuilder<
    TestSchema,
    typeof aliasInvalidUnquotedBuilder
>;
type _AliasInvalidUnquotedIsError = RequireTrue<
    AssertExtends<AliasInvalidUnquotedResult, `[SQL Error] ${string}`>
>;

// Test: table.invalidColumn (unquoted)
const tableInvalidUnquotedBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "users.badcolumn" ]);

type TableInvalidUnquotedResult = ValidQueryBuilder<
    TestSchema,
    typeof tableInvalidUnquotedBuilder
>;
type _TableInvalidUnquotedIsError = RequireTrue<
    AssertExtends<TableInvalidUnquotedResult, `[SQL Error] ${string}`>
>;

// Test: schema.table.invalidColumn (unquoted)
const schemaTableInvalidUnquotedBuilder = createSelectQuery<TestSchema>()
    .from("analytics.events")
    .select([ "analytics.events.bad_column" ]);

type SchemaTableInvalidUnquotedResult = ValidQueryBuilder<
    TestSchema,
    typeof schemaTableInvalidUnquotedBuilder
>;
type _SchemaTableInvalidUnquotedIsError = RequireTrue<
    AssertExtends<SchemaTableInvalidUnquotedResult, `[SQL Error] ${string}`>
>;

// Test: simple invalid unquoted column
const simpleInvalidUnquotedBuilder = createSelectQuery<TestSchema>()
    .from("users")
    .select([ "nonexistent_column" ]);

type SimpleInvalidUnquotedResult = ValidQueryBuilder<
    TestSchema,
    typeof simpleInvalidUnquotedBuilder
>;
type _SimpleInvalidUnquotedIsError = RequireTrue<
    AssertExtends<SimpleInvalidUnquotedResult, `[SQL Error] ${string}`>
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
