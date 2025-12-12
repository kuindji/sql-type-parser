/**
 * Tests for SQL array type handling.
 *
 * These are compile-time type tests for:
 * - MapSQLTypeToTS handling of array types (integer[], text[], etc.)
 * - Builder type inference for expressions with casts like array_agg(...)::type[]
 */
import type { MapSQLTypeToTS } from "../src/common/ast.js";
import { createSelectQuery } from "../src/select/builder.js";

// =============================================================================
// Type-level assertion helpers
// =============================================================================
type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;

// =============================================================================
// Test MapSQLTypeToTS with array types
// =============================================================================
type ArrayType1 = MapSQLTypeToTS<"integer[]">;
type ArrayType2 = MapSQLTypeToTS<"text[]">;
type ArrayType3 = MapSQLTypeToTS<"jsonb[]">;
type ArrayType4 = MapSQLTypeToTS<"boolean[]">;
type ArrayType5 = MapSQLTypeToTS<"uuid[]">;

type _array_1 = Expect<Equal<ArrayType1, number[]>>;
type _array_2 = Expect<Equal<ArrayType2, string[]>>;
type _array_3 = Expect<Equal<ArrayType3, object[]>>;
type _array_4 = Expect<Equal<ArrayType4, boolean[]>>;
type _array_5 = Expect<Equal<ArrayType5, string[]>>;

// =============================================================================
// Test builder with aggregate functions using array type casts
// =============================================================================
type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            payments: {
                id: number;
                amount: number;
                user_id: number;
            };
            users: {
                id: number;
                name: string;
            };
        };
    };
};

// Test: array_agg with integer[] cast
const arrayAggBuilder = createSelectQuery<TestSchema>()
    .from("payments p")
    .select(/*sql*/ `array_agg(p."id")::integer[] as "paymentIds"`);

type ArrayAggResult = typeof arrayAggBuilder extends { getResultType(): infer R }
    ? R
    : never;

type _agg_result = Expect<ArrayAggResult extends { paymentIds: number[] } ? true : false>;

// Test: string_agg with text[] cast (user uses cast to get typed result)
const stringAggBuilder = createSelectQuery<TestSchema>()
    .from("users u")
    .select(/*sql*/ `string_agg(u."name", ',')::text as "names"`);

type StringAggResult = typeof stringAggBuilder extends { getResultType(): infer R }
    ? R
    : never;

type _string_agg_result = Expect<StringAggResult extends { names: string } ? true : false>;

// Test: json_agg with jsonb[] cast
const jsonAggBuilder = createSelectQuery<TestSchema>()
    .from("payments p")
    .select(/*sql*/ `json_agg(p."id")::jsonb[] as "paymentData"`);

type JsonAggResult = typeof jsonAggBuilder extends { getResultType(): infer R }
    ? R
    : never;

type _json_agg_result = Expect<JsonAggResult extends { paymentData: object[] } ? true : false>;

// Export to ensure file is treated as a module
export type ArrayTypeTestsPass = true;
