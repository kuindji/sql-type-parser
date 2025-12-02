# SQL Type Parser - Project Specification

> **Author**: Ivan Kuindzhi
> **License**: MIT

## 1. Project Overview

### 1.1 Purpose

`@kuindji/sql-type-parser` is a **type-level SQL parser** for TypeScript that transforms SQL query string literals into their corresponding AST types **at compile time**. It enables:

- **Compile-time SQL parsing**: Parse SQL queries entirely within TypeScript's type system
- **Type-safe result inference**: Automatically infer result types from SQL queries
- **Query validation**: Catch SQL errors at compile time, not runtime
- **Zero runtime overhead**: Pure type-level operations with no runtime code

### 1.2 Core Philosophy

1. **Type-Level Execution**: All parsing, matching, and validation happens at compile time
2. **Query-Type Separation**: Each SQL query type (SELECT, INSERT, UPDATE, DELETE) has its own execution tree to avoid TypeScript performance issues
3. **Schema-Driven Validation**: Types are inferred from user-defined database schemas
4. **Graceful Degradation**: Dynamic queries (non-literal strings) pass through without validation

### 1.3 Supported SQL Features

| Feature                  | Status | Notes                                      |
| ------------------------ | ------ | ------------------------------------------ |
| SELECT queries           | ✅     | Full support with JOINs, CTEs, subqueries  |
| INSERT queries           | ✅     | VALUES, SELECT, ON CONFLICT, RETURNING     |
| UPDATE queries           | ✅     | SET, FROM, WHERE, RETURNING (with OLD/NEW) |
| DELETE queries           | ✅     | USING, WHERE, RETURNING                    |
| UNION/INTERSECT/EXCEPT   | ✅     | All operators with ALL variant             |
| Common Table Expressions | ✅     | WITH clause support                        |
| JSON operators           | ✅     | PostgreSQL `->`, `->>`, `#>`, `#>>`        |
| Type casting             | ✅     | PostgreSQL `::type` syntax                 |
| Function calls           | ✅     | `length()`, `concat()`, `now()`, etc.      |
| Quoted identifiers       | ✅     | `"camelCase"`, `"special-chars"`           |
| Schema prefixes          | ✅     | `schema.table.column`                      |
| PostgreSQL extensions    | ✅     | Arrays, JSONB, full-text search, etc.      |
| MySQL extensions         | ✅     | Backtick quotes, specific functions        |

### 1.4 Database-Specific Support

The parser supports not only standard SQL but also **modern PostgreSQL** and **MySQL** specific features.

For comprehensive SQL language references, see the dedicated documentation files:

- **[PostgreSQL Reference](./docs/POSTGRESQL_REFERENCE.md)** - Complete operator, type, and syntax reference
- **[MySQL Reference](./docs/MYSQL_REFERENCE.md)** - Complete operator, type, and syntax reference

Official documentation sources:

- PostgreSQL: https://www.postgresql.org/docs/current/sql.html
- MySQL: https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html

#### PostgreSQL Features

| Feature               | Operators/Syntax                   | Example                             |
| --------------------- | ---------------------------------- | ----------------------------------- |
| **Array operators**   | `@>`, `<@`, `&&`, `\|\|`           | `WHERE tags @> ARRAY['sql']`        |
| **JSONB containment** | `@>`, `<@`                         | `WHERE data @> '{"key": "value"}'`  |
| **JSONB existence**   | `?`, `?\|`, `?&`                   | `WHERE data ? 'key'`                |
| **JSON path**         | `->`, `->>`, `#>`, `#>>`           | `data->>'name'`                     |
| **Full-text search**  | `@@`, `@@@`                        | `WHERE tsv @@ to_tsquery('search')` |
| **Geometric ops**     | `<->`, `<#>`, `<<\|`, `\|>>`       | Distance operators                  |
| **Range operators**   | `@>`, `<@`, `&&`, `-\|-`           | `WHERE range @> 5`                  |
| **Type casting**      | `::type`                           | `id::text`                          |
| **Array subscript**   | `[n]`, `[n:m]`                     | `arr[1]`, `arr[1:3]`                |
| **RETURNING clause**  | `RETURNING *`, `RETURNING cols`    | `INSERT ... RETURNING id`           |
| **ON CONFLICT**       | `ON CONFLICT DO UPDATE/NOTHING`    | Upsert support                      |
| **DISTINCT ON**       | `DISTINCT ON (cols)`               | `SELECT DISTINCT ON (user_id)`      |
| **FILTER clause**     | `FILTER (WHERE ...)`               | `COUNT(*) FILTER (WHERE active)`    |
| **WITHIN GROUP**      | `WITHIN GROUP (ORDER BY)`          | Ordered-set aggregates              |
| **Window functions**  | `OVER (PARTITION BY ... ORDER BY)` | Analytics                           |
| **LATERAL joins**     | `LATERAL`                          | `JOIN LATERAL (SELECT ...)`         |
| **TABLESAMPLE**       | `TABLESAMPLE method (%)`           | Random sampling                     |

#### MySQL Features

| Feature                 | Syntax                     | Example                            |
| ----------------------- | -------------------------- | ---------------------------------- |
| **Backtick quotes**     | `` `identifier` ``         | `` SELECT `column` FROM `table` `` |
| **JSON operators**      | `->`, `->>`                | `data->'$.key'`                    |
| **JSON functions**      | `JSON_EXTRACT`, etc.       | `JSON_EXTRACT(data, '$.key')`      |
| **String comparison**   | `<=>` (NULL-safe equals)   | `WHERE a <=> b`                    |
| **Regex operators**     | `REGEXP`, `RLIKE`          | `WHERE name REGEXP '^A'`           |
| **Full-text**           | `MATCH ... AGAINST`        | `MATCH(title) AGAINST('search')`   |
| **INSERT modifiers**    | `INSERT IGNORE`, `REPLACE` | Conflict handling                  |
| **ON DUPLICATE KEY**    | `ON DUPLICATE KEY UPDATE`  | MySQL upsert                       |
| **LIMIT with offset**   | `LIMIT n, m`               | `LIMIT 10, 20` (MySQL style)       |
| **GROUP BY extensions** | `WITH ROLLUP`              | Grouping sets                      |
| **Index hints**         | `USE INDEX`, `FORCE INDEX` | Query hints                        |

---

## 2. Architecture

### 2.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SQL Query String                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Router (router.ts)                                │
│  - Detects query type (SELECT/INSERT/UPDATE/DELETE)                 │
│  - Routes to appropriate parser                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┬───────────────┐
                    ▼               ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  SELECT   │   │  INSERT   │   │  UPDATE   │   │  DELETE   │
            │  Parser   │   │  Parser   │   │  Parser   │   │  Parser   │
            └───────────┘   └───────────┘   └───────────┘   └───────────┘
                    │               │               │               │
                    ▼               ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
            │   AST     │   │   AST     │   │   AST     │   │   AST     │
            │  Types    │   │  Types    │   │  Types    │   │  Types    │
            └───────────┘   └───────────┘   └───────────┘   └───────────┘
                    │               │               │               │
                    ▼               ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Matcher  │   │  Matcher  │   │  Matcher  │   │  Matcher  │
            │ (Schema)  │   │ (Schema)  │   │ (Schema)  │   │ (Schema)  │
            └───────────┘   └───────────┘   └───────────┘   └───────────┘
                    │               │               │               │
                    ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Result Type                                   │
│     { column1: type1; column2: type2; ... }                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
src/
├── index.ts              # Main entry point - re-exports all public types
├── router.ts             # Query type detection and routing
├── db.ts                 # Database integration utilities (runtime)
├── params.ts             # Parameter extraction and validation types
│
├── common/               # Shared utilities across all query types
│   ├── index.ts          # Re-exports all common types
│   ├── ast.ts            # Common AST node definitions
│   ├── tokenizer.ts      # SQL tokenization utilities
│   ├── utils.ts          # String/number/error utilities
│   └── schema.ts         # Database schema type definitions
│
├── select/               # SELECT query handling
│   ├── index.ts          # Re-exports SELECT types
│   ├── ast.ts            # SELECT-specific AST nodes
│   ├── parser.ts         # SELECT query parser
│   ├── matcher.ts        # Schema matching (type extraction)
│   └── validator.ts      # Comprehensive validation
│
├── insert/               # INSERT query handling
│   ├── index.ts
│   ├── ast.ts
│   ├── parser.ts
│   ├── matcher.ts
│   └── validator.ts
│
├── update/               # UPDATE query handling
│   ├── index.ts
│   ├── ast.ts
│   ├── parser.ts
│   ├── matcher.ts
│   └── validator.ts
│
└── delete/               # DELETE query handling
    ├── index.ts
    ├── ast.ts
    ├── parser.ts
    ├── matcher.ts
    └── validator.ts
