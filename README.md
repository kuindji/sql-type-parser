# Type-Level SQL SELECT Parser

> 🎵 _Vibe-coded with Claude Opus 4.5_
>
> 🙏 _Inspired by and built upon [telefrek/sql](https://github.com/telefrek/sql) - a TypeScript SQL parsing series_

A TypeScript type-level parser that transforms SQL SELECT query string literals into their corresponding AST types at compile time.

## Features

- **🔥 Compile-time parsing**: SQL queries are parsed entirely at the type level
- **📊 Full AST representation**: Returns a complete Abstract Syntax Tree as a type
- **🎯 Type-safe results**: Match queries against your schema to get result types
- **✅ Query validation**: Catch errors at compile time
- **🚫 Zero runtime**: Pure type-level operations, no runtime code

### Supported SQL Features

| Feature              | Status | Example                      |
| -------------------- | ------ | ---------------------------- |
| SELECT columns       | ✅     | `SELECT id, name`            |
| SELECT *             | ✅     | `SELECT *`                   |
| Column aliases       | ✅     | `SELECT id AS user_id`       |
| Table aliases        | ✅     | `FROM users AS u`            |
| Table.* wildcard     | ✅     | `SELECT u.*`                 |
| DISTINCT             | ✅     | `SELECT DISTINCT role`       |
| FROM clause          | ✅     | `FROM users`                 |
| WHERE clause         | ✅     | `WHERE id = 1`               |
| AND/OR operators     | ✅     | `WHERE a = 1 AND b = 2`      |
| Comparison operators | ✅     | `=, !=, <>, <, >, <=, >=`    |
| LIKE/ILIKE           | ✅     | `WHERE name LIKE '%john%'`   |
| IS NULL/IS NOT NULL  | ✅     | `WHERE deleted_at IS NULL`   |
| INNER JOIN           | ✅     | `INNER JOIN orders ON...`    |
| LEFT JOIN            | ✅     | `LEFT JOIN orders ON...`     |
| RIGHT JOIN           | ✅     | `RIGHT JOIN orders ON...`    |
| FULL JOIN            | ✅     | `FULL JOIN orders ON...`     |
| CROSS JOIN           | ✅     | `CROSS JOIN categories`      |
| Multiple JOINs       | ✅     | Multiple JOIN clauses        |
| ORDER BY             | ✅     | `ORDER BY name DESC`         |
| GROUP BY             | ✅     | `GROUP BY role`              |
| HAVING               | ✅     | `HAVING COUNT(*) > 5`        |
| LIMIT                | ✅     | `LIMIT 10`                   |
| OFFSET               | ✅     | `OFFSET 20`                  |
| COUNT                | ✅     | `COUNT(*)`                   |
| SUM/AVG/MIN/MAX      | ✅     | `SUM(amount)`                |
| WITH (CTEs)          | ✅     | `WITH cte AS (...)`          |
| Derived tables       | ✅     | `FROM (SELECT...) AS sub`    |
| Scalar subqueries    | ✅     | `SELECT (SELECT...)`         |
| Type casting         | ✅     | `id::text`                   |
| JSON operators       | ✅     | `data->>'key'`               |
| Quoted identifiers   | ✅     | `"firstName"`, `"user-id"`   |
| camelCase (quoted)   | ✅     | `"userAccounts"."firstName"` |
| Schema prefix        | ✅     | `FROM public.users`          |
| Cross-schema JOINs   | ✅     | `JOIN audit.logs ON...`      |

## Installation

```bash
npm install @kuindji/sql-type-parser
```

This is a pure TypeScript type library - just import the types:

```typescript
import type {
    ParseSQL,
    QueryResult,
    ValidateSQL,
} from "@kuindji/sql-type-parser";
```

## Quick Start

### 1. Define Your Schema

```typescript
type MySchema = {
    defaultSchema: "public"; // Optional, defaults to first schema
    schemas: {
        public: {
            users: {
                id: number;
                name: string;
                email: string;
                role: "admin" | "user";
                created_at: string;
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

### 2. Get Typed Query Results

```typescript
import type { QueryResult } from "@kuindji/sql-type-parser";

// Simple query
type UserNames = QueryResult<"SELECT id, name FROM users", MySchema>;
// Result: { id: number; name: string }

// Query with JOIN
type OrdersWithUsers = QueryResult<
    `
  SELECT u.name, o.total, o.status
  FROM users AS u
  INNER JOIN orders AS o ON u.id = o.user_id
`,
    MySchema
>;
// Result: { name: string; total: number; status: "pending" | "completed" }

// Union types are preserved!
type Roles = QueryResult<"SELECT role FROM users", MySchema>;
// Result: { role: "admin" | "user" }
```

### 3. Validate Queries at Compile Time

```typescript
import type { ValidateSQL } from "@kuindji/sql-type-parser";

// Valid query returns `true`
type IsValid = ValidateSQL<"SELECT id FROM users", MySchema>;
// Result: true

// Invalid column returns error message
type HasError = ValidateSQL<"SELECT unknown_col FROM users", MySchema>;
// Result: "Column 'unknown_col' not found in any table"

// Invalid table returns error message
type TableError = ValidateSQL<"SELECT * FROM bad_table", MySchema>;
// Result: "Table 'bad_table' not found in schema"
```

## Detailed Usage

### Basic Queries

```typescript
// SELECT all columns
type All = QueryResult<"SELECT * FROM users", MySchema>;
// Result: { id: number; name: string; email: string; role: "admin" | "user"; created_at: string }

// SELECT specific columns
type Specific = QueryResult<"SELECT id, email FROM users", MySchema>;
// Result: { id: number; email: string }

// Column aliases
type Aliased = QueryResult<
    "SELECT id AS user_id, name AS display_name FROM users",
    MySchema
>;
// Result: { user_id: number; display_name: string }

// Table aliases
type TableAliased = QueryResult<
    "SELECT u.id, u.name FROM users AS u",
    MySchema
>;
// Result: { id: number; name: string }

// DISTINCT
type Distinct = QueryResult<"SELECT DISTINCT role FROM users", MySchema>;
// Result: { role: "admin" | "user" }
```

### JOINs

```typescript
// INNER JOIN
type Inner = QueryResult<
    `
  SELECT u.name, o.total
  FROM users AS u
  INNER JOIN orders AS o ON u.id = o.user_id
`,
    MySchema
>;
// Result: { name: string; total: number }

// LEFT JOIN
type Left = QueryResult<
    `
  SELECT u.name, o.total
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
`,
    MySchema
>;
// Result: { name: string; total: number | null }

// Multiple JOINs
type Multi = QueryResult<
    `
  SELECT u.name, o.total, p.name AS product
  FROM users AS u
  INNER JOIN orders AS o ON u.id = o.user_id
  INNER JOIN order_items AS oi ON o.id = oi.order_id
  INNER JOIN products AS p ON oi.product_id = p.id
`,
    MySchema
>;
// Result: { name: string; total: number; product: string }
```

### Schema-Qualified Queries

When your database has multiple schemas, you can use schema-qualified identifiers:

```typescript
// Multi-schema example
type MultiSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: { id: number; name: string; email: string; };
            posts: { id: number; user_id: number; title: string; };
        };
        audit: {
            logs: {
                id: number;
                user_id: number;
                action: string;
                created_at: string;
            };
        };
        analytics: {
            events: { id: number; event_type: string; user_id: number; };
        };
    };
};

