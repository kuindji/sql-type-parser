# Query Builder Specification (part of sql-type-parser)

**Scope:** This specification covers the implementation of the **SELECT Query Builder** only. INSERT, UPDATE, and DELETE builders are not part of this implementation but are considered in architectural decisions to ensure future compatibility.

## 0. Relevant code to examine in sql-type-parser

- src/common/*.ts
- src/select/*.ts
- examples/schema.ts //Example schemas

## 0.1. Implementation File Structure

**Implementation Note:** The builder implementation is split across two main files:

- **`src/common/builder.ts`**: Contains common/shared components that will be reused across all query builders (SELECT, INSERT, UPDATE, DELETE):
  - `ConditionTreeBuilder` and related types
  - Base `.when()` conditional logic (runtime behavior)
  - Shared utilities for state management
  - Common error handling utilities

- **`src/select/builder.ts`**: Contains SELECT-specific implementation:
  - `SelectQueryBuilder` type/implementation and related types
  - `SelectBuilderState`, `EmptyState`, `ErrorState` type definitions
  - SELECT-specific methods (`.select()`, `.from()`, `.join()`, etc.)
  - SELECT-specific `.when()` type-level behavior (optional columns handling)
  - State-to-AST conversion utilities for SELECT queries
  - SQL string assembly utility (runtime)
  - Type-level state transition logic for SELECT methods

**Test Location:** Tests are organized to match the implementation structure:

- **`tests/common/builder.test.ts`**: Tests for common components:
  - `ConditionTreeBuilder` functionality
  - Base conditional logic (`.when()` runtime behavior)
  - Shared utilities

- **`tests/select/builder.test.ts`**: Tests for SELECT builder:
  - `SelectQueryBuilder` API methods
  - SELECT-specific conditional logic
  - State management and transitions
  - SQL string generation
  - Type inference and validation
  - Complex scenarios (CTEs, subqueries, unions)

## 1. Common Architecture

### 1.1. Design Philosophy

- **Dual-Level Operation:** All builders operate simultaneously on two levels:
  - **Runtime:** Assembles strings into valid SQL queries.
  - **Type-Level:** Constructs a Type AST, verifies validity using the existing `Validator`, and infers the result type using the existing `Matcher` (for Select).
- **Immutability:** The API is immutable. Every method call returns a new instance of the builder with updated state.
- **Fragment-Based:** Unlike the monolithic `parser` which expects a full query, builders accept query fragments (e.g., `.join('LEFT JOIN users ...')`, `.where('id > 5')`).
- **Schema-Driven:** Builders are initialized with a `DatabaseSchema` **type parameter**, which drives all type inference. The schema exists only at the type level and is not passed or used at runtime. There is **no runtime schema parameter** – `Schema` is provided purely as a generic type argument (for example, `createSelectQuery<Schema>()`).

### 1.2. Condition Tree

`ConditionTreeBuilder` allows constructing complex nested conditions (AND/OR groups). It is designed to be reusable across `SELECT`, `UPDATE`, and `DELETE` builders (when implemented in the future), but is part of the SELECT builder implementation. The builder exposes a public, immutable API; its internal state shape is represented by the `ConditionTreeState` type described below.

**Implementation Note:** `ConditionTreeBuilder` and all related types should be implemented in `src/common/builder.ts` since it's designed to be reusable across all query builders.

**Test Location:** Tests for `ConditionTreeBuilder` should be added to `tests/common/builder.test.ts`.

#### Internal Structure

`ConditionTreeBuilder` maintains an internal AST structure that mirrors `WhereExpr` from the common AST:

```typescript
// Type alias to avoid recursive reference issues
type ConditionTreePart = WhereExpr | ConditionTreeState;

interface ConditionTreeState {
    operator: "and" | "or";
    parts: Array<{
        id: string;
        condition: WhereExpr | ConditionTreeState; // Nested trees supported via state, not builder reference
    }>;
}
```

**Implementation Note:** To avoid recursive type references (see Section 1.4), nested condition trees are represented using `ConditionTreeState` rather than `ConditionTreeBuilder` in the type definition. The builder implementation handles conversion between builder instances and state internally. `ConditionTreeState` is an internal implementation detail; the public API always works with `ConditionTreeBuilder` instances.

The AST uses `ParsedCondition` or `UnparsedExpr` from `WhereExpr` to store condition fragments. When converted to SQL, parts are combined with the specified operator (AND/OR).

#### Initialization

```typescript
function createConditionTree(operator: "and" | "or"): ConditionTreeBuilder;
```

#### Methods

- **`add(part: string | ConditionTreeBuilder, id?: string)`**: Adds a condition part. String parts are parsed into `ParsedCondition` AST nodes.
- **`remove(id: string)`**: Removes a condition part by ID.
- **`when(condition: boolean, callback: (b: ConditionTreeBuilder) => ConditionTreeBuilder)`**: Conditional logic.
- **`toString()`**: Returns the compiled, normalized condition string. The entire expression is always wrapped in parentheses, and logical operators between parts are always rendered as uppercase `AND` / `OR`, regardless of the original user input (for example: `"(id > 5 AND name = 'test')"` or `"(age > 18 AND (status = 'active' OR status = 'pending'))"`).

#### Integration

- `ConditionTreeBuilder` maintains an internal AST of condition parts using `WhereExpr` types.
- It is validated only when added to a main query builder (e.g., via `.where()` or `.having()`). The validation context (available tables/columns) comes from the main query builder at that point.
- Validation occurs by extracting column references from `ParsedCondition` nodes and checking them against the builder's current table context.
- If a `ConditionTreeBuilder` references tables not yet in the query builder, validation fails immediately with an error (validation is not deferred).
- A `ConditionTreeBuilder` instance can be reused across multiple builders (it is independent until added to a builder).

### 1.3. Conditional Logic (`.when()`)

All builders support a `.when()` method for conditional query construction.

**Implementation Note:** The base `.when()` runtime behavior (conditional execution logic) should be implemented in `src/common/builder.ts` as it's shared across all builders. SELECT-specific type-level behavior (optional columns handling) should be implemented in `src/select/builder.ts`.

**Test Location:** Base conditional logic tests should be added to `tests/common/builder.test.ts`. SELECT-specific conditional logic tests should be added to `tests/select/builder.test.ts`.

#### Runtime Behavior

- **Runtime:** Conditions are respected - parts only go into the generated SQL query if the condition evaluates to `true`.
  - If condition is `true`: The callback is executed and its modifications are included in the SQL string.
  - If condition is `false`: The callback is not executed, and the builder state remains unchanged for SQL generation.

#### Type-Level Behavior

- **Type Level:** The callback is **always** executed to infer potential types, regardless of the runtime condition value.
  - **All parts go into the AST:** Conditional parts are always added to the builder's AST state (or replace existing parts if an ID is provided and already exists).
  - **ID-based replacement:** If a conditional part provides an ID that already exists in the state, it replaces the existing part (same behavior as non-conditional parts).

- **Select-specific behavior:**
  - Columns selected inside `.when()` are marked with `optional: true` in their `SelectItem` AST nodes.
  - The matcher (`MatchSelectQuery`) handles optional columns by unioning their types with `undefined` (e.g., `string` becomes `string | undefined`).
  - Joins added inside `.when()` make ALL columns from those joined tables optional in the result type. When converting builder state to AST, columns from conditionally joined tables (marked with `optional: true` in join state) must have their corresponding `SelectItem` nodes marked with `optional: true` directly in the AST.
  - **Nested `.when()` calls are NOT supported** - this adds unnecessary complexity and is not needed.
  - Optional columns affect the result type shape: the column exists in the result type but its value type includes `undefined`.
  - From a type perspective, the result type represents a union of all possible query variants. Conditional selects making fields optional (`field?: type | undefined`) correctly represents "this query MAY return this field" and flattens the union logic.

- **Future query types (Insert/Update/Delete - not part of this implementation):**
  - When implemented, conditional logic will mainly affect the generated SQL string.
  - Type safety will ensure that even conditional parts are valid against the schema (they're validated as if they were always included).

#### Example

```typescript
const includeEmail = false; // Runtime condition

const builder = createSelectQuery<Schema>()
    .from("users")
    .select("id")
    .when(includeEmail, b => b.select("email"));

// Runtime: SQL string is "SELECT id FROM users" (email not included)
// Type level: AST includes both "id" and "email" columns
// Result type: { id: number; email?: string | undefined }
```

### 1.4. Implementation Constraints

The builder implementation must adhere to the following constraints:

- **Implementation Style:** The public builder API must be **immutable and chainable** – every method call returns a new builder instance with updated runtime and type-level state. The internal implementation may use factory functions or classes (for example, a class with generic parameters like `<Schema, State>` whose methods return `new Builder<Schema, NewState>(...)`), as long as it preserves the specified behavior and type-level state transitions.
- **Avoid Recursive Referencing:** TypeScript has limitations with recursive type references that can cause performance issues and type inference problems. The implementation must avoid patterns where types reference themselves recursively. For example, `ConditionTreeBuilder` should not contain itself directly in its type definition. Instead, use type aliases, flattened structures, or non-recursive patterns to represent nested structures.
- **Minimize "any" Usage:** The implementation should avoid using the `any` type where possible. Use proper type inference, generics, and type utilities instead. When type information is not fully known, prefer `unknown` over `any`, or use conditional types and type guards to narrow types appropriately.

#### 1.4.1. Implementation Example: Class-Based, Type-Progressive Builder

One valid implementation strategy is a **class-based builder** whose generic parameters encode the current builder state:

```typescript
class SelectQueryBuilderImpl<
    Schema extends DatabaseSchema,
    State extends SelectBuilderState,
> implements SelectQueryBuilder<Schema, State> {
    constructor(private readonly state: State) {}

    select<NewState extends SelectBuilderState>(
        columns: string | string[],
        id?: string,
    ): SelectQueryBuilderImpl<Schema, NewState> {
        // build newState from this.state + columns...
        const newState = {} as NewState;
        return new SelectQueryBuilderImpl<Schema, NewState>(newState);
    }

    // ...other methods (`from`, `join`, etc.) follow the same pattern,
    // always returning a new instance with updated generic `State`.
}
```

This pattern is similar to the generic `ApiConstructor<TableName, V, IsSingle, IsNullable>` builder used in the GraphQL API layer: each method call returns a new instance with updated generic parameters that represent the progressed state, while keeping the runtime API immutable and chainable.

## 2. Select Query Builder

### 2.1. Overview

The `SelectQueryBuilder` constructs `SELECT` statements. It utilizes the Common Architecture and adds specific state and methods for `SELECT` queries.

**Implementation Note:** The `SelectQueryBuilder` implementation, all SELECT-specific types (`SelectBuilderState`, `EmptyState`, `ErrorState`, `JoinStrictness`), and all SELECT-specific methods should be implemented in `src/select/builder.ts`.

**Test Location:** All tests for `SelectQueryBuilder` should be added to `tests/select/builder.test.ts`.

### 2.2. Builder State

The state determines the structure of the query. To support the **ID-based replacement** requirement, the state must track parts by ID while maintaining order where necessary.

#### State Type Definitions

```typescript
// Empty initial state
type EmptyState = {
    select: {};
    from: undefined;
    joins: [];
    where: {};
    groupBy: {};
    having: {};
    orderBy: {};
    limit: undefined;
    offset: undefined;
    ctes: {};
    distinct: false;
    union: undefined;
};

// Error state marker (used when validation fails)
// Matches MatchError structure from src/common/utils.ts for consistency
// Import: import type { MatchError } from "../common/utils.js"
type ErrorState = MatchError<string> & {
    readonly previousState: SelectBuilderState; // Builder-specific: state before the error
};

// Main state interface
interface SelectBuilderState {
    // IDs allow overwriting specific parts (user-provided IDs only)
    select: { [id: string]: SelectItem[]; };
    from: TableSource | undefined;
    // Joins: array preserves order, each element has id for lookup
    joins: Array<{
        id: string;
        ast: JoinClause;
        strictness: JoinStrictness;
        optional: boolean; // true if join was added conditionally
    }>;
    where: { [id: string]: WhereExpr; };
    groupBy: { [id: string]: ColumnRefType[]; };
    having: { [id: string]: WhereExpr; };
    orderBy: { [id: string]: OrderByItem[]; };
    limit: number | undefined;
    offset: number | undefined;
    ctes: { [id: string]: CTEDefinition; };
    distinct: boolean;
    union: UnionClause | undefined; // Union with another query
}
```

#### JoinStrictness Type

`JoinStrictness` represents the strictness level of a join for replacement validation:

```typescript
type JoinStrictness = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";

// Strictness hierarchy: INNER > LEFT = RIGHT > FULL > CROSS
// When replacing a join with the same ID, the new join must have equal or stricter strictness:
// you may tighten a weaker join to a stricter one, but must not loosen a stricter join to a weaker one.
// Example: Can replace LEFT with INNER, but cannot replace INNER with LEFT.
```

The strictness is derived from the `JoinType` in the `JoinClause` AST:

- `"INNER"` → `"INNER"`
- `"LEFT"` or `"LEFT OUTER"` → `"LEFT"`
- `"RIGHT"` or `"RIGHT OUTER"` → `"RIGHT"`
- `"FULL"` or `"FULL OUTER"` → `"FULL"`
- `"CROSS"` → `"CROSS"`

### 2.3. API Specification

#### Initialization

```typescript
function createSelectQuery<Schema extends DatabaseSchema>();
```

**CRITICAL:** The `Schema` type is provided **only** as a generic type parameter for TypeScript type inference. There is **no runtime `schema` parameter** – the builder implementation must **not** depend on any schema value at runtime.

**Implementation Requirements:**

- All schema validation and type inference happens purely at the type level using the `Schema` generic type parameter.
- The schema type (not a runtime value) is used to validate table and column references and to infer the result types of queries.

**Why this matters:** This is a type-only pattern. The schema exists only in TypeScript's type system, not at runtime. The builder uses the schema type to validate queries and infer types, but never accesses the actual schema object.

#### Methods

All methods accept an optional `id` as the last argument (except `from`, `limit`, `offset`, `distinct`). IDs are **user-provided only** - they are required for replacing and removing parts. If no ID is provided, the part cannot be replaced or removed later. IDs are string literal types at the type level (e.g., `"select_1"`, `"join_users"`) to enable type-safe ID tracking.

**ID Management Rules:**

- IDs cannot be empty strings (validation required).
- Duplicate IDs are allowed across different clause types (e.g., same ID for `select` and `join` is fine).
- Removing a non-existent ID is a no-op (no error).
- Removals are clause-specific (e.g., `removeWhere()` only affects WHERE clauses; collisions with other clause types are not relevant).

- **`select(columns: string | string[], id?: string)`**: Adds columns to select. Overwrites if ID exists.
  - The method is designed to handle one field at a time, either as a single field (`string`) or as an array of fields (`string[]`).
  - While passing comma-separated strings like `select("field1, field2")` is technically valid (the parser will handle it), this pattern is **not encouraged**. Prefer using an array: `select(["field1", "field2"])` or multiple calls: `select("field1").select("field2")`.
  - Parses columns using `ParseColumnList` fragment parser (validates SQL syntax).
  - **Validates input immediately:** Checks that column names exist in available tables (semantic validation).
  - If `from()` hasn't been called yet: Returns `ErrorState` (no table context available).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
  - If `select()` is never called, defaults to `SELECT *` when generating SQL.
- **`removeSelect(id: string)`**: Removes selection by ID.
- **`from(source: string | SelectQueryBuilder)`**: Sets the source table/subquery.
  - If string: parsed using `ParseTableRef` fragment parser (validates SQL syntax).
  - If `SelectQueryBuilder`: converts builder to subquery AST (`DerivedTableRef`).
    - Subquery's `toString()` is called when assembling the outer query's SQL string.
    - **If subquery is in `ErrorState`, validation happens immediately** - the outer query enters `ErrorState` on method call (not deferred to `toString()`).
    - Subquery validation: The subquery builder is validated independently, and its result columns become the table columns for the outer query.
    - Subqueries can have their own CTEs, but CTEs from outer query are not accessible in subqueries.
  - **Validates input immediately:** Checks that table name exists in schema (semantic validation).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
  - No ID support. No conditional usage (must always be set).
- **`join(joinDef: string, id?: string)`**: Adds a JOIN clause.
  - Parses using `ParseSingleJoin` fragment parser (validates SQL syntax).
  - Fragment parser creates `UnboundColumnRef` for unqualified columns in ON clauses (no context needed during parsing).
  - **Validates input immediately:** Checks that joined table exists in schema and column references resolve correctly (semantic validation).
  - Column resolution happens during validation using builder's current table context.
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
  - Supports ID-based replacement (with strictness checks - can replace with same or higher strictness, invalid replacement is no-op).
- **`removeJoin(id: string)`**: Removes join by ID.
- **`where(condition: string | ConditionTreeBuilder, id?: string)`**: Adds a WHERE condition (ANDed).
  - String conditions parsed using `ParseWhereClause` fragment parser (validates SQL syntax, extracts column refs as `ParsedCondition`).
  - **Validates input immediately:** Checks that column references in condition exist in available tables (semantic validation).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
  - Multiple WHERE clauses with different IDs are combined with AND.
  - Supports ID overwrite.
- **`removeWhere(id: string)`**: Removes where clause by ID.
- **`groupBy(columns: string, id?: string)`**: Adds GROUP BY columns.
  - Parsed using column reference parser (validates SQL syntax).
  - **Validates input immediately:** Checks that column references exist in available tables (semantic validation).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
- **`removeGroupBy(id: string)`**: Removes group by clause.
- **`having(condition: string | ConditionTreeBuilder, id?: string)`**: Adds HAVING condition.
  - Same parsing and validation as WHERE.
- **`removeHaving(id: string)`**: Removes having clause.
- **`orderBy(ordering: string, id?: string)`**: Adds ORDER BY items.
  - Parsed using `ParseOrderByItems` fragment parser (validates SQL syntax).
  - **Validates input immediately:** Checks that column references exist in available tables (semantic validation).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
- **`removeOrderBy(id: string)`**: Removes order by clause.
- **`limit(limit: number)`**: Sets LIMIT. Overwrites previous value. No ID support.
- **`removeLimit()`**: Removes LIMIT clause. No-op if limit was never set.
- **`offset(offset: number)`**: Sets OFFSET. Overwrites previous value. No ID support.
- **`removeOffset()`**: Removes OFFSET clause. No-op if offset was never set.
- **`distinct(distinct: boolean)`**: Sets DISTINCT flag. Can be called multiple times; each call overwrites the previous value.
- **`with(cte: string, id?: string)`**: Adds a CTE.
  - Parses CTE definition (validates SQL syntax).
  - CTEs are validated in order: each CTE can reference previously defined CTEs and tables from schema.
  - **Validates input immediately:** Checks that CTE query references valid tables/columns (semantic validation).
  - If invalid, returns `ErrorState` and IDE highlights the error at this call site.
  - If a CTE references an undefined CTE (not yet defined), validation fails with an error.
  - CTEs cannot reference themselves (no recursive CTEs supported).
  - CTE column types are inferred from the CTE's SELECT query using `MatchSelectQuery`.
  - CTEs become available as virtual tables in subsequent clauses (FROM, JOINs, WHERE, etc.).
- **`removeWith(id: string)`**: Removes CTE.
- **`union(other: SelectQueryBuilder, operator?: UnionOperatorType)`**: Combines with another query using UNION/INTERSECT/EXCEPT.
  - Stores union information in state's `union` field.
  - If `other` builder is in `ErrorState`, this builder also enters `ErrorState` immediately (validation happens on method call).
  - Builder only validates that column and table names exist in schema (does not validate SQL syntax compatibility).
  - Type compatibility (matching column counts, names) is handled by the matcher, not the builder validator.
  - Result type is union/intersection of both sides (handled by matcher).
  - Default operator is `"UNION"` if not specified.
- **`when(condition: boolean, callback: (b: Builder) => Builder)`**: Conditional execution.
  - **Runtime:** Parts from callback are included in SQL only if condition is `true`.
  - **Type level:** Callback is always executed - all parts go into AST state.
  - Conditional selects get their types unionized with `undefined`.
  - If callback provides an ID that already exists, it replaces the existing part (same as non-conditional replacement).
- **`toString()`**: Returns the compiled SQL string as a branded type that includes the result type.
  - **SQL Generation:** Assembles SQL string from builder state parts (runtime string assembly utility - see Section 4.1.6):
    - If no `select()` called: defaults to `SELECT *` (returns all columns from all tables in the `FROM`/`JOIN` context, following standard SQL semantics).
    - Uses string fragments provided by user as-is (no AST conversion needed).
    - Assembles parts in correct SQL order.
    - Adds keywords like "WHERE", "HAVING", "GROUP BY", etc. where needed.
    - Skips clauses if they're empty (e.g., no WHERE parts = no WHERE clause).
    - Handles CTEs, JOINs, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET, DISTINCT.
    - If `union` is set, combines with union operator.
    - If any subquery builders are used, calls their `toString()` methods.
  - **Type Inference:** Converts state to `SelectClause` AST, then uses existing `MatchSelectClause<SelectClause, Schema>` matcher from `src/select/matcher.ts` to infer result type.
  - Return type: `string & { __type: MatchSelectClause<SelectClause, Schema> }`
  - The branded type allows extracting the result type via `type Result = (typeof builder.toString()).__type` or using `infer` in function parameters.
  - **Runtime behavior:** `toString()` always returns a SQL string at runtime, regardless of whether the builder is in `ErrorState`. The query may be incorrect - that is the user's responsibility.
  - **Type-level behavior:** The branded return type may include `{ __error: true, message: string }` alongside `{ __type: MatchSelectClause<SelectClause, Schema> }` when the builder is in `ErrorState`. This allows type-level error detection while still allowing runtime SQL generation.

### 2.4. Type Inference Flow

1. User calls method (e.g., `.select("id")` or `.when(condition, b => b.select("email"))`).
2. **Per-Method Validation:**
   - Each builder method validates its input immediately when called.
   - **Parses** string fragment -> AST using appropriate fragment parser.
     - Parser validates SQL syntax (e.g., valid identifiers, proper quoting, etc.).
     - If syntax is invalid, parser returns `ParseError<Message>` (from `src/common/utils.ts`).
     - Builder converts `ParseError` to `ErrorState` format (using `MatchError` structure for consistency).
   - Fragment parsers create `UnboundColumnRef` for unqualified columns (no context needed during parsing).
   - Column resolution happens during validation, not during parsing.
   - **Validates** semantic correctness of the method's input:
     - Checks that table names exist in the schema (for `from()`, `join()`, `with()`).
     - Checks that column names exist in their respective tables (for `select()`, `where()`, `groupBy()`, `having()`, `orderBy()`).
     - Checks that column references resolve to valid table-column pairs.
     - Does NOT validate SQL syntax (that's the parser's responsibility).
   - **Error Handling:**
     - If input is invalid -> Returns `SelectQueryBuilder<Schema, ErrorState>` with error details.
     - Invalid inputs cause TypeScript type errors that IDEs will highlight.
     - **Once in `ErrorState`, the builder stops all type-level operations:**
       - No AST updates
       - No validation
       - No type inference
       - All subsequent method calls return the same `ErrorState` (early exit optimization).
     - **Runtime behavior is unchanged:** Builder still maintains state and can generate SQL string (though it may be invalid).
   - **For conditional parts (`.when()`):**
     - Callback is **always** executed at type level, regardless of runtime condition value.
     - All parts from callback are added to AST state (or replace existing parts if ID matches).
     - Conditional selects are marked with `optional: true`.
   - If valid -> Updates `BuilderState` (Type Level) and returns `SelectQueryBuilder<Schema, NewState>`.
3. User calls `.toString()` to get the SQL string with result type.
4. Builder converts state to `SelectClause` AST and uses existing matcher:
   - Converts `SelectBuilderState` to `SelectClause` AST (see State-to-AST Conversion).
   - Uses existing `MatchSelectClause<SelectClause, Schema>` from `src/select/matcher.ts` to infer result type.
   - Returns branded string type: `string & { __type: MatchSelectClause<SelectClause, Schema> }`
   - Optional columns (from conditional selects) have their types unionized with `undefined` by the matcher.
   - Result type can be extracted via `typeof builder.toString().__type`

### 2.5. Dynamic Query Handling

The builder must check for `${string}` template literal holes in all string inputs (fragments passed to methods like `select()`, `from()`, `join()`, `where()`, etc.) using the existing `HasTemplateHoles` type from `src/common/utils.ts`.

**Requirements:**

- All builder methods that accept string inputs must check for `HasTemplateHoles` before parsing
- If a string contains `${string}` patterns, the builder must **strip them out** and continue processing the remaining string
- The `${string}` patterns are removed/ignored as if they didn't exist - we don't know what's in them, so we shouldn't assume they break the query
- The check and stripping must happen **before** fragment parsing to ensure it's not bypassed
- This applies to all string inputs: `select()`, `from()`, `join()`, `where()`, `groupBy()`, `having()`, `orderBy()`, `with()`, and any other methods accepting string fragments
- The builder should **NOT** enter `ErrorState` for dynamic queries - they should be handled gracefully by stripping

**Implementation Note:**

- Use `HasTemplateHoles<T>` from `src/common/utils.ts` to detect template literal holes
- Implement a type-level utility to strip `${string}` patterns from strings (similar to how the parser handles them)
- The stripping should happen at the type level before calling fragment parsers
- After stripping, the remaining string is parsed and validated normally

**Example:**

```typescript
// Input with ${string} should have the dynamic part stripped
const builder = createSelectQuery<Schema>()
    .from(`users ${someDynamicValue}`) // Contains ${string}
    .select("id");
// The "${someDynamicValue}" part is stripped, leaving "users" to be parsed
// Result: FROM users (as if the dynamic part never existed)
```

#### State-to-AST Conversion

**Implementation Note:** State-to-AST conversion utilities should be implemented in `src/select/builder.ts` as they are SELECT-specific.

The builder state is converted to a `SelectClause` AST when needed for validation or type inference:

1. **SELECT columns**: All `select` entries are flattened into a single `SelectItem[]` array. If no `select()` was called, defaults to `"*"`.
2. **FROM**: Direct mapping from `from` field (must be set, otherwise validation error).
3. **JOINs**: `joins` array is converted to `JoinClause[]`, preserving array order.
4. **WHERE**: All `where` entries are combined with AND into a single `WhereExpr` (using `LogicalExpr` if multiple).
5. **GROUP BY**: All `groupBy` entries are flattened into `ColumnRefType[]`.
6. **HAVING**: All `having` entries are combined with AND (same as WHERE).
7. **ORDER BY**: All `orderBy` entries are flattened into `OrderByItem[]`.
8. **CTEs**: All `ctes` entries are converted to `CTEDefinition[]`, preserving insertion order.
9. **UNION**: If `union` is set, wraps `SelectClause` in `UnionClause`.

This conversion happens:

- On each builder method call (for incremental validation)
- When calling `.toString()` (for SQL generation and type inference)

**Note:** Order of SELECT columns doesn't affect type inference or runtime SQL behavior, so no explicit order tracking is needed.

#### Validation Scope

The builder's validation is **semantic only** - it validates correctness against the schema:

- ✅ **Validates:** Table names exist in the schema
- ✅ **Validates:** Column names exist in their tables
- ✅ **Validates:** Column references resolve to valid table-column pairs
- ❌ **Does NOT validate:** SQL syntax (handled by parser)
- ❌ **Does NOT validate:** Expression semantics (operator correctness, type compatibility, etc.)

SQL syntax validation happens during parsing (e.g., `ParseColumnList`, `ParseSingleJoin`). If syntax is invalid, the parser returns `ParseError` and the builder enters `ErrorState` before schema validation occurs.

#### Validation Error Reporting

When validation fails, the builder enters `ErrorState`. The error state must be consistent with error types used across the project:

**Existing Error Types (from `src/common/utils.ts`):**

- `ParseError<Message>`: Used by parser for syntax errors (`{ error: true, message: Message }`)
- `MatchError<Message>`: Used by matcher for type matching errors (`{ readonly __error: true, readonly message: Message }`)
- `ValidationError<Message>`: Alias for `MatchError`, used by validator

**Builder ErrorState:**
The builder's `ErrorState` matches the existing `MatchError` structure from `src/common/utils.ts` for consistency:

```typescript
type ErrorState = MatchError<string> & {
    readonly previousState: SelectBuilderState; // Builder-specific: state before the error
};
```

This ensures consistency with matcher and validator error types while adding builder-specific context.

**Error Consistency Requirements:**

- **Parser errors:** When fragment parsing fails, convert `ParseError` to builder's `ErrorState` format (using `MatchError` structure).
- **Validator errors:** When validation fails, use `MatchError` structure (validator already uses `MatchError` via `ValidationError`).
- **Matcher errors:** When type matching fails (e.g., in `toString()`), use `MatchError` structure (matcher already uses `MatchError`).
- **If updates needed:** If the existing error types (`ParseError`, `MatchError`) need updates to support builder requirements, update them in `src/common/utils.ts` to maintain consistency across the entire project.

- **Per-Method Validation:** Each method validates its input immediately when called.
- **IDE Highlighting:** Invalid inputs cause TypeScript type errors that IDEs will highlight at the call site.
- **Early Exit Optimization:** Once in `ErrorState`, subsequent method calls can skip validation to save TypeScript resources:
  - Methods can return `ErrorState` immediately without parsing or validating new inputs.
  - This prevents cascading type errors and reduces TypeScript compilation time.
  - The first error is preserved and highlighted by the IDE.
- **Error Details:** Error messages are embedded in the type system using template literal types.
- **Error Access:** Users can access error details via type utilities: `ExtractError<BuilderState>`.

## 3. Future Considerations (Insert/Update/Delete Builders)

**Note:** INSERT, UPDATE, and DELETE builders are **NOT part of this implementation**. This section documents architectural considerations to keep in mind when designing the SELECT builder, so that future builders can follow the same patterns.

When INSERT/UPDATE/DELETE builders are implemented in the future, they should follow the **Common Architecture** established by the SELECT builder:

- They will use `ConditionTreeBuilder` for `WHERE` clauses (shared with SELECT).
- They will use the fragment-based approach with IDs for managing clauses (e.g., `SET` clauses in `UPDATE`).
- They will rely on shared parser fragments (`ParseTableRef`, `ParseWhereClause`, etc.).
- **Return Types:** All builders will have return types because queries can include `RETURNING` clauses:
  - **INSERT:** Uses `MatchInsertQuery` from `src/insert/matcher.ts` to infer return type from `RETURNING` clause.
    - If no `RETURNING` clause: returns `void`.
    - If `RETURNING *`: returns full table row type.
    - If `RETURNING columns`: returns object with specified column types.
  - **UPDATE:** Uses `MatchUpdateQuery` from `src/update/matcher.ts` to infer return type from `RETURNING` clause.
    - If no `RETURNING` clause: returns `void`.
    - If `RETURNING *`: returns full table row type (NEW values).
    - If `RETURNING columns`: returns object with specified column types.
    - Supports PostgreSQL 17+ OLD/NEW qualified references.
  - **DELETE:** Uses `MatchDeleteQuery` from `src/delete/matcher.ts` to infer return type from `RETURNING` clause.
    - If no `RETURNING` clause: returns `void`.
    - If `RETURNING *`: returns full table row type.
    - If `RETURNING columns`: returns object with specified column types.
  - All builders' `toString()` methods will return branded string types: `string & { __type: MatchInsertQuery<...> | MatchUpdateQuery<...> | MatchDeleteQuery<...> }`

**Architectural Impact:** When designing the SELECT builder, ensure that:

- Common components (like `ConditionTreeBuilder`) are reusable and not SELECT-specific.
- Parser fragments are designed to work standalone (not just for SELECT).
- State management patterns can be extended to other query types.
- Validation and matching patterns can be applied to other query types.

## 4. Detailed Implementation Requirements (Select)

**Testing Requirement:** Whenever changes are made to core files (`ast.ts`, `parser.ts`, `validator.ts`, `matcher.ts`), run the existing test suite to verify no regressions. These files are foundational to sql-type-parser and must maintain backward compatibility. Tests for the builder MUST cover both **runtime behavior** (exact SQL strings produced, clause ordering, conditional inclusion, etc.) and **type-level behavior** (the branded `__type` result, error-state typing, optional-column inference). **Type-level assertions must be written so that a mismatch causes a compile-time error** (for example, using helpers like `Expect<Equal<Actual, Expected>>` or `expectTypeOf<Actual>().toEqualTypeOf<Expected>()`, not just computing a boolean alias). The final examples in Section 6 are normative and should be mirrored as test cases (or close equivalents) in `tests/select/builder.test.ts` as soon as the corresponding implementation exists.

**Validator Usage:** The builder must use the existing `ValidateSelectSQL` validator from `src/select/validator.ts`. Any updates needed to the validator to support builder use cases should be documented below and implemented as part of Phase 1.

**Matcher Usage:** The builder must use the existing `MatchSelectClause` matcher from `src/select/matcher.ts` to infer result types. The builder converts its state to `SelectClause` AST and passes it to the matcher. Any updates needed to the matcher to support optional columns should be documented below and implemented as part of Phase 1.

**Error State Consistency:** The builder's `ErrorState` must be consistent with error types used across the project (`ParseError`, `MatchError` from `src/common/utils.ts`). If updates are needed to error types to support builder requirements, they should be made in `src/common/utils.ts` to maintain consistency across parser, validator, matcher, and builder. See Section 2.4 for error state structure requirements.

### 4.1. Required Changes to `sql-type-parser`

**Implementation Note:** Changes to parser, validator, matcher, and AST files should be made in their respective existing files (`src/select/parser.ts`, `src/select/validator.ts`, `src/select/matcher.ts`, `src/select/ast.ts`, `src/common/ast.ts`). These are modifications to existing code, not new builder files.

1. **Parser Exports:**
   - Export `ParseColumnList` (already exported)
   - Export `ParseSingleJoin` (already exported)
   - Export `ParseWhereClause` (needs export - currently internal)
   - Export `ParseOrderByItems` (needs export - currently only `ParseOrderByItem` singular is exported)
   - Export `ParseTableRef` (already exported)
   - Export `ValidateSelectClause` (needs export - currently internal type in `src/select/validator.ts`)

2. **Parser Modifications for Partial/Fragment Parsing:**

   The existing parser already supports fragment parsing. No modifications needed for context passing:

   - **Fragment Parsers Work As-Is:** Fragment parsers create `UnboundColumnRef` for unqualified columns (e.g., `"id"` without table name) and `TableColumnRef` for qualified columns (e.g., `"users.id"`).
     - Parsers do NOT need to accept table context - they work standalone.
     - Column resolution happens during validation, not during parsing.

   - **Standalone Fragment Support:** Fragment parsers already work without full query structure:
     - `ParseColumnList` parses `"id, name, email"` without SELECT keyword
     - `ParseSingleJoin` parses `"LEFT JOIN users ON users.id = orders.user_id"` without FROM clause
     - `ParseWhereClause` parses `"id > 5 AND active = true"` (handles WITH or WITHOUT WHERE keyword)
     - `ParseOrderByItems` parses `"id ASC, name DESC"` without ORDER BY keyword

   - **Keyword Normalization:** All full-query and fragment parsers operate on **normalized** SQL strings using the existing `NormalizeSQL<T>` type from `src/common/tokenizer.ts`. `NormalizeSQL<T>`:
     - Removes SQL comments (block and line),
     - Normalizes whitespace and special characters,
     - Uppercases SQL keywords only (such as `SELECT`, `FROM`, `WHERE`, `JOIN`, `AND`, `OR`, `AS`), while preserving identifiers and aliases (especially words that follow `AS`).
       Builder methods that rely on fragment parsers (for `select()`, `from()`, `join()`, `where()`, `groupBy()`, `having()`, `orderBy()`, `with()`, etc.) must respect this behavior at the type level so that validation always sees normalized input consistent with the existing parser and validator.

   - **Error Handling:** Fragment parsers return `ParseError` if syntax is invalid. Builder converts `ParseError` to `ErrorState` format (using `MatchError` structure for consistency). Error messages should include fragment context.

   - **Testing:** Verify each fragment parser works independently without full query context (should already work).

3. **Dynamic Query Detection and Stripping:**
   - The builder must use `HasTemplateHoles` from `src/common/utils.ts` to detect template literal holes in all string inputs
   - Detection happens before fragment parsing to ensure the check is not bypassed
   - If `${string}` patterns are detected, they must be stripped out and ignored before parsing
   - The remaining string (after stripping) is then parsed and validated normally
   - This ensures the builder respects the same dynamic query handling as the parser/validator, but handles it by stripping rather than bypassing validation

4. **AST Modifications:**
   - Add `optional?: boolean` flag directly to `SelectItem` union variants:
     ```typescript
     type SelectItem =
         | (ColumnRef & { optional?: boolean; })
         | (AggregateExpr & { optional?: boolean; })
         | TableWildcard; // Wildcards cannot be optional
     ```
   - **Direct modification approach:** Update existing AST types directly (not using a wrapper).
     - This avoids wrapper performance impact.
     - Other parts of the codebase may need updates to maintain compatibility, but this is preferred over wrapper approach.
   - **Conditional joins handling:** When converting builder state to `SelectClause` AST, columns from conditionally joined tables (where the join has `optional: true` in state) must have their corresponding `SelectItem` nodes marked with `optional: true` directly in the AST. This ensures the matcher can correctly infer optionality by checking the AST directly, without needing to reference builder state.

5. **Validator Modifications (if needed):**
   - The builder uses the existing `ValidateSelectSQL<SQL, Schema>` validator.
   - **Check if `ValidateSelectClause` is exported:** If the internal `ValidateSelectClause` type (that works with AST directly) is not exported, consider:
     - Exporting it for direct AST validation (more efficient than SQL conversion)
     - Or creating a builder-specific wrapper that converts state to SQL and uses `ValidateSelectSQL`
   - **Optional columns handling:** The validator may need updates to handle optional columns from conditional selects:
     - Optional columns should still be validated (they must exist in tables)
     - But validation errors for optional columns might be treated differently (warnings vs errors)
     - This depends on validation requirements - document decision during implementation
   - **Per-method validation mode:** Consider adding a validation option that validates only specific clauses rather than the full query (for performance optimization).

6. **Matcher Modifications:**
   - The builder uses the existing `MatchSelectClause<SelectClause, Schema>` matcher from `src/select/matcher.ts`.
   - **Optional columns support:** The matcher needs to handle optional columns from conditional selects:
     - Modify `MatchSingleColumn` in `matcher.ts` to check for optional flag on `SelectItem`.
     - When `optional: true` is present on a `SelectItem`, union the column type with `undefined`:
       ```typescript
       type MatchSingleColumn<Item, Context, Schema> = Item extends
           { optional: true; } ? MatchColumn<Item, Context, Schema> | undefined
           : MatchColumn<Item, Context, Schema>;
       ```
     - Check for `optional` property directly on `SelectItem` (direct AST modification approach).
   - **Optional columns from conditional joins:** When a join is added conditionally, all columns from that table's context are marked with `optional: true` directly in their `SelectItem` AST nodes during state-to-AST conversion. The matcher handles this by checking the `optional` flag directly on `SelectItem` nodes in the AST (not by checking join state). This ensures the matcher operates purely on AST structure without needing builder state context.
   - **Verify:** Run existing matcher tests to ensure no regressions after modifications.

7. **SQL String Assembly Utility (Runtime):**
   - **Implementation Note:** This utility should be implemented in `src/select/builder.ts` as it's SELECT-specific. It's a runtime-only utility function (not a type-level utility).
   - Implement a runtime utility that assembles SQL string from user-provided fragments.
   - **This is NOT an AST-to-SQL converter** - it's a simple string assembly utility.
   - **No runtime parsing:** Uses string fragments provided by user exactly as-is. AST and parsers exist only at the type level - no parsing happens at runtime. The utility performs pure string concatenation/templating using the exact strings the user provided.
   - Assembles parts in correct SQL order:
     - CTEs (WITH clause) if present
     - SELECT columns (or `SELECT *` if none)
     - FROM clause
     - JOINs (in order)
     - WHERE clause (if any WHERE parts exist)
     - GROUP BY clause (if any GROUP BY parts exist)
     - HAVING clause (if any HAVING parts exist)
     - ORDER BY clause (if any ORDER BY parts exist)
     - LIMIT clause (if set)
     - OFFSET clause (if set)
     - UNION/INTERSECT/EXCEPT (if set)
   - Adds SQL keywords like `SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`, `WITH`, and union operators as needed, and **always renders these builder-inserted keywords in uppercase**. User-provided fragments (table names, column lists, raw conditions, etc.) are used exactly as provided and are not re-cased.
   - Skips clauses if they're empty (e.g., no WHERE parts = no WHERE clause).
   - Handles edge cases: empty arrays, undefined values, subqueries (calls their `toString()` methods).
   - Simple string concatenation/formatting logic - no AST involved.

### 4.2. ID & Join Replacement Logic

**Implementation Note:** `JoinStrictness` type and join replacement logic should be implemented in `src/select/builder.ts` as they are SELECT-specific.

- Implement `JoinStrictness` type as defined in Section 2.2.
- Implement type-level logic to allow replacing a join with same or higher strictness under the same ID:
  ```typescript
  type CanReplaceJoin<
      OldStrictness extends JoinStrictness,
      NewStrictness extends JoinStrictness,
  > = NewStrictness extends OldStrictness ? true
      : OldStrictness extends "INNER"
          ? NewStrictness extends "LEFT" | "RIGHT" | "FULL" | "CROSS" ? false
          : never
      : OldStrictness extends "LEFT" | "RIGHT"
          ? NewStrictness extends "FULL" | "CROSS" ? false : never
      : OldStrictness extends "FULL"
          ? NewStrictness extends "CROSS" ? false : never
      : true;
  ```
- **Replacement Behavior:**
  - A join can be replaced with the **same or a stricter** join type under the same ID. Intuitively: a weaker join (for example, `LEFT`) may be “tightened” to a stricter one (for example, `INNER`), but a stricter join must **not** be loosened to a weaker one (for example, `INNER` must not become `LEFT`).
  - The same rule applies at runtime: attempts to loosen join strictness are treated as no-ops.
  - If a replacement would violate these strictness rules, there is no error – the existing join is simply left unchanged.

### 4.3. Validation

**Implementation Note:** Validation logic that uses the existing validator should be implemented in `src/select/builder.ts`. The builder calls the existing validator from `src/select/validator.ts` - no changes needed to the validator file itself unless specifically mentioned in Section 4.1.

- **Using Existing Validator:**
  - The builder uses the existing `ValidateSelectSQL` validator from `src/select/validator.ts`.
  - **Validation happens on AST level only** - do NOT generate SQL string just to pass to validator.
  - Convert builder state to `SelectClause` AST, then use `ValidateSelectClause` (internal validator that works with AST) directly.
  - If `ValidateSelectClause` is not exported, either export it or create a builder-specific AST-level validator wrapper.
  - This saves significant compute by avoiding SQL string generation during validation.
  - **Validator Updates Needed:**
    - If `ValidateSelectClause` is not exported, either export it or create a builder-specific validator wrapper.
    - The validator may need updates to handle optional columns (from conditional selects) - these should be validated but marked as potentially undefined.
    - Consider adding a validation mode that validates only the current method's input rather than the full query (for performance).

- **Validation Scope:**
  - The builder validates **semantic correctness** against the schema only.
  - SQL syntax validation is handled by the parser (`ParseColumnList`, `ParseSingleJoin`, etc.).
  - The builder uses `ValidateSelectSQL` which checks:
    1. Table names exist in schema
    2. Column names exist in their tables
    3. Column references resolve correctly (unqualified columns resolve to available tables)
    4. JOIN conditions reference valid columns
    5. WHERE/HAVING clauses reference valid columns
    6. GROUP BY columns exist
    7. ORDER BY columns exist

- **Per-Method Validation Strategy:**
  - Each builder method validates its input immediately when called (not the entire query).
  - Validation focuses on the specific input provided to that method:
    - `select("column")` validates that "column" exists in available tables.
    - `from("table")` validates that "table" exists in schema.
    - `join("...")` validates that the joined table exists and column references resolve.
  - **Validation Implementation:**
    - Convert current builder state to `SelectClause` AST (see State-to-AST Conversion).
    - Call `ValidateSelectClause` (AST-level validator) directly - do NOT convert to SQL string.
    - Resolve `UnboundColumnRef` columns against current table context (FROM + JOINs + CTEs) during validation.
    - Extract validation errors and return `ErrorState` if invalid.
  - **Early Exit on Error:**
    - After the first validation error, the builder enters `ErrorState`.
    - Subsequent method calls can skip validation to save TypeScript resources.
    - This prevents cascading type errors and improves IDE performance.
  - **What can be validated per-method:**
    - Column references (check against current table context)
    - Table references (check against schema)
    - JOIN table references
    - Basic column existence in WHERE/HAVING/ORDER BY clauses
  - **Dynamic Query Handling:**
    - Before parsing any string input, check for `HasTemplateHoles`
    - If `${string}` patterns are detected, strip them out before parsing
    - If stripping results in an **empty string** at the type level, the fragment is **skipped entirely** for parsing, validation, and type inference (we cannot know what the dynamic content is, so we treat it as “no fragment provided” in the type system)
    - For non-empty strings after stripping, the remaining string is parsed and validated normally
    - **Runtime behavior:** If a builder method receives an empty string fragment at runtime (whether passed directly or after interpolation), it must treat this as invalid input and fail fast (for example, by throwing an error) rather than silently generating malformed or partial SQL
    - This ensures the builder respects the same dynamic query handling as the parser/validator, but handles it by stripping rather than bypassing validation
    - The builder should NOT bypass this check - it must implement the stripping logic itself
  - **Validation Errors:**
    - If `select()` is called before `from()`: Error (no table context available).
    - If `where()` references columns not in available tables: Error (validation not deferred).
    - If required context is missing: Error (validation is immediate, not deferred).
    - All validation errors are immediate - they cause the builder to enter `ErrorState` right away.
  - **Default Behavior:**
    - If `select()` is never called: Defaults to `SELECT *` when generating SQL in `toString()`. Per SQL standard, `SELECT *` returns all columns from all tables in the `FROM`/`JOIN` context. Conditional joins do not affect this behavior – they simply contribute their tables (and thus columns) when present.
    - If `select()` is called before `from()`: Error (cannot validate columns without table context).
  - **IDE Integration:** Invalid inputs cause TypeScript type errors that IDEs highlight at the call site.
  - **Performance:** Per-method validation provides immediate feedback while avoiding full query validation on each call.

### 4.4. Fragment Parsing Context

**Implementation Note:** Context building and tracking utilities should be implemented in `src/select/builder.ts` as they are SELECT-specific and depend on `SelectBuilderState`.

**Context is AST-based** - it's built from the builder's AST state, not a separate structure.

**Context Structure:**
The builder maintains context by tracking available tables from its AST state. This follows the same pattern used in `BuildTableContext` from `src/select/matcher.ts`:

```typescript
// Context is built from AST state (FROM + JOINs + CTEs)
// Example: { users: { id: number; name: string }, orders: { id: number; user_id: number } }
type TableContext = {
    [alias: string]: { [column: string]: unknown; }; // Column types from schema
};
```

The context tracks:

- Main table (from `FROM` clause) - mapped by table alias
- Joined tables (from `JOIN` clauses) - mapped by join table aliases
- CTE tables (from `WITH` clauses) - mapped by CTE names

**Context Building:**

- Context is built incrementally as `from()`, `join()`, and `with()` are called.
- Each method call updates the AST state, which updates the context.
- Each method returns a new builder instance with updated context.
- If required context is missing (e.g., `select()` called before `from()`), validation produces an error (not deferred).

**Fragment Parser Integration:**

- Fragment parsers do NOT need context - they create `UnboundColumnRef` for unqualified columns.
- Context is used during validation to resolve `UnboundColumnRef` columns against available tables.
- Resolution happens during validation, not during parsing.

## 5. Integration Plan (SELECT Builder Only)

**Implementation Scope:** This plan covers only the SELECT query builder. Future INSERT/UPDATE/DELETE builders will follow similar patterns but are not included in this implementation.

**Important:** On each step of implementation, if any changes are made to `ast.ts`, `parser.ts`, `validator.ts`, or `matcher.ts` files, verify that existing tests still pass. These files are core to the sql-type-parser library and changes must not break backward compatibility.

### Phase 1: Foundation - AST & Parser Updates

**Step 1.1: Export Parser Fragments**

- **File:** `src/select/parser.ts`
- Export `ParseWhereClause` (currently internal)
- Export `ParseOrderByItems` (currently only `ParseOrderByItem` singular is exported)
- **Verify:** Run existing parser tests to ensure no regressions.

**Step 1.2: Add Optional Flag to SelectItem AST**

- **File:** `src/select/ast.ts`
- Add `optional?: boolean` flag directly to `SelectItem` union variants (direct modification approach)
- Update other parts of codebase if needed to maintain compatibility
- **Verify:** Run existing AST tests to ensure no regressions

**Step 1.3: Review Error Type Consistency**

- **Files:** `src/common/utils.ts`, `src/select/builder.ts` (when created)
- Ensure builder's `ErrorState` uses `MatchError` structure from `src/common/utils.ts`
- If error types need updates (e.g., additional fields), update `MatchError`/`ParseError` in `src/common/utils.ts` for project-wide consistency
- Ensure parser errors (`ParseError`) are converted to builder format consistently
- **Verify:** Run existing tests to ensure error type changes don't break existing code

**Step 1.4: Review and Update Validator**

- **File:** `src/select/validator.ts`
- Check if `ValidateSelectClause` is exported (if not, export it or create AST-level validator wrapper)
- Validation happens on AST level only - do NOT convert to SQL string for validation
- Update validator to handle optional columns if needed (optional columns still validated, but marked as potentially undefined)
- Ensure validator error types (`MatchError`/`ValidationError`) are consistent with builder's `ErrorState`
- **Verify:** Run existing validator tests to ensure no regressions

**Step 1.5: Update Matcher for Optional Columns**

- **File:** `src/select/matcher.ts`
- Update `MatchSingleColumn` to handle optional columns (from conditional selects)
- Ensure matcher checks for `optional` flag directly on `SelectItem` AST nodes
- Test that optional columns are unionized with `undefined` in result types
- **Verify:** Run existing matcher tests to ensure no regressions

**Step 1.6: Verify Fragment Parsers Work Standalone**

- Verify fragment parsers work without full query structure (should already work)
- Verify fragment parsers create `UnboundColumnRef` for unqualified columns (no context needed)
- Test each fragment parser independently to confirm
- **Verify:** Run existing parser tests to ensure no regressions

**Step 1.7: Write and Run Phase 1 Tests**

- **Test Location:** Create/update test files as needed for parser, validator, matcher, and AST tests
- Write tests for parser fragment exports (`ParseWhereClause`, `ParseOrderByItems`)
- Write tests for optional flag on `SelectItem` AST nodes
- Write tests for error type consistency (`MatchError` structure)
- Write tests for validator updates (optional columns handling)
- Write tests for matcher updates (optional columns unionized with `undefined`)
- Write tests for fragment parser standalone functionality
- Run all Phase 1 tests and verify no regressions in existing parser/validator/matcher/AST tests

### Phase 2: Type-Level State Management

**Step 2.1: Define Core State Types**

- **File:** `src/select/builder.ts`
- Define `EmptyState` type (matches specification)
- Define `ErrorState` type using `MatchError` from `src/common/utils.ts`
- Define `SelectBuilderState` interface (matches specification)
- Add `optional: boolean` flag to joins array items for conditional join tracking
- Add `union: UnionClause | undefined` field to state for union queries

**Step 2.2: Implement JoinStrictness Type**

- **File:** `src/select/builder.ts`
- Implement `JoinStrictness` type (`"INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"`)
- Implement type-level logic for join replacement validation (`CanReplaceJoin` type)
- Map `JoinType` from AST to `JoinStrictness` for state tracking

**Step 2.3: Implement State Transition Types**

- **File:** `src/select/builder.ts`
- Implement state transition types for each builder method:
  - `select()` transition
  - `from()` transition
  - `join()` transition (with strictness checks)
  - `where()`, `groupBy()`, `having()`, `orderBy()` transitions
  - `limit()`, `offset()`, `distinct()` transitions
  - `with()` transition
  - `union()` transition
  - Remove methods transitions

**Step 2.4: Implement State-to-AST Conversion Utilities**

- **File:** `src/select/builder.ts`
- Implement utilities to convert `SelectBuilderState` to `SelectClause` AST:
  - Convert SELECT columns (flatten all entries, handle default `"*"`)
  - Convert FROM clause
  - Convert JOINs (preserve order, handle optional flag)
  - Convert WHERE/HAVING (combine with AND)
  - Convert GROUP BY/ORDER BY (flatten entries)
  - Convert CTEs (preserve order)
  - Convert UNION if present
- Handle optional columns: mark `SelectItem` nodes with `optional: true` for conditional selects and conditional joins

**Step 2.5: Implement Table Context Tracking**

- **File:** `src/select/builder.ts`
- Implement table context building utilities (following `BuildTableContext` pattern from matcher)
- Context tracks available tables from FROM + JOINs + CTEs
- Context is used for column resolution during validation
- Context is built incrementally as methods are called

**Step 2.6: Write and Run Phase 2 Tests**

- **Test Location:** `tests/select/builder.test.ts` (type-level tests)
- Write type-level tests for state type definitions (`EmptyState`, `ErrorState`, `SelectBuilderState`)
- Write type-level tests for `JoinStrictness` type and `CanReplaceJoin` logic
- Write type-level tests for state transition types (all builder methods)
- Write type-level tests for state-to-AST conversion utilities
- Write type-level tests for table context tracking utilities
- Run all Phase 2 tests and verify type inference correctness

### Phase 3: Runtime Implementation - Core Builder

**Step 3.1: Implement ConditionTreeBuilder**

- **File:** `src/common/builder.ts`
- Implement `ConditionTreeBuilder` as an immutable builder (either a class or a factory function) whose methods return new builder instances rather than mutating existing ones
- Implement `add()`, `remove()`, `when()`, `toString()` methods
- Internal state uses `WhereExpr` types for condition parts

**Step 3.2: Create SelectQueryBuilder Implementation Skeleton**

- **File:** `src/select/builder.ts`
- Create `SelectQueryBuilder` type with generic type parameters `<Schema, State>`
- Implement `createSelectQuery()` factory function that is **generic-only** (no runtime schema parameter); this factory may construct a class-based builder or a plain object-based builder internally
- Ensure the returned builder instance exposes methods that maintain runtime state matching the `SelectBuilderState` type
- Implement basic state management so that methods never mutate an existing builder instance in place, but instead return a new builder instance that reflects the updated state and type-level `State` parameter

**Step 3.3: Implement ID Tracking**

- **File:** `src/select/builder.ts`
- Implement ID tracking system (user-provided IDs only, no automatic generation)
- IDs stored in state maps/arrays as specified
- Support ID-based lookup and replacement
- Handle duplicate IDs across different clause types (allowed)

**Step 3.4: Implement SQL String Assembly Utility**

- **File:** `src/select/builder.ts`
- Create runtime utility function that assembles SQL string from user-provided fragments
- This is NOT an AST-to-SQL converter - it's simple string assembly
- Assembles parts in correct SQL order:
  - CTEs (WITH clause) if present
  - SELECT columns (or `SELECT *` if none)
  - FROM clause
  - JOINs (in order)
  - WHERE clause (if any WHERE parts exist)
  - GROUP BY clause (if any GROUP BY parts exist)
  - HAVING clause (if any HAVING parts exist)
  - ORDER BY clause (if any ORDER BY parts exist)
  - LIMIT clause (if set)
  - OFFSET clause (if set)
  - UNION/INTERSECT/EXCEPT (if set)
- Adds keywords like "WHERE", "HAVING", "GROUP BY", etc. where needed
- Skips clauses if they're empty
- Handles edge cases: empty arrays, undefined values, subqueries (call their `toString()` methods)
- Handles default `SELECT *` when `select()` is never called

**Step 3.5: Implement Basic Methods - Part 1 (select, from, join)**

- **File:** `src/select/builder.ts`
- Implement `select()` method:
  - Parse columns using `ParseColumnList` fragment parser
  - Store in state with optional ID
  - Return new builder instance with updated state
- Implement `from()` method:
  - Parse table reference using `ParseTableRef` fragment parser
  - Handle subquery builders (convert to `DerivedTableRef`)
  - Store in state
  - Return new builder instance
- Implement `join()` method:
  - Parse join using `ParseSingleJoin` fragment parser
  - Check join strictness for replacement validation
  - Store in state with optional ID and strictness
  - Return new builder instance
- Implement `removeSelect()` and `removeJoin()` methods

**Step 3.6: Implement Basic Methods - Part 2 (where, groupBy, having, orderBy)**

- **File:** `src/select/builder.ts`
- Implement `where()` method:
  - Parse condition using `ParseWhereClause` fragment parser
  - Handle `ConditionTreeBuilder` objects
  - Store in state with optional ID
- Implement `groupBy()` method:
  - Parse columns using column reference parser
  - Store in state with optional ID
- Implement `having()` method (same as `where()`)
- Implement `orderBy()` method:
  - Parse using `ParseOrderByItems` fragment parser
  - Store in state with optional ID
- Implement corresponding `remove*()` methods

**Step 3.7: Implement Basic Methods - Part 3 (limit, offset, distinct, with, union)**

- **File:** `src/select/builder.ts`
- Implement `limit()` and `offset()` methods (no ID support)
- Implement `removeLimit()` and `removeOffset()` methods
- Implement `distinct()` method (no ID support)
- Implement `with()` method:
  - Parse CTE definition
  - Store in state with optional ID
  - Handle CTE validation order
- Implement `removeWith()` method
- Implement `union()` method:
  - Handle subquery builders
  - Store union information in state

**Step 3.8: Write and Run Phase 3 Tests**

- **Test Location:** `tests/common/builder.test.ts` and `tests/select/builder.test.ts`
- Write tests for `ConditionTreeBuilder` functionality (`tests/common/builder.test.ts`)
- Write tests for `SelectQueryBuilder` initialization and basic state management
- Write tests for ID tracking system (lookup, replacement, duplicate IDs across clause types)
- Write tests for SQL string assembly utility (all SQL clause ordering, edge cases)
- Write tests for basic methods: `select()`, `from()`, `join()`, `removeSelect()`, `removeJoin()`
- Write tests for basic methods: `where()`, `groupBy()`, `having()`, `orderBy()`, and their `remove*()` methods
- Write tests for basic methods: `limit()`, `offset()`, `distinct()`, `with()`, `union()`, and their `remove*()` methods
- Verify SQL string generation correctness for all implemented methods
- Run all Phase 3 tests

### Phase 4: Validation & Type Inference

**Step 4.0: Implement Dynamic Query Stripping**

- **File:** `src/select/builder.ts`
- Implement checks for `HasTemplateHoles` in all string input methods
- Implement type-level utility to strip `${string}` patterns from strings
- Stripping happens before fragment parsing
- After stripping, continue with normal parsing and validation

**Step 4.1: Implement Per-Method Validation**

- **File:** `src/select/builder.ts`
- Implement validation logic that runs on each method call:
  - Convert current builder state to `SelectClause` AST
  - Call `ValidateSelectClause` (AST-level validator) directly - do NOT convert to SQL string
- Resolve `UnboundColumnRef` columns against current table context during validation
- Extract validation errors and return `ErrorState` if invalid
- Handle early exit: once in `ErrorState`, subsequent methods return same `ErrorState`

**Step 4.2: Implement Result Type Inference**

- **File:** `src/select/builder.ts`
- Implement `toString()` method:
  - Convert builder state to `SelectClause` AST
  - Call `MatchSelectClause<SelectClause, Schema>` from `src/select/matcher.ts` to get result type
- Generate SQL string using string assembly utility
- Return branded string type: `string & { __type: MatchSelectClause<SelectClause, Schema> }`
- Handle error states: branded type may include `{ __error: true, message: string }`

**Step 4.3: Implement Error State Handling**

- **File:** `src/select/builder.ts`
- Implement error message generation and embedding in types
- Ensure error details are accessible via type utilities
- Handle parser errors: convert `ParseError` to builder's `ErrorState` format
- Handle validator errors: use `MatchError` structure consistently

**Step 4.4: Write and Run Phase 4 Tests**

- **Test Location:** `tests/select/builder.test.ts`
- Write tests for dynamic query stripping (`${string}` pattern handling)
- Write tests for per-method validation (immediate validation, error state on invalid input)
- Write tests for early exit optimization (subsequent methods return `ErrorState` after first error)
- Write tests for result type inference (`toString()` branded return type)
- Write type-level tests to verify result types match schema column types
- Write tests for error state handling (parser errors, validator errors, error message extraction)
- Run all Phase 4 tests and verify validation correctness

### Phase 5: Conditional Logic

**Step 5.1: Implement Base .when() Runtime Logic**

- **File:** `src/common/builder.ts`
- Implement base `.when()` runtime behavior:
  - If condition is `true`: execute callback and include modifications in SQL
  - If condition is `false`: skip callback execution, state unchanged for SQL generation
- This is shared logic for all builder types

**Step 5.2: Implement SELECT-Specific .when() Type-Level Logic**

- **File:** `src/select/builder.ts`
- Implement SELECT-specific `.when()` type-level behavior:
  - Callback is **always** executed at type level (regardless of runtime condition)
  - All parts from callback are added to AST state (or replace existing parts if ID matches)
- Conditional selects are marked with `optional: true` in `SelectItem` AST nodes
- Conditional joins make ALL columns from those tables optional
- **Nested `.when()` calls are NOT supported**

**Step 5.3: Write and Run Phase 5 Tests**

- **Test Location:** `tests/common/builder.test.ts` and `tests/select/builder.test.ts`
- Write tests for base `.when()` runtime logic (`tests/common/builder.test.ts`)
- Write tests for SELECT-specific `.when()` type-level behavior (optional columns in AST)
- Write tests for conditional selects (columns marked `optional: true`, types unionized with `undefined`)
- Write tests for conditional joins (all columns from joined tables marked optional)
- Write tests for ID replacement within conditional callbacks
- Write tests verifying nested `.when()` is not supported
- Write type-level tests to verify optional columns have `undefined` in union types
- Run all Phase 5 tests and verify conditional logic correctness (runtime and type-level)

### Phase 6: Comprehensive Testing & Integration

**Step 6.1: Write Integration Tests**

- **Test Location:** `tests/select/builder.test.ts`
- Test complex scenarios: CTEs with multiple definitions, nested CTEs
- Test subqueries: builder as FROM source, subquery validation, subquery error propagation
- Test unions: UNION/INTERSECT/EXCEPT combinations, type compatibility
- Test complex JOIN scenarios: multiple joins, join replacement with strictness checks
- Test multiple WHERE/HAVING clauses with IDs, condition combination
- Test error state propagation through subqueries and unions

**Step 6.2: Write Edge Case Tests**

- **Test Location:** `tests/select/builder.test.ts`
- Test empty clauses (no WHERE, no GROUP BY, etc.)
- Test default `SELECT *` behavior when `select()` is never called
- Test ID-based replacement edge cases (non-existent IDs, duplicate IDs across clause types)
- Test join strictness replacement edge cases (invalid replacements are no-ops)
- Test dynamic query handling edge cases (multiple `${string}` patterns, empty strings after stripping)

**Step 6.3: Write Type-Level Integration Tests**

- **Test Location:** `tests/select/builder.test.ts`
- Use TypeScript type testing utilities (e.g., `expectTypeOf()` or similar)
- Test branded return type extraction (`typeof builder.toString().__type`)
- Test error state type inference (`{ __error: true, message: string }`)
- Test optional columns in complex queries (multiple conditional selects, conditional joins)
- Test result type correctness for all query types (simple, CTEs, subqueries, unions)

**Step 6.4: Final Verification**

- Run full test suite (all phases) to ensure all functionality works together
- Verify no regressions in existing parser, validator, matcher, or AST tests
- Ensure all test requirements from specification are met:
  - SQL Query Assembly: String equality checks verify correct assembly
  - Return Type Correctness: Type-level tests verify correct type inference
- Verify test coverage is comprehensive across all builder functionality

## 6. Final result examples

### Schema

```typescript
interface UserTable {
    id: number;
    uuid: string;
    email: string;
    username: string;
    password_hash: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    role: "admin" | "moderator" | "customer";
    status: "active" | "suspended" | "deleted";
    created_at: string;
    updated_at: string;
    active: boolean;
    age: number;
}
export type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            users: UserTable;
            /** Orders */
            orders: {
                id: number;
                order_number: string;
                user_id: number;
                status:
                    | "pending"
                    | "processing"
                    | "shipped"
                    | "delivered"
                    | "cancelled"
                    | "refunded";
                payment_status: "pending" | "paid" | "failed" | "refunded";
                subtotal: number;
                tax_amount: number;
                shipping_amount: number;
                discount_amount: number;
                total_amount: number;
                currency: string;
                shipping_address_id: number;
                billing_address_id: number;
                notes: string | null;
                created_at: Timestamp;
                updated_at: Timestamp;
                shipped_at: Timestamp | null;
                delivered_at: Timestamp | null;
            };
        };
    };
};
```

### Basic Usage

```typescript
const builder = createSelectQuery<Schema>()
    .from("users")
    .select(["id", "name"])
    .where("active = true", "active_filter")
    .limit(10);