```

### 2.3 Implementation Guidelines: Avoiding Circular References

TypeScript's type system has limited recursion depth and can fail with "Type instantiation is excessively deep and possibly infinite" errors. This project must be carefully designed to avoid these issues.

#### Core Principles

1. **Linear Type Flow**: Types should flow in one direction through the parsing pipeline. Avoid type definitions that reference each other bidirectionally.

2. **Explicit Recursion Termination**: Every recursive type must have clear base cases that terminate recursion without depending on other recursive types.

3. **Depth-Limited Recursion**: Use accumulator patterns with explicit depth counters where needed to guarantee termination.

4. **Module Isolation**: Each query type (SELECT, INSERT, UPDATE, DELETE) has its own parser to prevent cross-type circular dependencies.

#### Anti-Patterns to Avoid

```typescript
// ❌ BAD: Circular type reference
type ParseExpr<T> = T extends `(${infer Inner})` ? ParseExpr<Inner> // References itself
    : T extends `${infer A} AND ${infer B}`
        ? { left: ParseExpr<A>; right: ParseExpr<B>; } // Multiple recursive calls
    : T;

// ❌ BAD: Mutually recursive types without clear termination
type TypeA<T> = T extends string ? TypeB<T> : never;
type TypeB<T> = T extends string ? TypeA<T> : never;

// ❌ BAD: Conditional chains that can loop
type Resolve<T, Context> = T extends Ref<infer R> ? Resolve<Context[R], Context> // May never terminate if Context has cycles
    : T;
```

#### Recommended Patterns

```typescript
// ✅ GOOD: Tail recursion with accumulator
type ParseTokens<
    T extends string,
    Acc extends unknown[] = [],
> = T extends "" ? Acc // Base case: empty string terminates
    : T extends `${infer Token} ${infer Rest}`
        ? ParseTokens<Rest, [ ...Acc, Token ]> // Single recursive call, accumulator grows
    : [ ...Acc, T ]; // Final token, no more recursion

// ✅ GOOD: Explicit depth limiting
type SafeRecurse<
    T,
    Depth extends number[] = [],
> = Depth["length"] extends 20 ? unknown // Bail out at depth 20
    : T extends { nested: infer N; } ? SafeRecurse<N, [ ...Depth, 0 ]>
    : T;

// ✅ GOOD: Linear type resolution with single recursive path
type ResolveColumn<T, Context> = T extends
    TableColumnRef<infer Table, infer Col> ? Context[Table][Col] // Direct lookup, no recursion
    : T extends UnboundColumnRef<infer Col> ? FindColumnInContext<Col, Context> // Separate type handles search
    : never;

// ✅ GOOD: Staged processing to break recursion chains
type ParseQuery<T> = NormalizeSQL<T> extends infer Normalized // Stage 1: Normalize
    ? ExtractClauses<Normalized> extends infer Clauses // Stage 2: Extract
        ? BuildAST<Clauses> // Stage 3: Build (no back-reference to Stage 1)
    : never
    : never;
```

#### Module Dependency Rules

```
              ┌─────────────────┐
              │    router.ts    │
              └────────┬────────┘
                       │ imports
      ┌────────────────┼────────────────┐
      ▼                ▼                ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│  select/ │    │  insert/ │    │  update/ │  ...
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     ▼               ▼               ▼
┌─────────────────────────────────────────┐
│              common/                     │
│  (shared utilities, base AST types)     │
└─────────────────────────────────────────┘
```

**Rules**:

- `common/` must NOT import from query-specific modules
- Query modules (select/, insert/, etc.) must NOT import from each other
- Only `router.ts` may import from multiple query modules
- Subqueries are handled by passing pre-resolved types, not by calling back to parent parser

#### Handling Subqueries Without Cycles

Subqueries require special handling to avoid circular parser calls:

```typescript
// ❌ BAD: Direct recursion back to main parser
type ParseSelectColumns<T> = T extends `( SELECT ${infer Sub} ) ${infer Rest}`
    ? { subquery: ParseSelectSQL<Sub>; rest: Rest }  // Calls back to parent!
    : ...;

// ✅ GOOD: Subquery handling is inlined or uses separate non-recursive type
type ParseSelectColumns<T> = T extends `( SELECT ${infer Sub} ) ${infer Rest}`
    ? { subquery: SubquerySelectClause; rawQuery: Sub; rest: Rest }  // Store raw, resolve later
    : ...;

// Resolution happens in matcher phase with controlled recursion
type ResolveSubquery<
    RawQuery extends string,
    Schema,
    Depth extends number[] = []
> = Depth["length"] extends 5
    ? DynamicQueryResult  // Max subquery depth
    : ParseAndMatchSelect<RawQuery, Schema, [...Depth, 0]>;
```

#### Testing for Circular References

During development, test complex nested queries to catch circular reference issues early:

```typescript
// Test deep nesting doesn't cause infinite recursion
type DeepNest = QueryResult<
    `
    SELECT * FROM (
        SELECT * FROM (
            SELECT * FROM (
                SELECT id FROM users
            ) AS d1
        ) AS d2
    ) AS d3
`,
    Schema
>;

// Test complex JOINs with subqueries
type ComplexJoin = QueryResult<
    `
    SELECT a.*, b.*, c.*
    FROM (SELECT * FROM t1) AS a
    JOIN (SELECT * FROM t2) AS b ON a.id = b.id
    JOIN (SELECT * FROM t3) AS c ON b.id = c.id
`,
    Schema
>;

// If TypeScript compiles without "possibly infinite" error, the design is sound
```

---

## 3. Core Type Definitions

### 3.1 Database Schema Structure

```typescript
type DatabaseSchema = {
    /**
     * Optional default schema name
     * If not specified, uses the first schema key
     */
    defaultSchema?: string;

    /**
     * Database schemas containing table definitions.
     * Tables can be defined using `type` or `interface`.
     */
    schemas: {
        [schemaName: string]: {
            [tableName: string]: {
                [columnName: string]: any; // Column type (number, string, etc.)
            };
        };
    };

    /**
     * Optional relation definitions (for future use)
     */
    relations?: {
        [relationName: string]: {
            from: { schema?: string; table: string; column: string; };
            to: { schema?: string; table: string; column: string; };
            type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
        };
    };
};
```

#### Schema Definition Flexibility

The schema and its parts can be defined using either `type` or `interface`. Both are fully supported because the schema types use `object` as the base constraint for table definitions, which accepts both.

```typescript
// Using type aliases
type UsersTable = {
    id: number;
    name: string;
    email: string;
};

// Using interfaces
interface OrdersTable {
    id: number;
    user_id: number;
    total: number;
}

// Mixed usage in schema
type MySchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: UsersTable; // type alias
            orders: OrdersTable; // interface
            products: { // inline definition
                id: number;
                name: string;
                price: number;
            };
        };
    };
};
```

**Implementation Detail**: The `TableDefinition` type is defined as `object` rather than a specific index signature. This allows both `interface` declarations (which are open and extendable) and `type` aliases (which are closed) to satisfy the constraint.

```typescript
// In common/schema.ts
export type TableDefinition = object; // Accepts both interface and type

export type SchemaDefinition = {
    [tableName: string]: TableDefinition;
};
```

**Example Schema**:

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
                created_at: string;
            };
            orders: {
                id: number;
                user_id: number;
                total: number;
                status: "pending" | "completed";
            };
        };
        audit: {
            logs: {
                id: number;
                user_id: number | null;
                action: string;
                created_at: string;
            };
        };
    };
};
```

### 3.2 Common AST Nodes

#### Column References