// Query uses default schema (public) when no schema specified
type DefaultSchema = QueryResult<"SELECT id, name FROM users", MultiSchema>;
// Result: { id: number; name: string }

// Explicit schema prefix
type ExplicitSchema = QueryResult<
    "SELECT id, email FROM public.users",
    MultiSchema
>;
// Result: { id: number; email: string }

// Query non-default schema
type AuditSchema = QueryResult<
    "SELECT id, action, created_at FROM audit.logs",
    MultiSchema
>;
// Result: { id: number; action: string; created_at: string }

// Cross-schema JOIN
type CrossSchemaJoin = QueryResult<
    `
  SELECT u.name, al.action, al.created_at
  FROM public.users AS u
  INNER JOIN audit.logs AS al ON u.id = al.user_id
`,
    MultiSchema
>;
// Result: { name: string; action: string; created_at: string }

// Schema-qualified column reference
type SchemaColumn = QueryResult<
    "SELECT public.users.name, audit.logs.action FROM public.users JOIN audit.logs ON public.users.id = audit.logs.user_id",
    MultiSchema
>;
// Result: { name: string; action: string }

// Schema.table.* wildcard
type SchemaWildcard = QueryResult<
    "SELECT public.users.* FROM public.users",
    MultiSchema
>;
// Result: { id: number; name: string; email: string }
```

### Aggregates

```typescript
// COUNT
type Count = QueryResult<"SELECT COUNT ( * ) AS total FROM users", MySchema>;
// Result: { total: number }