const sql = builder.toString();
// Runtime assertion (test), e.g.:
// expect(sql).toBe("SELECT id, name FROM users WHERE active = true LIMIT 10");

// Extract result type using branded string type
type Result = (typeof sql).__type;
// Type-level assertion (test, must fail to compile if incorrect), e.g.:
// type _check = Expect<Equal<Result, { id: number; name: string }>>;

// Or use 'infer' when passing to a function:
function processQuery<T extends string & { __type: unknown }>(sql: T) {
    type Result = T['__type'];
    // ...
}
```

### Conditional Logic

```typescript
const includeEmail = false; // Runtime condition
const joinOrders = true; // Runtime condition

const builder = createSelectQuery<Schema>()
    .from("users")
    .select("users.id")
    .when(includeEmail, b => b.select("email"))
    .when(
        joinOrders,
        b => b.join("LEFT JOIN orders ON orders.user_id = users.id"),
    )
    .when(
        joinOrders,
        b => b.select(`orders.id as "orderId"`)
    );

const sql = builder.toString();
// Runtime assertion (test), e.g.:
// expect(sql).toBe(
//   `SELECT users.id, orders.id as "orderId" FROM users LEFT JOIN orders ON orders.user_id = users.id`,
// );

// Runtime SQL (includeEmail=false, joinOrders=true):
// Note: email is NOT in SQL because includeEmail=false