```typescript
// Unbound column (no table specified)
type UnboundColumnRef<Column extends string = string> = {
    readonly type: "UnboundColumnRef";
    readonly column: Column;
};

// Table-qualified column (table.column or schema.table.column)
type TableColumnRef<
    Table extends string = string,
    Column extends string = string,
    Schema extends string | undefined = string | undefined,
> = {
    readonly type: "TableColumnRef";
    readonly schema: Schema;
    readonly table: Table;
    readonly column: Column;
};

// Table wildcard (table.* or schema.table.*)
type TableWildcard<
    TableOrAlias extends string = string,
    Schema extends string | undefined = string | undefined,
> = {
    readonly type: "TableWildcard";
    readonly schema: Schema;
    readonly table: TableOrAlias;
};

// Complex expression (JSON ops, function calls, casts)
type ComplexExpr<
    ColumnRefs extends ValidatableColumnRef[] = ValidatableColumnRef[],
    CastType extends string | undefined = string | undefined,
> = {
    readonly type: "ComplexExpr";
    readonly columnRefs: ColumnRefs;
    readonly castType: CastType;
};
```

#### Table References

```typescript
// Regular table reference
type TableRef<
    Table extends string = string,
    Alias extends string = Table,
    Schema extends string | undefined = string | undefined,
> = {
    readonly type: "TableRef";
    readonly schema: Schema;
    readonly table: Table;
    readonly alias: Alias;
};

// Derived table (subquery in FROM)
type DerivedTableRef<
    Query extends SubquerySelectClause = SubquerySelectClause,
    Alias extends string = string,
> = {
    readonly type: "DerivedTableRef";
    readonly query: Query;
    readonly alias: Alias;
};

// CTE definition
type CTEDefinition<
    Name extends string = string,
    Query extends SubquerySelectClause = SubquerySelectClause,
> = {
    readonly type: "CTEDefinition";
    readonly name: Name;
    readonly query: Query;
};
```

#### Expressions

```typescript
// Standard SQL comparison operators
type StandardComparisonOp =
    | "="
    | "!="
    | "<>"
    | "<"
    | ">"
    | "<="
    | ">="
    | "LIKE"
    | "ILIKE"
    | "IN"
    | "NOT IN"
    | "IS"
    | "IS NOT"
    | "BETWEEN"
    | "NOT BETWEEN"
    | "SIMILAR TO";

// PostgreSQL-specific operators
type PostgresComparisonOp =
    // Array/JSONB containment
    | "@>" // contains
    | "<@" // contained by
    | "&&" // overlap (arrays)
    // JSONB key existence
    | "?" // key exists
    | "?|" // any key exists
    | "?&" // all keys exist
    // Full-text search
    | "@@" // text search match
    | "@@@" // text search match (deprecated)
    // Range operators
    | "-|-" // adjacent to
    // Geometric operators
    | "<->" // distance
    | "<#>" // distance (box)
    | "<<" // strictly left of
    | ">>" // strictly right of
    | "&<" // not extend right of
    | "&>" // not extend left of
    | "<<|" // strictly below
    | "|>>" // strictly above
    // Pattern matching
    | "~" // regex match
    | "~*" // regex match (case insensitive)
    | "!~" // not regex match
    | "!~*"; // not regex match (case insensitive)

// MySQL-specific operators
type MySQLComparisonOp =
    | "<=>" // NULL-safe equals
    | "REGEXP" // regex match
    | "RLIKE" // regex match (alias)
    | "SOUNDS LIKE"; // phonetic comparison

// Combined comparison operators
type ComparisonOp =
    | StandardComparisonOp
    | PostgresComparisonOp
    | MySQLComparisonOp;

// Logical operators
type LogicalOp = "AND" | "OR" | "NOT" | "XOR"; // XOR is MySQL-specific

// Literal value
type LiteralValue<V = string | number | boolean | null> = {
    readonly type: "Literal";
    readonly value: V;
};

// Binary expression
type BinaryExpr<
    Left = ColumnRefType | LiteralValue,
    Op extends ComparisonOp = ComparisonOp,
    Right = ColumnRefType | LiteralValue,
> = {
    readonly type: "BinaryExpr";
    readonly left: Left;
    readonly operator: Op;
    readonly right: Right;
};

// Parsed condition (for validation)
type ParsedCondition<
    ColumnRefs extends ValidatableColumnRef[] = ValidatableColumnRef[],
> = {
    readonly type: "ParsedCondition";
    readonly columnRefs: ColumnRefs;
};
```

#### Join and Order By

```typescript
// Join types
type JoinType =
    | "INNER"
    | "LEFT"
    | "RIGHT"
    | "FULL"
    | "CROSS"
    | "LEFT OUTER"
    | "RIGHT OUTER"
    | "FULL OUTER";

// Join clause
type JoinClause<
    Type extends JoinType = JoinType,
    Table extends TableSource = TableSource,
    On extends WhereExpr | undefined = WhereExpr | undefined,
> = {
    readonly type: "JoinClause";
    readonly joinType: Type;
    readonly table: Table;
    readonly on: On;
};

// Order by item
type OrderByItem<
    Column extends ColumnRefType = ColumnRefType,
    Direction extends "ASC" | "DESC" = "ASC" | "DESC",
> = {
    readonly type: "OrderByItem";
    readonly column: Column;
    readonly direction: Direction;
};
```

#### Aggregate Expressions

```typescript
type AggregateFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

type AggregateExpr<
    Func extends AggregateFunc = AggregateFunc,
    Arg extends ColumnRefType | "*" = ColumnRefType | "*",
    Alias extends string = string,
> = {
    readonly type: "AggregateExpr";
    readonly func: Func;
    readonly argument: Arg;
    readonly alias: Alias;
};
```

### 3.3 Database-Specific AST Types

#### PostgreSQL-Specific Types

```typescript
// Array expression
type ArrayExpr<
    Elements extends unknown[] = unknown[],
> = {
    readonly type: "ArrayExpr";
    readonly elements: Elements;
};

// Array subscript access
type ArraySubscript<
    Array extends ColumnRefType = ColumnRefType,
    Index extends number | [ number, number ] = number,
> = {
    readonly type: "ArraySubscript";
    readonly array: Array;
    readonly index: Index;
};

// Type cast expression (PostgreSQL :: syntax)
type TypeCastExpr<
    Expression extends ColumnRefType = ColumnRefType,
    CastType extends string = string,
> = {
    readonly type: "TypeCastExpr";
    readonly expression: Expression;
    readonly castType: CastType;
};

// DISTINCT ON clause (PostgreSQL)
type DistinctOnClause<
    Columns extends ColumnRefType[] = ColumnRefType[],
> = {
    readonly type: "DistinctOnClause";
    readonly columns: Columns;
};

// FILTER clause for aggregates
type FilterClause<
    Condition extends WhereExpr = WhereExpr,
> = {
    readonly type: "FilterClause";
    readonly condition: Condition;
};

// Window function
type WindowExpr<
    Func extends string = string,
    Args extends unknown[] = unknown[],
    PartitionBy extends ColumnRefType[] | undefined = undefined,
    OrderBy extends OrderByItem[] | undefined = undefined,
> = {
    readonly type: "WindowExpr";
    readonly func: Func;
    readonly args: Args;
    readonly partitionBy: PartitionBy;
    readonly orderBy: OrderBy;
};

// LATERAL join marker
type LateralJoin<
    Subquery extends DerivedTableRef = DerivedTableRef,
> = {
    readonly type: "LateralJoin";
    readonly subquery: Subquery;
};
```

#### MySQL-Specific Types

```typescript
// MySQL backtick-quoted identifier
type BacktickIdentifier<Name extends string = string> = {
    readonly type: "BacktickIdentifier";
    readonly name: Name;
};

// ON DUPLICATE KEY UPDATE clause
type OnDuplicateKeyUpdate<
    Assignments extends SetAssignment[] = SetAssignment[],
> = {
    readonly type: "OnDuplicateKeyUpdate";
    readonly assignments: Assignments;
};

// MATCH ... AGAINST for full-text search
type MatchAgainstExpr<
    Columns extends ColumnRefType[] = ColumnRefType[],
    SearchTerm extends string = string,
    Mode extends "NATURAL" | "BOOLEAN" | "EXPANSION" | undefined = undefined,
> = {
    readonly type: "MatchAgainstExpr";
    readonly columns: Columns;
    readonly searchTerm: SearchTerm;
    readonly mode: Mode;
};

// Index hint (USE INDEX, FORCE INDEX, IGNORE INDEX)
type IndexHint<
    Type extends "USE" | "FORCE" | "IGNORE" = "USE",
    Indexes extends string[] = string[],
    For extends "JOIN" | "ORDER BY" | "GROUP BY" | undefined = undefined,
> = {
    readonly type: "IndexHint";
    readonly hintType: Type;
    readonly indexes: Indexes;
    readonly for: For;
};

// GROUP BY with ROLLUP
type GroupByWithRollup<
    Columns extends ColumnRefType[] = ColumnRefType[],
> = {
    readonly type: "GroupByWithRollup";
    readonly columns: Columns;
};
```

