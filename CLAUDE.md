# CLAUDE.md - Project Context for AI Assistants

## Project Overview

`@kuindji/sql-type-parser` is a **type-level SQL parser** for TypeScript. It transforms SQL query string literals into AST types **at compile time**, enabling:

- Zero-runtime SQL parsing (pure type-level)
- Type-safe result inference from queries
- Compile-time query validation
- Support for SELECT, INSERT, UPDATE, DELETE queries

## Quick Commands

**Important:** This project uses **Bun** as the runtime. Always use `bun run` for running scripts.

```bash
# Type-check (validates all types compile correctly)
bun run typecheck

# Run tests (type-check + bun test)
bun run test

# Build for distribution
bun run build
```

## Project Structure

```
sql-type-parser/
├── src/                    # Source code
│   ├── index.ts            # Main entry point, re-exports all public types
│   ├── router.ts           # Query type detection & routing to parsers
│   ├── db.ts               # Runtime helpers (createSelectFn)
│   ├── common/             # Shared utilities across query types
│   │   ├── ast.ts          # Common AST node types
│   │   ├── tokenizer.ts    # SQL tokenization & normalization
│   │   ├── utils.ts        # Utility types (Trim, ParseError, etc.)
│   │   ├── schema.ts       # DatabaseSchema type definitions
│   │   └── builder.ts      # Common builder utilities
│   ├── select/             # SELECT query support
│   │   ├── ast.ts          # SELECT-specific AST types
│   │   ├── parser.ts       # SELECT parser (SQL → AST)
│   │   ├── matcher.ts      # Schema matcher (AST → result type)
│   │   ├── validator.ts    # Comprehensive validation
│   │   └── builder.ts      # Query builder (type-safe construction)
│   ├── insert/             # INSERT query support (same pattern)
│   ├── update/             # UPDATE query support (same pattern)
│   └── delete/             # DELETE query support (same pattern)
├── tests/                  # Type-level tests
│   ├── helpers.ts          # Test assertion utilities
│   ├── index.ts            # Test exports (compilation = tests pass)
│   └── [query-type]/       # Tests mirroring src/ structure
└── examples/               # Usage examples
```

## Architecture

### Module Pattern

Each query type (SELECT, INSERT, UPDATE, DELETE) follows the same structure:

| File           | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `ast.ts`       | Query-specific AST node type definitions               |
| `parser.ts`    | Parses normalized SQL string → AST type                |
| `matcher.ts`   | Matches AST against schema → result row type           |
| `validator.ts` | Deep validation (column existence, type compatibility) |
| `index.ts`     | Re-exports for the module                              |

### Data Flow

```
SQL String → NormalizeSQL → ParseSQL → AST Type
                                         ↓
Schema + AST → MatchQuery → Result Row Type
                                         ↓
Schema + AST → ValidateSQL → true | Error Message
```

### Key Types

```typescript
// Main entry points
type ParseSQL<T extends string>          // Parse any SQL → AST
type QueryResult<SQL, Schema>            // SELECT result type
type InsertResult<SQL, Schema>           // INSERT RETURNING result
type UpdateResult<SQL, Schema>           // UPDATE RETURNING result
type DeleteResult<SQL, Schema>           // DELETE RETURNING result
type ValidateSQL<SQL, Schema>            // true | error message

// Schema definition
type DatabaseSchema = {
    defaultSchema: string;
    schemas: {
        [schemaName: string]: {
            [tableName: string]: {
                [columnName: string]: ColumnType;
            };
        };
    };
};
```

## Testing Philosophy

Tests are **compile-time assertions**. If the test file compiles, tests pass.

### Test Helpers (`tests/helpers.ts`)

```typescript
// Equality
AssertEqual<T, U>           // T and U must be identical
AssertNotEqual<T, U>        // T and U must differ

// Extension
AssertExtends<T, U>         // T must extend U
AssertNotExtends<T, U>      // T must NOT extend U

// Error detection
AssertIsParseError<T>       // T is ParseError<...>
AssertIsMatchError<T>       // T is MatchError<...>

// Enforcement (causes compile error if false)
RequireTrue<T extends true> // Enforces T is true
```