// SUM
type Sum = QueryResult<"SELECT SUM ( total ) AS revenue FROM orders", MySchema>;
// Result: { revenue: number }

// GROUP BY with aggregates
type Grouped = QueryResult<
    `
  SELECT user_id, COUNT ( * ) AS order_count, SUM ( total ) AS total_spent
  FROM orders
  GROUP BY user_id
`,
    MySchema
>;
// Result: { user_id: number; order_count: number; total_spent: number }
```

### Common Table Expressions (CTEs)

```typescript
type WithCTE = QueryResult<
    `
  WITH active_users AS (
    SELECT id, name FROM users WHERE status = 'active'
  )
  SELECT * FROM active_users
`,
    MySchema
>;
// Result: { id: number; name: string }

// Multiple CTEs
type MultipleCTEs = QueryResult<
    `
  WITH 
    active_users AS (
      SELECT id, name FROM users WHERE status = 'active'
    ),
    order_totals AS (
      SELECT user_id, SUM ( total ) AS total FROM orders GROUP BY user_id
    )
  SELECT au.name, ot.total
  FROM active_users AS au
  LEFT JOIN order_totals AS ot ON au.id = ot.user_id
`,
    MySchema
>;
// Result: { name: string; total: number | null }
```

### Derived Tables (Subqueries in FROM)

```typescript
type DerivedTable = QueryResult<
    `
  SELECT sub.user_name, sub.order_count
  FROM (
    SELECT u.name AS user_name, COUNT ( o.id ) AS order_count
    FROM users AS u
    LEFT JOIN orders AS o ON u.id = o.user_id
    GROUP BY u.name
  ) AS sub
  WHERE sub.order_count > 5
`,
    MySchema
>;
// Result: { user_name: string; order_count: number }
```

### PostgreSQL Type Casting

```typescript
// Type casts return the cast type, not the underlying column type
type CastText = QueryResult<"SELECT id::text AS id_str FROM users", MySchema>;
// Result: { id_str: string } - cast to text returns string

type CastInt = QueryResult<
    "SELECT amount::integer AS int_amount FROM data",
    MySchema
>;
// Result: { int_amount: number } - cast to integer returns number

// Cast in complex expressions (JSON, functions) also preserves cast type
type JsonCast = QueryResult<
    "SELECT data->>'value'::integer AS val FROM docs",
    MySchema
>;
// Result: { val: number }
```

### JSON Operators (PostgreSQL)

```typescript
// Arrow operators for JSON access
type JsonAccess = QueryResult<
    `
  SELECT 
    data->>'name' AS name,
    metadata#>>'{user,email}' AS email
  FROM documents
`,
    JsonSchema
>;
// Result: { name: string; email: string }
```

### Identifier Case Handling

In SQL, unquoted identifiers are case-insensitive and typically lowercased by the database. To preserve case (camelCase, PascalCase, Mixed_Case), identifiers must be quoted.

```typescript
// Schema with camelCase columns
type MySchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            userAccounts: {
                id: number;
                firstName: string;
                lastName: string;
                emailAddress: string;
                createdAt: string;
                Account_Status: "active" | "suspended";
            };
            OrderItems: {
                id: number;
                orderId: number;
                unitPrice: number;
                Item_Status: "pending" | "shipped";
            };
        };
    };
};

// ❌ WRONG: Unquoted camelCase identifiers (would be lowercased by DB)
type Wrong = QueryResult<"SELECT firstName FROM userAccounts", MySchema>;

// ✅ CORRECT: Quote identifiers with uppercase letters
type Correct = QueryResult<'SELECT "firstName" FROM "userAccounts"', MySchema>;
// Result: { firstName: string }
```

#### camelCase Columns and Tables

```typescript
// Quote both table and column names that contain uppercase
type CamelCase = QueryResult<
    'SELECT "firstName", "lastName", "emailAddress" FROM "userAccounts"',
    MySchema
>;
// Result: { firstName: string; lastName: string; emailAddress: string }

// With table alias
type WithAlias = QueryResult<
    'SELECT ua."firstName", ua."lastName" FROM "userAccounts" AS ua',
    MySchema
>;
// Result: { firstName: string; lastName: string }
```

#### Mixed_Case Identifiers

```typescript
// Mixed case with underscores
type MixedCase = QueryResult<
    'SELECT "Account_Status" FROM "userAccounts"',
    MySchema