### 3.4 Query-Specific AST Types

#### SELECT Query

```typescript
type SelectClause<
    Columns extends SelectColumns | "*" = SelectColumns | "*",
    From extends TableSource = TableSource,
    Joins extends JoinClause[] | undefined = JoinClause[] | undefined,
    Where extends WhereExpr | undefined = WhereExpr | undefined,
    GroupBy extends ColumnRefType[] | undefined = ColumnRefType[] | undefined,
    Having extends WhereExpr | undefined = WhereExpr | undefined,
    OrderBy extends OrderByItem[] | undefined = OrderByItem[] | undefined,
    Limit extends number | undefined = number | undefined,
    Offset extends number | undefined = number | undefined,
    Distinct extends boolean = boolean,
    CTEs extends CTEDefinition[] | undefined = CTEDefinition[] | undefined,
> = {
    readonly type: "SelectClause";
    readonly columns: Columns;
    readonly from: From;
    readonly joins: Joins;
    readonly where: Where;
    readonly groupBy: GroupBy;
    readonly having: Having;
    readonly orderBy: OrderBy;
    readonly limit: Limit;
    readonly offset: Offset;
    readonly distinct: Distinct;
    readonly ctes: CTEs;
};

type SQLSelectQuery<Query = SelectClause | UnionClauseAny> = {
    readonly type: "SQLQuery";
    readonly queryType: "SELECT";
    readonly query: Query;
};
```

#### INSERT Query

```typescript
type InsertClause<
    Table extends TableRef = TableRef,
    Columns extends InsertColumnList = InsertColumnList,
    Source extends InsertSource = InsertSource,
    OnConflict extends OnConflictClause | undefined =
        | OnConflictClause
        | undefined,
    Returning extends ReturningClause | undefined = ReturningClause | undefined,
> = {
    readonly type: "InsertClause";
    readonly table: Table;
    readonly columns: Columns;
    readonly source: Source;
    readonly onConflict: OnConflict;
    readonly returning: Returning;
};

type SQLInsertQuery<Query extends InsertClause = InsertClause> = {
    readonly type: "SQLQuery";
    readonly queryType: "INSERT";
    readonly query: Query;
};
```

#### UPDATE Query

```typescript
type UpdateClause<
    Table extends TableRef = TableRef,
    Set extends SetClause = SetClause,
    From extends UpdateFromClause | undefined = UpdateFromClause | undefined,
    Where extends WhereExpr | undefined = WhereExpr | undefined,
    Returning extends ReturningClause | undefined = ReturningClause | undefined,
> = {
    readonly type: "UpdateClause";
    readonly table: Table;
    readonly set: Set;
    readonly from: From;
    readonly where: Where;
    readonly returning: Returning;
};

type SQLUpdateQuery<Query extends UpdateClause = UpdateClause> = {
    readonly type: "SQLQuery";
    readonly queryType: "UPDATE";
    readonly query: Query;
};
```

#### DELETE Query

```typescript
type DeleteClause<
    Table extends TableRef = TableRef,
    Using extends UsingClause | undefined = UsingClause | undefined,
    Where extends WhereExpr | undefined = WhereExpr | undefined,
    Returning extends ReturningClause | undefined = ReturningClause | undefined,
> = {
    readonly type: "DeleteClause";
    readonly table: Table;
    readonly using: Using;
    readonly where: Where;
    readonly returning: Returning;
};

type SQLDeleteQuery<Query extends DeleteClause = DeleteClause> = {
    readonly type: "SQLQuery";
    readonly queryType: "DELETE";
    readonly query: Query;
};
```

---

## 4. Dynamic Query Handling

### 4.1 Template Literal Detection

When a query string contains `${string}` (template literal holes), it indicates dynamic parts that cannot be validated at compile time. The parser handles these gracefully by detecting and stripping them early in the pipeline.

```typescript
// Dynamic query examples
const tableName = "users";
const query = `SELECT * FROM ${tableName}`; // Contains ${string}

// This results in type: `SELECT * FROM ${string}`
// The parser cannot validate this at compile time
```

### 4.2 Dynamic Query Detection Types

```typescript
/**
 * Check if a string type is a literal or the generic `string` type.
 * Literal strings can be parsed; generic `string` cannot.
 */
type IsStringLiteral<T extends string> = string extends T ? false : true;

/**
 * Check if a string contains template literal holes.
 * Template literals like `hello ${string}` contain dynamic parts.
 */
type HasTemplateHoles<T extends string> =
    // Check plain string
    string extends T ? true
        // Check trailing ${string}
        : `${T}_` extends T ? true
        // Check leading ${string}
        : `_${T}` extends T ? true
        // Check internal holes
        : HasInternalHole<T>;

/**
 * Marker type for dynamic queries that bypass validation
 */
type DynamicQuery = {
    readonly __dynamic: true;
};

/**
 * Result type for dynamic queries - allows any property access
 */
type DynamicQueryResult = Record<string, unknown>;
```

### 4.3 Early Stripping Strategy

The parser strips `${string}` patterns as early as possible in the processing pipeline to avoid complex conditional logic throughout:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Input Query String                                │
│         "SELECT * FROM ${string} WHERE id = $1"                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Step 1: Check IsStringLiteral                       │
│  If T is generic `string` type → return DynamicQuery immediately    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Step 2: Check HasTemplateHoles                      │
│  If contains ${string} holes → return DynamicQuery                  │
│  (Used by validators to skip validation)                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Step 3: Normal Parsing                              │
│  Only literal, complete strings reach the full parser               │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 Implementation in Router

```typescript
type ParseSQL<T extends string> =
    // Early exit for non-literal strings
    IsStringLiteral<T> extends false ? DynamicQuery
        : DetectQueryType<T> extends infer QType
            ? QType extends "SELECT" ? ParseSelectSQL<T>
            : QType extends "INSERT" ? ParseInsertSQL<T>
            : QType extends "UPDATE" ? ParseUpdateSQL<T>
            : QType extends "DELETE" ? ParseDeleteSQL<T>
            : ParseError<"Unknown query type">
        : never;
```

### 4.5 Matcher Behavior with Dynamic Queries

When a `DynamicQuery` reaches the matcher, it returns `DynamicQueryResult`:

```typescript
type MatchSelectQuery<Query, Schema> = Query extends DynamicQuery
    ? DynamicQueryResult // Returns Record<string, unknown>
    : Query extends SQLSelectQuery<infer Q> ? MatchSelectClause<Q, Schema>
    : MatchError<"Invalid query">;
```

This allows dynamic queries to pass through without compile errors while still providing type safety for literal queries.

---

## 5. Tokenization Pipeline

### 5.1 SQL Normalization

The tokenizer normalizes SQL strings before parsing:

1. **Replace whitespace**: Tabs, newlines → spaces
2. **Collapse spaces**: Multiple spaces → single space
3. **Split special characters**: Add spaces around `(`, `)`, `,`
4. **Normalize keywords**: Uppercase SQL keywords (SELECT, FROM, WHERE, etc.)
5. **Preserve aliases**: Words following `AS` are NOT normalized

```typescript
type NormalizeSQL<T extends string> = ProcessWords<
    CollapseSpaces<SplitSpecial<ReplaceWhitespace<T>>>
>;
```

**Example**:

```
Input:  "select   id,name\nfrom users as u"
Output: "SELECT id , name FROM users AS u"
```

### 5.2 Token Extraction

