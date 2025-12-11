import type {
    BuilderSQL,
    SelectQueryBuilder,
} from "./src/select/builder.js";

import {
    createSelectQuery,
} from "./src/index.js";

type UserId = string & { __type: "users.id"; };
type UserName = string & { __type: "users.name"; };

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
                id: string;
                userId: UserId;
                total: number;
                status: string;
            };
        };
    };
};

// Replicate the test
const builder = createSelectQuery<TestSchema>()
    .from("users")
    .select("id")
    .whereIf(true, "active = TRUE");

type Sql = BuilderSQL<typeof builder>;

// Check each direction of the equality separately
type Expected = "SELECT id FROM users WHERE active = TRUE";
type SqlExtendsExpected = Sql extends Expected ? true : false;
type ExpectedExtendsSql = Expected extends Sql ? true : false;

declare const _sqlExtendsExpected: SqlExtendsExpected;  // Should be true
declare const _expectedExtendsSql: ExpectedExtendsSql;  // Should be true

// Force error on both
type RequireTrue<T extends true> = T;
type _test1 = RequireTrue<SqlExtendsExpected>;
type _test2 = RequireTrue<ExpectedExtendsSql>;