type Result = (typeof sql).__type;
// Type-level assertion (test, must fail to compile if incorrect), e.g.:
// type _check = Expect<
//   Equal<
//     Result,
//     { id: number; email: string | undefined; orderId: number | null | undefined }
//   >
// >;

// Type level AST: Includes ALL parts regardless of runtime conditions
// - "id" column (always selected)
// - "email" column (from conditional, marked optional)
// - orders join (from conditional, makes orders columns optional)
// - orders join (left join, makes orders columns nullable)

// Note: email is optional (undefined union) even though it's not in runtime SQL
```

### CTEs and Subqueries

```typescript
const builder = createSelectQuery<Schema>()
    .with("active_users AS (SELECT * FROM users WHERE active = true)", "cte1")
    .from("active_users AS au")
    .select(["au.id", "au.name"])
    .where("au.created_at > NOW() - INTERVAL '30 days'");

const sql = builder.toString();
// Runtime assertion (test), e.g.:
// expect(sql).toBe(
//   "WITH active_users AS (SELECT * FROM users WHERE active = true) " +
//   "SELECT au.id, au.name FROM active_users AS au " +
//   "WHERE au.created_at > NOW() - INTERVAL '30 days'",
// );
type Result = (typeof sql).__type;
// Type-level assertion (test, must fail to compile if incorrect), e.g.:
// type _check = Expect<Equal<Result, { id: number; name: string }>>;
```

### ID-based Replacement

```typescript
let builder = createSelectQuery<Schema>()
    .from("users")
    .select([ "id", "name" ])
    .join("INNER JOIN orders ON orders.user_id = users.id", "orders_join");