```typescript
// Get next token and remainder
type NextToken<T extends string> =
  Trim<T> extends `${infer Token} ${infer Rest}` 
    ? [Token, Rest] 
    : [Trim<T>, ""]

// Check if string starts with specific token
type StartsWith<T extends string, Token extends string> =
  NextToken<T> extends [Token, infer _] ? true : false

// Extract content until terminator (respects parenthesis depth)
type ExtractUntil<
  T extends string,
  Terminators extends string,
  Depth extends number = 0,
  Acc extends string = ""
> = // ... recursive implementation

// Split by comma (respects parenthesis depth)
type SplitByComma<T extends string> = // ... recursive implementation
```

### 5.3 Multi-Character Operator Handling

The tokenizer must handle multi-character operators from PostgreSQL and MySQL. These are split with spaces during normalization:

```typescript
// Multi-character operators to recognize
type MultiCharOperators =
    // Standard
    | "!="
    | "<>"
    | "<="
    | ">="
    | "||"
    // PostgreSQL JSON
    | "->"
    | "->>"
    | "#>"
    | "#>>"
    // PostgreSQL containment/existence
    | "@>"
    | "<@"
    | "?|"
    | "?&"
    // PostgreSQL full-text
    | "@@"
    | "@@@"
    // PostgreSQL range
    | "-|-"
    // PostgreSQL geometric
    | "<->"
    | "<#>"
    | "<<|"
    | "|>>"
    | "&<"
    | "&>"
    // PostgreSQL regex
    | "~*"
    | "!~"
    | "!~*"
    // MySQL
    | "<=>";

// Normalization splits these with spaces for tokenization
// e.g., "data@>'key'" becomes "data @> 'key'"
type SplitOperators<T extends string> = T extends `${infer L}->>${infer R}`
    ? `${SplitOperators<L>} ->> ${SplitOperators<R>}`
    : T extends `${infer L}->${infer R}`
        ? `${SplitOperators<L>} -> ${SplitOperators<R>}`
    : T extends `${infer L}@>${infer R}`
        ? `${SplitOperators<L>} @> ${SplitOperators<R>}`
    : T extends `${infer L}<@${infer R}`
        ? `${SplitOperators<L>} <@ ${SplitOperators<R>}`
    : T extends `${infer L}@@${infer R}`
        ? `${SplitOperators<L>} @@ ${SplitOperators<R>}`
    // ... more operators
    : T;
```

### 5.4 Database-Specific Keywords

The tokenizer normalizes SQL keywords to uppercase, including database-specific ones:

```typescript
type SQLKeyword =
    // Standard SQL
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "FROM"
    | "WHERE"
    | "JOIN"
    | "ON"
    | "AND"
    | "OR"
    | "NOT"
    | "IN"
    | "IS"
    | "NULL"
    | "ORDER"
    | "BY"
    | "GROUP"
    | "HAVING"
    | "LIMIT"
    | "OFFSET"
    | "UNION"
    | "INTERSECT"
    | "EXCEPT"
    | "ALL"
    | "DISTINCT"
    | "AS"
    | "CASE"
    | "WHEN"
    | "THEN"
    | "ELSE"
    | "END"
    | "TRUE"
    | "FALSE"
    | "BETWEEN"
    | "LIKE"
    | "ILIKE"
    // PostgreSQL-specific
    | "RETURNING"
    | "CONFLICT"
    | "NOTHING"
    | "LATERAL"
    | "TABLESAMPLE"
    | "FILTER"
    | "WITHIN"
    | "OVER"
    | "PARTITION"
    | "WINDOW"
    | "ARRAY"
    | "SIMILAR"
    // MySQL-specific
    | "REGEXP"
    | "RLIKE"
    | "SOUNDS"
    | "IGNORE"
    | "REPLACE"
    | "DUPLICATE"
    | "KEY"
    | "ROLLUP"
    | "FORCE"
    | "USE"
    | "INDEX";
```

---

## 6. Parser Implementation

### 6.1 Parser Operating Modes

The parser is designed to operate in two modes to balance thoroughness with TypeScript performance:

#### Full Mode (Syntax Validation)

Full mode parses all SQL keywords and features to validate query syntax. It builds a complete AST with all clauses properly structured.

**Purpose**: Comprehensive syntax validation\
**Used by**: `ValidateSelectSQL`, `ValidateInsertSQL`, etc. (with full validation enabled)\
**Parses**: All SQL keywords, operators, expressions, and clause structures

```
Full Mode Parsing:
├── WITH clause (CTEs)
├── SELECT columns (with aliases, aggregates, subqueries)
├── FROM clause (tables, derived tables)
├── JOIN clauses (with ON conditions)
├── WHERE clause (full expression parsing)
├── GROUP BY clause
├── HAVING clause
├── ORDER BY clause
├── LIMIT/OFFSET
└── UNION/INTERSECT/EXCEPT
```

#### Fast Mode (Field Extraction)

Fast mode focuses only on extracting field, table, and schema names. It skips detailed expression parsing and operator validation to achieve faster type resolution.

**Purpose**: Type extraction and field name validation\
**Used by**: `QueryResult`, `MatchSelectQuery`, lightweight validators\
**Extracts**: Column names, table names, schema names, aliases

```
Fast Mode Extraction:
├── SELECT columns → extract column/table references only
├── FROM clause → extract table name and alias
├── JOIN clauses → extract table names (skip ON expression details)
├── WHERE clause → extract column references (skip operators/values)
├── GROUP BY → extract column references
├── HAVING → extract column references
└── ORDER BY → extract column references
```

### 6.2 Mode Selection Strategy

```typescript
// QueryResult uses fast mode (lightweight extraction)
type QueryResult<SQL, Schema> = MatchSelectQuery<ParseSelectSQL<SQL>, Schema>;

// ValidateSQL uses full mode by default
type ValidateSQL<SQL, Schema> = ValidateSelectSQL<
    SQL,
    Schema,
    { validateAllFields: true; }
>;

// Users can opt for fast validation
type FastValidation = ValidateSelectSQL<
    SQL,
    Schema,
    { validateAllFields: false; } // Skip WHERE/JOIN expression validation
>;
```

### 6.3 Implementation Pattern for Dual Modes

The parser achieves dual-mode operation through:

1. **Shared Tokenization**: Both modes use the same `NormalizeSQL` and `NextToken` utilities
2. **ParsedCondition for Fast Mode**: WHERE, HAVING, JOIN ON clauses return `ParsedCondition` with extracted column refs instead of full expression trees
3. **Column Reference Extraction**: `ScanTokensForColumnRefs` scans for identifiers without parsing operators

```typescript
// Fast mode: Extract column refs without full expression parsing
type ParseWhereClause<T> = 
    NextToken<T> extends ["WHERE", infer Rest]
        ? ExtractUntil<Rest, WhereTerminators> extends [infer WherePart, infer Remaining]
            // Fast: just extract column references as ParsedCondition
            ? { where: ParsedCondition<ScanTokensForColumnRefs<WherePart>>; rest: Remaining }
            : ...
        : { where: undefined; rest: T };

// ScanTokensForColumnRefs: Identifies column patterns without parsing expressions
type ScanTokensForColumnRefs<T, Acc extends ValidatableColumnRef[]> =
    NextToken<T> extends [infer Token, infer Rest]
        ? ExtractColumnFromToken<Token> extends infer ColRef
            ? ColRef extends ValidatableColumnRef
                ? ScanTokensForColumnRefs<Rest, [...Acc, ColRef]>
                : ScanTokensForColumnRefs<Rest, Acc>
            : ScanTokensForColumnRefs<Rest, Acc>
        : Acc;
```

### 6.4 Query Type Detection

```typescript
type DetectQueryType<T extends string> = NextToken<NormalizeSQL<T>> extends
    [ infer First, infer Rest ]
    ? First extends "WITH" ? DetectQueryTypeAfterWith<Rest> // Look ahead for main query
    : First extends "SELECT" ? "SELECT"
    : First extends "INSERT" ? "INSERT"
    : First extends "UPDATE" ? "UPDATE"
    : First extends "DELETE" ? "DELETE"
    : "UNKNOWN"
    : "UNKNOWN";
```

### 6.5 Main Parser Entry Point

```typescript
type ParseSQL<T extends string> = IsStringLiteral<T> extends false
    ? DynamicQuery // Non-literal strings bypass parsing
    : DetectQueryType<T> extends infer QType
        ? QType extends "SELECT" ? ParseSelectSQL<T>
        : QType extends "INSERT" ? ParseInsertSQL<T>
        : QType extends "UPDATE" ? ParseUpdateSQL<T>
        : QType extends "DELETE" ? ParseDeleteSQL<T>
        : ParseError<"Unknown query type">
    : never;
```