### Test Pattern

```typescript
// 1. Execute the type operation
type Result = ParseSQL<"SELECT id FROM users">;

// 2. Assert the expected shape
type _Test = RequireTrue<AssertExtends<Result, SQLSelectQuery>>;

// 3. If this compiles, the test passes
export type ParserTestsPass = true;
```

### Running Tests

```bash
# Full test suite (type-check + runtime tests)
bun run test

# Type-check only (faster, validates all type tests)
bun run typecheck
```

## Code Conventions

### Type Naming

- `Parse*` - Parser types (string → AST)
- `Match*` - Matcher types (AST + Schema → result)
- `Validate*` - Validator types (→ true | error)
- `SQL*Query` - Top-level query wrapper types
- `*Clause` - SQL clause representations
- `*Ref` - Reference types (column, table)
- `*Expr` - Expression types

### Error Types

```typescript
// Parse errors (during SQL parsing)
type ParseError<Msg extends string> = { error: true; message: Msg; };

// Match errors (during schema matching)
type MatchError<Msg extends string> = { __error: true; message: Msg; };
```

### Performance Considerations

- Each query type has its own execution tree to avoid TypeScript recursion limits
- Complex conditional types are split across multiple helper types
- The tokenizer normalizes SQL in a single pass to reduce recursion depth
- Validators are separate from matchers to allow different performance tradeoffs

## Adding a New Query Type

1. Create directory: `src/[query-type]/`
2. Implement: `ast.ts`, `parser.ts`, `matcher.ts`, `validator.ts`, `index.ts`
3. Add to `router.ts`: detection logic in `DetectQueryType`, case in `ParseSQL`
4. Add to `common/ast.ts`: new `QueryType` union member
5. Export from `src/index.ts`
6. Create tests in `tests/[query-type]/`

## Key Implementation Details

### Tokenizer (`src/common/tokenizer.ts`)

- `NormalizeSQL<T>` - Main normalization pipeline
- Handles: comments, whitespace, special chars, keyword uppercasing
- Preserves aliases after AS keyword (context-aware normalization)

### Router (`src/router.ts`)

- `DetectQueryType<T>` - Identifies SELECT/INSERT/UPDATE/DELETE
- `ParseSQL<T>` - Routes to appropriate parser
- Handles WITH (CTE) queries by scanning past CTEs

### Schema Matching

- Resolves table aliases and joins
- Handles wildcards (`*`, `table.*`)
- Infers aggregate function return types
- Supports PostgreSQL-specific features (JSON ops, type casts)

## Common Patterns

### Recursive Type with Accumulator

```typescript
type ProcessTokens<
    T extends string,
    Acc extends string = "",
> = T extends `${infer Token} ${infer Rest}`
    ? ProcessTokens<Rest, `${Acc} ${Token}`>
    : Acc;
```

### Conditional Type with Error Handling

```typescript
type SafeMatch<T, Schema> = T extends ParseError<infer Msg> ? ParseError<Msg>
    : MatchQuery<T, Schema> extends infer R
        ? R extends MatchError<infer Msg> ? MatchError<Msg>
        : R
    : never;
```

### Type Guard Patterns

```typescript
type IsParseError<T> = T extends { error: true; message: string; } ? true
    : false;
type IsMatchError<T> = T extends { __error: true; message: string; } ? true
    : false;
```

## Debugging Tips

1. **Type too complex?** Split into smaller helper types
2. **Infinite recursion?** Check base cases, add depth counters
3. **Unexpected result?** Use intermediate type aliases to inspect each step
4. **IDE slow?** Reduce type complexity or add type narrowing

## Dependencies

- **TypeScript ^5.0.0** - Required for advanced type features
- **@types/bun** - Bun runtime types (dev)
- No runtime dependencies (pure type-level library)