// Later, replace the join (must be same or stricter join type)
builder = builder.join(
    "LEFT JOIN orders ON orders.user_id = users.id",
    "orders_join",
);
// Type doesn't change: Cannot replace INNER join with LEFT join (looser strictness)
// Runtime: If replacement violates strictness rules, it's a no-op (join not replaced)

builder = builder.join(
    "INNER JOIN orders ON orders.user_id = users.id and orders.id > 10",
    "orders_join",
);
// Type and runtime are updated.
const sql = builder.toString();
// Runtime assertion (test), e.g.:
// expect(sql).toBe(
//   "SELECT id, name FROM users INNER JOIN orders ON " +
//   "orders.user_id = users.id and orders.id > 10",
// );
```

### ConditionTree

```typescript
const conditions = createConditionTree("and")
    .add("age > 18", "age_check")
    .add("status = 'active'", "status_check");

const builder = createSelectQuery<Schema>()
    .from("users")
    .select("*")
    .where(conditions);

const sql = builder.toString();
// Runtime assertion (test), e.g.:
// expect(sql).toBe("SELECT * FROM users WHERE (age > 18 AND status = 'active')");
type Result = (typeof sql).__type;
// Type-level assertion (test, must fail to compile if incorrect), e.g.:
// type _check = Expect<Equal<Result, UserTable>>;
```