### 6.6 SELECT Parser Flow

```
ParseSelectSQL<T>
    │
    ├── Check for WITH → ParseCTEList → ParseSelectBodyWithCTEs
    │
    └── Check for SELECT → ParseSelectBody
            │
            ├── CheckDistinct → [isDistinct, rest]
            │
            ├── ExtractUntil<"FROM"> → columnsPart
            │
            ├── ParseColumns → columns
            │
            ├── ParseFromClause → { from, rest }
            │
            └── BuildSelectClause
                    │
                    ├── ParseJoins → joins
                    │
                    ├── ParseWhereClause → where
                    │
                    ├── ParseGroupBy → groupBy
                    │
                    ├── ParseHaving → having
                    │
                    ├── ParseOrderBy → orderBy
                    │
                    └── ParseLimitOffset → { limit, offset }
```

### 6.7 Column Parsing

The parser handles various column patterns:

1. **Wildcard**: `*` → returns `"*"`
2. **Table wildcard**: `table.*` → `TableWildcard<table>`
3. **Aggregate**: `COUNT ( * )` → `AggregateExpr<"COUNT", "*", alias>`
4. **Subquery**: `( SELECT ... )` → `SubqueryExpr<...>`
5. **CAST function**: `CAST ( expr AS type )` → `ComplexExpr<[refs], type>` (returns typed)
6. **Function calls**: `length ( name )` → `ComplexExpr<[refs], undefined>` (returns `unknown`)
7. **Complex expression**: JSON ops, `::` casts → `ComplexExpr<refs, castType>`
8. **Simple column**: `table.column AS alias` → `ColumnRef<TableColumnRef, alias>`

### 6.8 Function Call Handling

PostgreSQL functions are parsed as complex expressions. The parser:

1. **Detects function names**: A token followed by `(` is identified as a function name
2. **Extracts column references**: Column arguments inside functions are extracted for validation
3. **Skips function names**: Function names themselves are not treated as column references
4. **Preserves type casts**: `length(name)::int` extracts the `int` cast type

**Result Type Rules**:

- Functions **without type casts** return `unknown`
- Functions **with type casts** return the mapped TypeScript type

```typescript
// No cast → unknown
type R1 = QueryResult<"SELECT length ( name ) AS len FROM users", Schema>;
// { len: unknown }

// With cast → typed
type R2 = QueryResult<"SELECT length ( name )::int AS len FROM users", Schema>;
// { len: number }
```

**Supported Function Patterns**:

- Simple: `length ( name )`
- Multiple args: `concat ( a, b, c )`
- Nested: `upper ( trim ( name ) )`
- With literals: `split_part ( email, '@', 1 )`
- Special syntax: `substring ( name from 1 for 5 )`

**Token Scanning for Functions**:

The `ScanTokensForColumnRefs` type uses `IsFunctionName` to detect and skip function names:

```typescript
type IsFunctionName<Token, Rest> = 
  // Skip SQL keywords
  Token extends "SELECT" | "FROM" | ... ? false
  // Check if next token is opening paren
  : IsSimpleIdentifier<Token> extends true
    ? NextToken<Rest> extends ["(", string] ? true : false
    : false
```

**Excluded from Column Extraction**:

- Function names (e.g., `length`, `concat`)
- String literals (e.g., `'value'`)
- Number literals (e.g., `42`)
- SQL keywords used in functions (e.g., `FOR`, `FROM` in `substring(...from...for...)`)

### 6.9 Three-Part Identifier Parsing

Schema-qualified identifiers are parsed in order:

```typescript
type ParseThreePartIdentifier<T extends string> =
    // "schema"."table"."column"
    T extends `"${infer Schema}"."${infer Table}"."${infer Col}"`
        ? [ Schema, Table, Col ]
        // schema.table.column (unquoted)
        : T extends `${infer S}.${infer T}.${infer C}`
            ? IsSimpleIdentifier<S> extends true
                ? IsSimpleIdentifier<T> extends true
                    ? IsSimpleIdentifier<C> extends true ? [ S, T, C ]
                    : never
                : never
            : never
        // ... other patterns
        : never;
```

---

## 7. Schema Matching

### 7.1 Matching Flow

```
MatchSelectQuery<Query, Schema>
    │
    ├── Check for DynamicQuery → return DynamicQueryResult
    │
    ├── Extract SelectClause from SQLSelectQuery
    │
    └── MatchSelectClause
            │
            ├── BuildTableContextWithCTEs
            │       │
            │       ├── BuildCTEContext → resolve CTEs to virtual tables
            │       │
            │       ├── ResolveTableSource (FROM table)
            │       │       ├── DerivedTableRef → resolve subquery
            │       │       └── TableRef → lookup in schema
            │       │
            │       └── MergeJoinContexts → add JOIN tables
            │
            └── MatchColumns<Columns, Context, Schema>
                    │
                    ├── "*" → ExpandAllColumns<Context>
                    │
                    └── SelectItem[] → MatchColumnList
                            │
                            ├── ColumnRef → ResolveColumnRef
                            ├── AggregateExpr → GetAggregateResultType
                            └── TableWildcard → ResolveTableWildcard
```

### 7.2 Context Building

The matcher builds a "context" mapping table aliases to their column types:

```typescript
// Example: FROM users AS u INNER JOIN orders AS o ON ...
// Context becomes:
{
  u: { id: number; name: string; ... }
  o: { id: number; user_id: number; total: number; ... }
}
```

### 7.3 Column Resolution

```typescript
type ResolveColumnRef<Ref, Context, Schema> = Ref extends
    SubqueryExpr<Query, CastType>
    ? ResolveSubqueryExpr<Query, CastType, Context, Schema>
    : Ref extends ComplexExpr<ColumnRefs, CastType>
        ? ResolveComplexExpr<ColumnRefs, CastType, Context, Schema>
    : Ref extends TableColumnRef<Table, Column, ColSchema>
        ? ResolveTableColumn<Table, Column, ColSchema, Context, Schema>
    : Ref extends UnboundColumnRef<Column>
        ? ResolveUnboundColumn<Column, Context>
    : MatchError<"Invalid column reference">;
```

### 7.4 Result Type Construction

For each SELECT column, the matcher produces an object type:

```typescript
// SELECT u.id, u.name, o.total FROM users AS u JOIN orders AS o ...
// Result:
{
    id: number; // from users.id
    name: string; // from users.name
    total: number; // from orders.total
}
```

---

## 8. Validation

### 8.1 Validation Modes Overview

The library provides **two distinct validation modes** that serve different purposes:

| Mode                  | Purpose                      | Performance | Checks                              |
| --------------------- | ---------------------------- | ----------- | ----------------------------------- |
| **Syntax Validation** | Verify query structure       | Slower      | All SQL syntax, keywords, operators |
| **Field Validation**  | Verify names exist in schema | Faster      | Table, column, schema names only    |

### 8.2 Syntax Validation (Full Mode)

Syntax validation checks that the SQL query is correctly written according to SQL grammar rules. It uses the **Full Mode** parser to analyze all aspects of the query.

**What it checks**:

- SQL keyword ordering (SELECT before FROM, etc.)
- Clause structure (proper JOIN...ON syntax)
- Expression syntax (balanced parentheses, valid operators)
- Query type-specific rules (INSERT column count matches value count)

```typescript
// Syntax errors caught by full validation
type SyntaxError1 = ValidateSQL<"SELECT FROM users", Schema>;
// Error: Missing column list

type SyntaxError2 = ValidateSQL<"SELECT * FROM users WHERE", Schema>;
// Error: Incomplete WHERE clause

type SyntaxError3 = ValidateSQL<"SELECT * users", Schema>;
// Error: Missing FROM keyword
```

### 8.3 Field Validation (Fast Mode)

Field validation checks that all referenced table, column, and schema names actually exist in the provided schema. It uses the **Fast Mode** parser to extract names without full expression parsing.

**What it checks**:

- Table names exist in schema
- Column names exist in referenced tables
- Schema prefixes are valid
- Aliases are properly used

