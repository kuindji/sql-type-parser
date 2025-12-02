# Type-Level SQL Parser

> 🎵 _Vibe-coded with Claude Opus 4.5_
>
> 🙏 _Inspired by and built upon [telefrek/sql](https://github.com/telefrek/sql) - a TypeScript SQL parsing series_

`@kuindji/sql-type-parser` is a **type-level SQL parser** for TypeScript that transforms SQL query string literals into their corresponding AST types **at compile time**. It enables:

- **Compile-time SQL parsing**: Parse SQL queries entirely within TypeScript's type system
- **Type-safe result inference**: Automatically infer result types from SQL queries
- **Query validation**: Catch SQL errors at compile time, not runtime
- **Zero runtime overhead**: Pure type-level operations with no runtime code

## Installation

```bash
npm install @kuindji/sql-type-parser
```

## Define Your Schema

First, describe your database structure as a TypeScript type:

```typescript
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

```typescript
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

### `ValidateSQL<SQL, Schema>`

Validates a query at compile time. Returns `true` if valid, or an error message:

```typescript
import type { ValidateSQL } from "@kuindji/sql-type-parser";

type Valid = ValidateSQL<"SELECT id FROM users", MySchema>;
// true

type Invalid = ValidateSQL<"SELECT unknown_col FROM users", MySchema>;
// "Column 'unknown_col' not found in any table"
```

### `InsertResult<SQL, Schema>`

Infers the RETURNING clause result for INSERT queries:

```typescript
import type { InsertResult } from "@kuindji/sql-type-parser";

type Result = InsertResult<
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name",
    MySchema
>;
// { id: number; name: string }
```

### `UpdateResult<SQL, Schema>`

Infers the RETURNING clause result for UPDATE queries:

```typescript
import type { UpdateResult } from "@kuindji/sql-type-parser";

type Result = UpdateResult<
    "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
    MySchema
>;
// { id: number; name: string; email: string }
```

### `DeleteResult<SQL, Schema>`

Infers the RETURNING clause result for DELETE queries:

```typescript
import type { DeleteResult } from "@kuindji/sql-type-parser";

type Result = DeleteResult<
    "DELETE FROM users WHERE id = $1 RETURNING *",
    MySchema
>;
// { id: number; name: string; email: string; role: "admin" | "user" }
```

### `ParseSQL<SQL>`

Parses a SQL string into an AST type (for advanced use cases):

```typescript
import type { ParseSQL, SQLSelectQuery } from "@kuindji/sql-type-parser";

type AST = ParseSQL<"SELECT id FROM users">;
// SQLSelectQuery<SelectClause<...>>
```

## Supported SQL

The parser handles SELECT, INSERT, UPDATE, and DELETE queries with:

- JOINs (INNER, LEFT, RIGHT, FULL, CROSS)
- Subqueries and derived tables
- Common Table Expressions (WITH)
- Aggregates (COUNT, SUM, AVG, MIN, MAX)
- UNION, INTERSECT, EXCEPT
- PostgreSQL syntax (JSON operators, type casting, arrays)
- MySQL syntax (backtick quotes, specific functions)

See [SPECIFICATION.md](./SPECIFICATION.md) for full details.

## Limitations

- TypeScript's recursion limits may be hit with very complex queries
- Quoted identifiers with spaces not supported: use `"user-id"` not `"user id"`

## License

MIT
