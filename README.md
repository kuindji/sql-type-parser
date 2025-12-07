# Type-Level SQL Parser

> 🎵 _Generated with Claude Opus 4.5 and GPT 5.1_
>
> 🙏 _Inspired by and built upon [telefrek/sql](https://github.com/telefrek/sql) - a TypeScript SQL parsing series_

`@kuindji/sql-type-parser` is a **type-level SQL parser** for TypeScript that transforms SQL query string literals into their corresponding AST types **at compile time**. It enables:

- **Compile-time SQL parsing**: Parse SQL queries entirely within TypeScript's type system.
- **Type-safe result inference**: Automatically infer result types from SQL queries.
- **Lightweight query validation**: Catch obvious schema mistakes (missing tables/columns) at compile time.
- **Optional runtime helpers**: Build SQL with a small SELECT query builder and DB helpers, while keeping types in sync.

### Design goals

This library is intentionally pragmatic:

- **Focus on result shapes**: The primary goal is to understand what rows your query returns.
- **Schema-aware names**: Where possible, it checks that table and column names exist in your schema.
- **Not a full SQL implementation**: It does not aim to completely validate SQL syntax or every dialect feature; many complex expressions are treated as opaque strings.

## Installation

```bash
npm install @kuindji/sql-type-parser
```

## Define Your Schema

First, describe your database structure as a TypeScript type:

```ts
type MySchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                email: string;
                role: "admin" | "user";
            };
            orders: {
                id: number;
                user_id: number;
                total: number;
                status: "pending" | "completed";
            };
        };
    };
};
```

## API

### `QueryResult<SQL, Schema>`

Infers the result type of a SELECT query:

```ts
import type { QueryResult } from "@kuindji/sql-type-parser";

type Result = QueryResult<"SELECT id, name, role FROM users", MySchema>;
// { id: number; name: string; role: "admin" | "user" }

type JoinResult = QueryResult<
    `SELECT u.name, o.total
     FROM users AS u
     INNER JOIN orders AS o ON u.id = o.user_id`,
    MySchema
>;
// { name: string; total: number }
```

### `SelectQueryBuilder` and `createSelectQuery`

If you prefer to build queries fluently instead of writing raw strings, you can use the SELECT query builder. It assembles an SQL string at runtime and keeps a schema-aware row type at compile time.

```ts
import { createSelectQuery } from "@kuindji/sql-type-parser";
import type { BuilderReturnType, BuilderSQL } from "@kuindji/sql-type-parser";
import type { ECommerceSchema } from "./schema";

const ActiveUsers = createSelectQuery<ECommerceSchema>()
    .select([ "id", "email" ])
    .from("users")
    .where("is_active = TRUE");

type ActiveUsersSQL = BuilderSQL<typeof ActiveUsers>;
// "SELECT id, email FROM users WHERE is_active = TRUE"

type ActiveUsersRow = BuilderReturnType<typeof ActiveUsers>;
// { id: number; email: string }

const sql = ActiveUsers.toString(); // runtime SQL string
```

The builder:

- **Respects your schema** when selecting columns, so the inferred row type matches your tables.
- **Treats most WHERE/JOIN fragments as opaque strings**: it does shallow checks for table and column names where it can, but it does not try to fully parse every expression.
- **Is designed for "typed query building"**, not as a strict SQL linter.

See `examples/select` for more complete builder and DB integration examples.

### `createSelectFn<Schema>`

To plug this library into your existing database client, you can wrap it with `createSelectFn`. You pass in a function that actually executes SQL, and you get back a `select` function that is typed from your schema and queries.

```ts
import { createSelectFn } from "@kuindji/sql-type-parser";

type Schema = MySchema;

const select = createSelectFn<Schema>((sql, params) =>
    pool.query(sql, params).then(result => result.rows)
);

// Query string is checked against Schema and result is inferred
const users = await select("SELECT id, name FROM users WHERE id = $1", [ 1 ]);
// users: Array<{ id: number; name: string }>
```

The returned function can also accept a `SelectQueryBuilder` instead of a raw string, so you can build queries fluently and still run them through your normal DB interface.

### `ValidateSQL<SQL, Schema>`

Validates a query at compile time. Returns `true` if valid, or an error message:

```ts
import type { ValidateSQL } from "@kuindji/sql-type-parser";

type Valid = ValidateSQL<"SELECT id FROM users", MySchema>;
// true

type Invalid = ValidateSQL<"SELECT unknown_col FROM users", MySchema>;
// "Column 'unknown_col' not found in any table"
```

Validation is intentionally shallow: it focuses on tables and columns that can be resolved from your schema, and does not guarantee that every possible SQL construct is valid for your database.

### `InsertResult<SQL, Schema>`

Infers the RETURNING clause result for INSERT queries:

```ts
import type { InsertResult } from "@kuindji/sql-type-parser";

type Result = InsertResult<
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name",
    MySchema
>;
// { id: number; name: string }
```

### `UpdateResult<SQL, Schema>`

Infers the RETURNING clause result for UPDATE queries:

```ts
import type { UpdateResult } from "@kuindji/sql-type-parser";

type Result = UpdateResult<
    "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
    MySchema
>;
// { id: number; name: string; email: string }
```

### `DeleteResult<SQL, Schema>`

Infers the RETURNING clause result for DELETE queries:

```ts
import type { DeleteResult } from "@kuindji/sql-type-parser";

type Result = DeleteResult<
    "DELETE FROM users WHERE id = $1 RETURNING *",
    MySchema
>;
// { id: number; name: string; email: string; role: "admin" | "user" }
```

### `ParseSQL<SQL>`

Parses a SQL string into an AST type (for advanced use cases):

```ts
import type { ParseSQL, SQLSelectQuery } from "@kuindji/sql-type-parser";

type AST = ParseSQL<"SELECT id FROM users">;
// SQLSelectQuery<SelectClause<...>>
```

## Supported SQL

The parser understands a wide range of common SELECT, INSERT, UPDATE, and DELETE queries, including:

- JOINs (INNER, LEFT, RIGHT, FULL, CROSS)
- Subqueries and derived tables
- Common Table Expressions (WITH)
- Aggregates (COUNT, SUM, AVG, MIN, MAX)
- UNION, INTERSECT, EXCEPT
- A mix of PostgreSQL and MySQL style syntax where practical

Support is geared toward typical application queries and type inference rather than exhaustively modelling every dialect and edge case.

## Limitations

- **Not a full SQL engine**: some syntactically invalid queries may still type-check if table and column names look reasonable.
- **Expression coverage is intentionally shallow**: complex expressions, vendor-specific functions or casts are often treated as opaque and may infer as `unknown` or `string`.
- **Schema-driven checks**: if a table or column is missing from your TypeScript schema, the library cannot warn about it.
- **TypeScript recursion limits** may be hit with very complex queries.
- **Quoted identifiers with spaces are not supported**: use `"user-id"` instead of `"user id"`.

The intent is to give you useful feedback about **result types** and **schema usage**, not to be a perfect replacement for your database’s own SQL validator.

## License

MIT