```typescript
// Field errors caught by validation
type FieldError1 = ValidateSQL<"SELECT bad_col FROM users", Schema>;
// Error: Column 'bad_col' not found

type FieldError2 = ValidateSQL<"SELECT * FROM bad_table", Schema>;
// Error: Table 'bad_table' not found

type FieldError3 = ValidateSQL<"SELECT u.bad FROM users AS u", Schema>;
// Error: Column 'bad' not found in 'u'
```

### 8.4 Validation API

```typescript
// Full validation (syntax + fields)
type ValidateSQL<SQL, Schema> = ValidateSelectSQL<SQL, Schema>;

// With options
type ValidateSelectSQL<SQL, Schema, Options?> = ...;

type ValidateSelectOptions = {
    validateAllFields?: boolean;  // default: true
};
```

### 8.5 Comprehensive Validation Flow

```typescript
type ValidateSelectSQL<SQL, Schema, Options?> =
  // Parse the query
  ParseSelectSQL<SQL> extends SQLSelectQuery<infer Q>
    ? // Build table context
      BuildTableContext<...> extends infer Context
        ? Context extends MatchError<string>
          ? Context["message"]
          // Validate SELECT columns
          : ValidateSelectColumns<Columns, Context, Schema> extends infer ColResult
            ? ColResult extends true
              ? // Validate WHERE fields
                ValidateWhereFields<Where, Context, Schema> extends infer WhereResult
                  ? WhereResult extends true
                    ? // Validate JOIN ON fields
                      ValidateJoinFields<Joins, Context, Schema> extends infer JoinResult
                        ? JoinResult extends true
                          ? // Validate ORDER BY, GROUP BY, HAVING...
                            true
                          : JoinResult
                        : never
                    : WhereResult
                  : never
              : ColResult
            : never
          : never
        : never
    : ParseSQL<SQL> extends ParseError<infer E>
      ? E
      : "Unknown error"
```

### 8.6 Field Validation Options

```typescript
type ValidateSelectOptions = {
    validateAllFields?: boolean; // default: true
};

// Disable deep validation for complex queries
type Result = ValidateSelectSQL<
    "SELECT id FROM users WHERE complex_expr...",
    Schema,
    { validateAllFields: false; }
>;
```

---

## 9. Parameter Handling

### 9.1 Parameter Types

```typescript
// Positional parameter ($1, $2, etc.)
type PositionalParam<N extends number = number> = `$${N}`;

// Named parameter (:name, @name)
type NamedParam<Name extends string = string> = `:${Name}` | `@${Name}`;
```

### 9.2 Parameter Extraction

```typescript
// Extract all $N placeholders
type ExtractParams<T extends string> = // Returns ["$1", "$2", ...]

// Get maximum parameter number
type MaxParamNumber<T extends string> = // Returns number

// Count unique parameters
type ParamCount<T extends string> = // Returns number
```

### 9.3 Parameter Validation

```typescript
// Validate parameter count
type ValidateParamCount<SQL, Params extends unknown[]> =
    MaxParamNumber<SQL> extends Params["length"] ? true
        : `Expected ${MaxParamNumber<SQL>} parameters, got ${Params["length"]}`;
```

---

## 10. Public API

### 10.1 Main Types

```typescript
// Parse SQL to AST
type ParseSQL<T extends string> = // Returns SQL*Query AST

// Get query result type
type QueryResult<SQL extends string, Schema extends DatabaseSchema> = // Returns result object type

// Validate query (returns true or error message)
type ValidateSQL<SQL extends string, Schema extends DatabaseSchema> = // Returns true | string

// Query type guard
type ValidQuery<Q extends string, Schema extends DatabaseSchema> = 
  ValidateSelectSQL<Q, Schema> extends true ? Q : `[SQL Error] ${...}`
```

### 10.2 Query-Specific Types

**SELECT**:

```typescript
type ParseSelectSQL<T extends string>
type MatchSelectQuery<Query, Schema>
type QueryResult<SQL, Schema>
type ValidateSelectSQL<SQL, Schema, Options?>
```

**INSERT**:

```typescript
type ParseInsertSQL<T extends string>
type MatchInsertQuery<Query, Schema>
type InsertResult<SQL, Schema>
type InsertInput<SQL, Schema>
type ValidateInsertSQL<SQL, Schema, Options?>
```

**UPDATE**:

```typescript
type ParseUpdateSQL<T extends string>
type MatchUpdateQuery<Query, Schema>
type UpdateResult<SQL, Schema>
type ValidateUpdateSQL<SQL, Schema, Options?>
```

**DELETE**:

```typescript
type ParseDeleteSQL<T extends string>
type MatchDeleteQuery<Query, Schema>
type DeleteResult<SQL, Schema>
type ValidateDeleteSQL<SQL, Schema, Options?>
```

### 10.3 Runtime Function

The only runtime code is a factory function for database integration:

```typescript
export function createSelectFn<Schema extends DatabaseSchema>(
    handler: (sql: string, params?: unknown[]) => unknown,
) {
    return function select<Q extends string>(
        query: ValidQuery<Q, Schema>,
        params?: unknown[],
    ) {
        type Result = QueryResult<Q, Schema>;
        return handler(query, params) as Promise<Result[]>;
    };
}
```

---

## 11. SQL Type Mappings

### 11.1 SQL to TypeScript

```typescript
type MapSQLTypeToTS<T extends string> =
    // String types
    T extends "text" | "varchar" | "char" | "character varying" | "character"
        ? string
        // Integer types
        : T extends
            | "int"
            | "integer"
            | "int4"
            | "int8"
            | "bigint"
            | "smallint"
            | "int2"
            | "serial"
            | "bigserial"
            | "smallserial" ? number
        // Floating point types
        : T extends
            | "float"
            | "float4"
            | "float8"
            | "real"
            | "double precision"
            | "numeric"
            | "decimal" ? number
        // Boolean
        : T extends "bool" | "boolean" ? boolean
        // JSON types
        : T extends "json" | "jsonb" ? object
        // Date/time types
        : T extends
            | "date"
            | "timestamp"
            | "timestamptz"
            | "time"
            | "timetz"
            | "interval" ? string
        // UUID
        : T extends "uuid" ? string
        // Binary
        : T extends "bytea" | "blob" | "binary" | "varbinary" ? Uint8Array
        // PostgreSQL-specific types
        : T extends "inet" | "cidr" | "macaddr" | "macaddr8" ? string
        : T extends
            "point" | "line" | "lseg" | "box" | "path" | "polygon" | "circle"
            ? object // Geometric types as objects
        : T extends "tsvector" | "tsquery" ? string // Full-text search types
        : T extends
            | "int4range"
            | "int8range"
            | "numrange"
            | "tsrange"
            | "tstzrange"
            | "daterange" ? { lower: unknown; upper: unknown; } // Range types
        : T extends "hstore" ? Record<string, string>
        // MySQL-specific types
        : T extends "tinyint" ? number
        : T extends "mediumint" ? number
        : T extends "year" ? number
        : T extends "enum" ? string
        : T extends "set" ? string[]
        : T extends "geometry" | "point" | "linestring" | "polygon" ? object
        // Arrays (PostgreSQL)
        : T extends `${infer ElementType}[]` ? MapSQLTypeToTS<ElementType>[]
        : unknown;
```

### 11.2 PostgreSQL Operator Result Types

```typescript
// JSON operators return types
type JsonOperatorResult<Op extends string> = Op extends "->" ? object // Returns JSON
    : Op extends "->>" ? string // Returns text
    : Op extends "#>" ? object // Returns JSON
    : Op extends "#>>" ? string // Returns text
    : unknown;

// Containment operators return boolean
type ContainmentOperatorResult = boolean; // @>, <@, &&, ?, ?|, ?&

// Full-text search operators return boolean
type FullTextOperatorResult = boolean; // @@, @@@
```

### 11.3 Aggregate Result Types

| Aggregate       | Result Type         |
| --------------- | ------------------- |
| `COUNT(*)`      | `number`            |
| `COUNT(column)` | `number`            |
| `SUM(column)`   | `number`            |
| `AVG(column)`   | `number`            |
| `MIN(column)`   | Same as column type |
| `MAX(column)`   | Same as column type |

### 11.4 Function Result Types

PostgreSQL/MySQL functions return `unknown` by default because their return types cannot be inferred at compile time. Use type casting to specify the expected type.