>;
// Result: { Account_Status: "active" | "suspended" }
```

#### JOINs with Quoted Identifiers

```typescript
type QuotedJoin = QueryResult<
    `
  SELECT ua."firstName", oi."unitPrice", oi."Item_Status"
  FROM "userAccounts" AS ua
  INNER JOIN "OrderItems" AS oi ON ua.id = oi."orderId"
`,
    MySchema
>;
// Result: { firstName: string; unitPrice: number; Item_Status: "pending" | "shipped" }
```

#### Quoted Aliases

```typescript
// Alias case is always preserved (quoted or not)
type AliasCase = QueryResult<
    'SELECT "firstName" AS "FirstName", "lastName" AS last_name FROM "userAccounts"',
    MySchema
>;
// Result: { FirstName: string; last_name: string }

// Aliases with spaces require quotes
type SpacedAlias = QueryResult<
    'SELECT "firstName" AS "First Name" FROM "userAccounts"',
    MySchema
>;
// Result: { "First Name": string }
```

#### Special Characters in Identifiers

```typescript
// Identifiers with hyphens must be quoted
type HyphenSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            "user-sessions": {
                id: number;
                "ip-address": string;
                "user-agent": string | null;
            };
        };
    };
};

type Hyphens = QueryResult<
    'SELECT id, "ip-address", "user-agent" FROM "user-sessions"',
    HyphenSchema
>;
// Result: { id: number; "ip-address": string; "user-agent": string | null }
```

## Type Mappings

### SQL to TypeScript Type Mapping

| SQL Type                                                  | TypeScript Type |
| --------------------------------------------------------- | --------------- |
| `text`, `varchar`, `char`                                 | `string`        |
| `int`, `integer`, `bigint`, `smallint`, `serial`          | `number`        |
| `float`, `real`, `double precision`, `numeric`, `decimal` | `number`        |
| `bool`, `boolean`                                         | `boolean`       |
| `json`, `jsonb`                                           | `object`        |
| `date`, `timestamp`, `timestamptz`, `time`                | `string`        |
| `uuid`                                                    | `string`        |
| `bytea`                                                   | `Uint8Array`    |

### Aggregate Result Types

| Aggregate       | Result Type         |
| --------------- | ------------------- |
| `COUNT(*)`      | `number`            |
| `COUNT(column)` | `number`            |
| `SUM(column)`   | `number`            |
| `AVG(column)`   | `number`            |
| `MIN(column)`   | Same as column type |
| `MAX(column)`   | Same as column type |

## API Reference

### Main Types

#### `ParseSQL<T>`

Parse a SQL string into an AST type.

```typescript
type AST = ParseSQL<"SELECT * FROM users">;
```

#### `QueryResult<SQL, Schema>`

Parse SQL and match against schema to get result type.

```typescript
type Result = QueryResult<"SELECT id, name FROM users", MySchema>;
// Result: { id: number; name: string }
```

#### `ValidateSQL<SQL, Schema>`

Validate a query at compile time. Returns `true` if valid, or error message string if invalid.

```typescript
type Valid = ValidateSQL<"SELECT id FROM users", MySchema>;
// Result: true