| Function Pattern        | Result Type | Notes                    |
| ----------------------- | ----------- | ------------------------ |
| `func(args)`            | `unknown`   | No type information      |
| `func(args)::type`      | Mapped type | Use `::` to specify type |
| `CAST ( expr AS type )` | Mapped type | Standard SQL CAST syntax |

**Common Functions and Recommended Casts**:

| Function Category | Examples                                | Typical Cast           |
| ----------------- | --------------------------------------- | ---------------------- |
| String length     | `length()`, `char_length()`             | `::int`                |
| String transform  | `upper()`, `lower()`, `trim()`          | `::text`               |
| String build      | `concat()`, `format()`, `replace()`     | `::text`               |
| String split      | `split_part()`, `substring()`           | `::text`               |
| Date/Time         | `now()`, `current_timestamp`            | `::timestamp`          |
| Date extract      | `date_part()`, `extract()`              | `::int`                |
| Date format       | `to_char()`                             | `::text`               |
| Numeric           | `abs()`, `round()`, `floor()`, `ceil()` | `::numeric`            |
| Coalesce          | `coalesce()`, `nullif()`                | Cast to expected type  |
| Array             | `array_agg()`, `string_agg()`           | `::text[]` or `::text` |
| JSON              | `json_agg()`, `jsonb_agg()`             | `::jsonb`              |

**Example Usage**:

```typescript
// Without cast - returns unknown
type R1 = QueryResult<"SELECT length ( name ) AS len FROM users", Schema>;
// { len: unknown }

// With :: cast - returns number
type R2 = QueryResult<"SELECT length ( name )::int AS len FROM users", Schema>;
// { len: number }

// With CAST() function - returns string
type R3 = QueryResult<
    "SELECT CAST ( id AS text ) AS id_str FROM users",
    Schema
>;
// { id_str: string }

// Multiple functions with casts
type R4 = QueryResult<
    `
  SELECT 
    upper ( name )::text AS name_upper,
    CAST ( id AS varchar ) AS id_str,
    length ( email )::int AS email_len
  FROM users
`,
    Schema
>;
// { name_upper: string; id_str: string; email_len: number }
```

---

## 12. Testing Approach

### 12.1 Type-Level Tests

Tests are compile-time assertions. If the file compiles, tests pass:

```typescript
import type { ParseSQL, SQLSelectQuery } from "../src/index.js";
import type { AssertEqual, RequireTrue } from "./helpers.js";

// Test: SELECT * FROM table parses correctly
type P_SelectAll = ParseSQL<"SELECT * FROM users">;
type _T1 = RequireTrue<AssertExtends<P_SelectAll, SQLSelectQuery>>;

// Test: Column alias is captured
type P_Alias = ParseSQL<"SELECT id AS user_id FROM users">;
type P_Alias_Check = P_Alias extends SQLSelectQuery<infer Q>
    ? Q extends { columns: [ ColumnRef<_, "user_id"> ]; } ? true
    : false
    : false;
type _T2 = RequireTrue<P_Alias_Check>;
```

### 12.2 Test Helpers

```typescript
// Assert types are exactly equal
type AssertEqual<T, U> = [ T ] extends [ U ]
    ? [ U ] extends [ T ] ? true : false
    : false;

// Assert T extends U
type AssertExtends<T, U> = T extends U ? true : false;

// Cause compile error if T is not true
type RequireTrue<T extends true> = T;

// Check for parse/match errors
type AssertIsParseError<T> = T extends { error: true; } ? true : false;
type AssertIsMatchError<T> = T extends { __error: true; } ? true : false;
```

### 12.3 Running Tests

```bash
# TypeScript type checking IS the test runner
npm run test
# or
npm run typecheck
# or
npx tsc --noEmit
```

---

## 13. Build Configuration

### 13.1 package.json

```json
{
    "name": "@kuindji/sql-type-parser",
    "version": "0.2.8",
    "type": "module",
    "sideEffects": false,
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.js",
            "default": "./dist/index.js"
        }
    },
    "files": ["dist", "README.md", "LICENSE"],
    "scripts": {
        "typecheck": "tsc --noEmit",
        "build": "tsc -p tsconfig.build.json",
        "prepublishOnly": "npm run build",
        "test": "tsc --noEmit"
    },
    "devDependencies": {
        "typescript": "^5.0.0"
    },
    "engines": {
        "node": ">=16.0.0"
    }
}
```

### 13.2 tsconfig.json (Development)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "noEmit": true,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
    },
    "include": ["src/**/*.ts", "tests/**/*.ts", "examples/**/*.ts"],
    "exclude": ["node_modules"]
}
```

### 13.3 tsconfig.build.json (Production)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "removeComments": false,
        "preserveConstEnums": true
    },
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules", "dist"]
}
```

---

## 14. Known Limitations

1. **Recursion depth**: Complex queries may hit TypeScript's type instantiation limit (~50 levels)

2. **Quoted identifiers with spaces**: Not supported because tokenizer splits on spaces:
   - ✅ `"user-id"`, `"user_id"`
   - ❌ `"user id"`

3. **Complex WHERE**: Expressions are parsed for column extraction but not fully typed

4. **Subquery depth**: Deeply nested subqueries may exceed recursion limits

5. **Expression arithmetic**: Mathematical expressions aren't evaluated for type

6. **Function return types**: Functions return `unknown` without explicit type casting:
   - ✅ `length(name)::int` → `number`
   - ⚠️ `length(name)` → `unknown`

---

## 15. Extension Guide

### 15.1 Adding a New Query Type

1. Create a new directory: `src/newtype/`
2. Implement required files:
   - `ast.ts` - AST type definitions
   - `parser.ts` - Query parser
   - `matcher.ts` - Schema matching
   - `validator.ts` - Validation logic
   - `index.ts` - Re-exports
3. Add query type to `QueryType` in `common/ast.ts`
4. Add case to `DetectQueryType` and `ParseSQL` in `router.ts`
5. Export types from `index.ts`
6. Add tests in `tests/newtype/`

### 15.2 Adding New SQL Features

1. Update tokenizer if new keywords needed
2. Add AST types in appropriate module
3. Extend parser to handle new syntax
4. Update matcher to resolve new constructs
5. Add validation if needed
6. Write tests

---

## 16. References

### 16.1 Project Documentation

| Document                                               | Description                                |
| ------------------------------------------------------ | ------------------------------------------ |
| [PostgreSQL Reference](./docs/POSTGRESQL_REFERENCE.md) | Complete PostgreSQL SQL language reference |
| [MySQL Reference](./docs/MYSQL_REFERENCE.md)           | Complete MySQL SQL language reference      |

### 16.2 Official Documentation

| Database              | Documentation                                               |
| --------------------- | ----------------------------------------------------------- |
| **PostgreSQL**        |                                                             |
| SQL Language          | https://www.postgresql.org/docs/current/sql.html            |
| SQL Syntax            | https://www.postgresql.org/docs/current/sql-syntax.html     |
| Data Types            | https://www.postgresql.org/docs/current/datatype.html       |
| Functions & Operators | https://www.postgresql.org/docs/current/functions.html      |
| SQL Commands          | https://www.postgresql.org/docs/current/sql-commands.html   |
| **MySQL**             |                                                             |
| SQL Statements        | https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html |
| Functions & Operators | https://dev.mysql.com/doc/refman/8.0/en/functions.html      |
| Data Types            | https://dev.mysql.com/doc/refman/8.0/en/data-types.html     |
| SELECT Statement      | https://dev.mysql.com/doc/refman/8.0/en/select.html         |
| JSON Functions        | https://dev.mysql.com/doc/refman/8.0/en/json-functions.html |

### 16.3 SQL Standards

| Standard         | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| SQL:2023         | Latest ISO/IEC 9075 standard (property graph queries, enhanced JSON)      |
| SQL:2016         | JSON functions, row pattern matching                                      |
| SQL:2011         | Temporal features                                                         |
| SQL-2008 Grammar | https://jakewheat.github.io/sql-overview/sql-2008-foundation-grammar.html |

---

## 17. Credits

- **Inspired by**: [telefrek/sql](https://github.com/telefrek/sql) - TypeScript SQL parsing series
- **Built with**: Claude Opus 4.5

---

_This specification provides the complete blueprint for recreating the sql-type-parser project._