type Invalid = ValidateSQL<"SELECT bad_col FROM users", MySchema>;
// Result: "Column 'bad_col' not found in any table"
```

#### `MatchQuery<AST, Schema>`

Match a parsed AST against a schema (lower level than QueryResult).

```typescript
type AST = ParseSQL<"SELECT id FROM users">;
type Result = MatchQuery<AST, MySchema>;
```

#### `MatchError<Message>`

Error type returned when column/table resolution fails.

```typescript
type Error = MatchError<"Column 'x' not found">;
// { __error: true; message: "Column 'x' not found" }
```

#### `DatabaseSchema`

Expected structure of a database schema with schema support.

```typescript
type Schema = {
    defaultSchema?: string; // Optional, defaults to first schema key
    schemas: {
        [schemaName: string]: {
            [tableName: string]: {
                [columnName: string]: any;
            };
        };
    };
};
```

### AST Types

- `SQLQuery` - Top-level query wrapper
- `SelectClause` - SELECT statement AST
- `ColumnRef`, `TableColumnRef`, `UnboundColumnRef` - Column references
- `TableRef`, `DerivedTableRef` - Table references
- `CTEDefinition` - Common Table Expression
- `JoinClause`, `JoinType` - JOIN clause types
- `WhereExpr`, `BinaryExpr`, `LogicalExpr` - Expression types
- `OrderByItem`, `SortDirection` - ORDER BY types
- `AggregateExpr`, `AggregateFunc` - Aggregate function types
- `LiteralValue` - Literal value wrapper
- `ComplexExpr` - Complex expressions (JSON ops, function calls)
- `SubqueryExpr` - Scalar subqueries

### Utility Types

- `ParseError` - Error marker type
- `NormalizeSQL` - SQL normalization type
- `NextToken`, `ExtractUntil`, `SplitByComma` - Tokenization helpers
- `RemoveQuotes`, `Trim`, `Flatten` - String/type utilities

## Limitations

Due to TypeScript's type system constraints:

1. **Recursion depth**: Very complex queries with many columns, multiple JOINs, or deeply nested expressions may hit TypeScript's type instantiation depth limit (~50 levels)

2. **Aggregate syntax**: Aggregate functions require spaces around parentheses:
   - ✅ `COUNT ( * )`
   - ❌ `COUNT(*)`

3. **Complex WHERE**: WHERE expressions are parsed but not fully typed (used for validation markers only, not type inference)

4. **Subquery depth**: Deeply nested subqueries may exceed recursion limits

5. **Expression arithmetic**: Mathematical expressions in SELECT aren't evaluated for type

6. **Quoted identifiers with spaces**: Identifiers containing spaces (e.g., `"my table"`, `"user id"`) are not supported because the tokenizer splits on spaces. Use hyphens or underscores instead:
   - ✅ `"user-id"` or `"user_id"`
   - ❌ `"user id"`

## File Structure

```
parser/type-parser/
├── src/
│   ├── index.ts           # Public API - re-exports all types
│   ├── parser.ts          # Main parser types
│   ├── matcher.ts         # Schema matcher types
│   ├── tokenizer.ts       # SQL tokenization utilities
│   ├── ast.ts             # AST type definitions
│   ├── utils.ts           # String and number utilities
│   └── examples/
│       ├── index.ts       # Examples entry point
│       ├── schema.ts      # Example database schemas
│       ├── parser-examples.ts    # Parser feature examples
│       ├── matcher-examples.ts   # Type inference examples
│       └── tests.ts       # Type-level tests
├── tsconfig.json          # TypeScript configuration
├── package.json           # Package configuration
└── README.md              # This file
```

## Examples

### E-Commerce Query

```typescript
import type { QueryResult } from "@kuindji/sql-type-parser";
import type { ECommerceSchema } from "@kuindji/sql-type-parser/examples";

type CustomerOrderSummary = QueryResult<
    `
  WITH order_stats AS (
    SELECT 
      user_id,
      COUNT ( * ) AS order_count,
      SUM ( total_amount ) AS lifetime_value,
      MAX ( created_at ) AS last_order
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY user_id
  )
  SELECT 
    u.email,
    u.first_name,
    u.last_name,
    os.order_count,
    os.lifetime_value,
    os.last_order
  FROM users AS u
  LEFT JOIN order_stats AS os ON u.id = os.user_id
  WHERE u.role = 'customer'
  ORDER BY os.lifetime_value DESC
  LIMIT 100
`,
    ECommerceSchema
>;

// Result type:
// {
//   email: string
//   first_name: string | null
//   last_name: string | null
//   order_count: number
//   lifetime_value: number
//   last_order: string
// }
```

### Blog Query

```typescript
import type { QueryResult } from "@kuindji/sql-type-parser";
import type { BlogSchema } from "@kuindji/sql-type-parser/examples";

type PostsWithComments = QueryResult<
    `
  SELECT 
    p.title,
    p.status,
    u.name AS author_name,
    COUNT ( c.id ) AS comment_count
  FROM posts AS p
  INNER JOIN users AS u ON p.author_id = u.id
  LEFT JOIN comments AS c ON p.id = c.post_id
  WHERE p.status = 'published'
  GROUP BY p.id, p.title, p.status, u.name
  ORDER BY comment_count DESC
  LIMIT 10
`,
    BlogSchema
>;

// Result type:
// {
//   title: string
//   status: "draft" | "published" | "archived"
//   author_name: string
//   comment_count: number
// }
```

## Running Tests

The tests are type-level assertions. If the project compiles, all tests pass:

```bash
npm run typecheck
# or
npx tsc --noEmit
```

## Contributing

Contributions are welcome! Areas that could use improvement:

- Better error messages
- Performance optimizations for complex queries
- Additional aggregate functions
- Window functions support

## License

MIT
