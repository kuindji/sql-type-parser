# Query Builder Specification (part of sql-type-parser)

**Scope:** This specification covers the implementation of the **SELECT Query Builder** only. INSERT, UPDATE, and DELETE builders are not part of this implementation but are considered in architectural decisions to ensure future compatibility.

## 0. Relevant code to examine in sql-type-parser

- src/select/ast.ts
- src/select/parser.ts
- src/select/validator.ts
- src/select/matcher.ts

## 1. Common Architecture

### 1.1. Design Philosophy

- **Dual-Level Operation:** All builders operate simultaneously on two levels:
  - **Runtime:** Assembles strings into valid SQL queries.
  - **Type-Level:** Constructs a Type AST, verifies validity using the existing `Validator`, and infers the result type using the existing `Matcher` (for Select).
- **Immutability:** The API is immutable. Every method call returns a new instance of the builder with updated state.
- **Fragment-Based:** Unlike the monolithic `parser` which expects a full query, builders accept query fragments (e.g., `.join('LEFT JOIN users ...')`, `.where('id > 5')`).
- **Schema-Driven:** Builders are initialized with a `DatabaseSchema`, which drives all type inference.

### 1.2. Condition Tree

A `ConditionTree` allows constructing complex nested conditions (AND/OR groups). It is designed to be reusable across `SELECT`, `UPDATE`, and `DELETE` builders (when implemented in the future), but is part of the SELECT builder implementation.

#### Internal Structure

`ConditionTreeBuilder` maintains an internal AST structure that mirrors `WhereExpr` from the common AST:

```typescript
interface ConditionTreeState {
    operator: "and" | "or";
    parts: Array<{
        id: string;
        condition: WhereExpr | ConditionTreeBuilder; // Nested trees supported
    }>;
}
```

The AST uses `ParsedCondition` or `UnparsedExpr` from `WhereExpr` to store condition fragments. When converted to SQL, parts are combined with the specified operator (AND/OR).

#### Initialization

```typescript
function createConditionTree(operator: "and" | "or"): ConditionTreeBuilder;
```

#### Methods

- **`add(part: string | ConditionTreeBuilder, id?: string)`**: Adds a condition part. String parts are parsed into `ParsedCondition` AST nodes.
- **`remove(id: string)`**: Removes a condition part by ID.
- **`when(condition: boolean, callback: (b: ConditionTreeBuilder) => ConditionTreeBuilder)`**: Conditional logic.
- **`toString()`**: Returns the compiled condition string (e.g., `"(id > 5 AND name = 'test')"`).

#### Integration

- `ConditionTreeBuilder` maintains an internal AST of condition parts using `WhereExpr` types.
- It is validated only when added to a main query builder (e.g., via `.where()` or `.having()`). The validation context (available tables/columns) comes from the main query builder at that point.
- Validation occurs by extracting column references from `ParsedCondition` nodes and checking them against the builder's current table context.
- If a `ConditionTree` references tables not yet in the query builder, validation fails immediately with an error (validation is not deferred).
- `ConditionTree` can be reused across multiple builders (it's independent until added to a builder).

### 1.3. Conditional Logic (`.when()`)

All builders support a `.when()` method for conditional query construction.

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

const builder = createSelectQuery(schema)
    .select("id")
    .from("users")
    .when(includeEmail, b => b.select("email", "email_select"));

// Runtime: SQL string is "SELECT id FROM users" (email not included)
// Type level: AST includes both "id" and "email" columns
// Result type: { id: number; email?: string | undefined }[]
```

## 2. Select Query Builder

### 2.1. Overview

The `SelectQueryBuilder` constructs `SELECT` statements. It utilizes the Common Architecture and adds specific state and methods for `SELECT` queries.

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
// When replacing a join with the same ID, the new join must have equal or greater strictness
// Example: Can replace INNER with INNER or LEFT WITH INNER, but cannot replace INNER with LEFT
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
function createSelectQuery<Schema extends DatabaseSchema>(
    schema: Schema,
): SelectQueryBuilder<Schema, EmptyState>;
```

#### Methods

All methods accept an optional `id` as the last argument (except `from`, `limit`, `offset`, `distinct`). IDs are **user-provided only** - they are required for replacing and removing parts. If no ID is provided, the part cannot be replaced or removed later. IDs are string literal types at the type level (e.g., `"select_1"`, `"join_users"`) to enable type-safe ID tracking.

**ID Management Rules:**

- IDs cannot be empty strings (validation required).
- Duplicate IDs are allowed across different clause types (e.g., same ID for `select` and `join` is fine).
- Removing a non-existent ID is a no-op (no error).
- Removals are clause-specific (e.g., `removeWhere()` only affects WHERE clauses; collisions with other clause types are not relevant).

- **`select(columns: string | string[], id?: string)`**: Adds columns to select. Overwrites if ID exists.
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
- **`where(condition: string | ConditionTree, id?: string)`**: Adds a WHERE condition (ANDed).
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
- **`having(condition: string | ConditionTree, id?: string)`**: Adds HAVING condition.
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
    - If no `select()` called: defaults to `SELECT *` (returns all columns from FROM table per SQL specification).
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

#### State-to-AST Conversion

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

- They will use `ConditionTree` for `WHERE` clauses (shared with SELECT).
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

- Common components (like `ConditionTree`) are reusable and not SELECT-specific.
- Parser fragments are designed to work standalone (not just for SELECT).
- State management patterns can be extended to other query types.
- Validation and matching patterns can be applied to other query types.

## 4. Detailed Implementation Requirements (Select)

**Testing Requirement:** Whenever changes are made to core files (`ast.ts`, `parser.ts`, `validator.ts`, `matcher.ts`), run the existing test suite to verify no regressions. These files are foundational to sql-type-parser and must maintain backward compatibility.

**Validator Usage:** The builder must use the existing `ValidateSelectSQL` validator from `src/select/validator.ts`. Any updates needed to the validator to support builder use cases should be documented below and implemented as part of Phase 1.

**Matcher Usage:** The builder must use the existing `MatchSelectClause` matcher from `src/select/matcher.ts` to infer result types. The builder converts its state to `SelectClause` AST and passes it to the matcher. Any updates needed to the matcher to support optional columns should be documented below and implemented as part of Phase 1.

**Error State Consistency:** The builder's `ErrorState` must be consistent with error types used across the project (`ParseError`, `MatchError` from `src/common/utils.ts`). If updates are needed to error types to support builder requirements, they should be made in `src/common/utils.ts` to maintain consistency across parser, validator, matcher, and builder. See Section 2.4 for error state structure requirements.

### 4.1. Required Changes to `sql-type-parser`

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

   - **Error Handling:** Fragment parsers return `ParseError` if syntax is invalid. Builder converts `ParseError` to `ErrorState` format (using `MatchError` structure for consistency). Error messages should include fragment context.

   - **Testing:** Verify each fragment parser works independently without full query context (should already work).

3. **AST Modifications:**
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

4. **Validator Modifications (if needed):**
   - The builder uses the existing `ValidateSelectSQL<SQL, Schema>` validator.
   - **Check if `ValidateSelectClause` is exported:** If the internal `ValidateSelectClause` type (that works with AST directly) is not exported, consider:
     - Exporting it for direct AST validation (more efficient than SQL conversion)
     - Or creating a builder-specific wrapper that converts state to SQL and uses `ValidateSelectSQL`
   - **Optional columns handling:** The validator may need updates to handle optional columns from conditional selects:
     - Optional columns should still be validated (they must exist in tables)
     - But validation errors for optional columns might be treated differently (warnings vs errors)
     - This depends on validation requirements - document decision during implementation
   - **Per-method validation mode:** Consider adding a validation option that validates only specific clauses rather than the full query (for performance optimization).

5. **Matcher Modifications:**
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

6. **SQL String Assembly Utility (Runtime):**
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
   - Adds keywords like "WHERE", "HAVING", "GROUP BY", etc. where needed.
   - Skips clauses if they're empty (e.g., no WHERE parts = no WHERE clause).
   - Handles edge cases: empty arrays, undefined values, subqueries (calls their `toString()` methods).
   - Simple string concatenation/formatting logic - no AST involved.

### 4.2. ID & Join Replacement Logic

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
  - Join can be replaced with same level of strictness OR higher level (stricter).
  - Same behavior on runtime level.
  - If replacement would violate strictness rules: no error, just no-op (join not replaced).

### 4.3. Validation

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
  - **Validation Errors:**
    - If `select()` is called before `from()`: Error (no table context available).
    - If `where()` references columns not in available tables: Error (validation not deferred).
    - If required context is missing: Error (validation is immediate, not deferred).
    - All validation errors are immediate - they cause the builder to enter `ErrorState` right away.
  - **Default Behavior:**
    - If `select()` is never called: Defaults to `SELECT *` when generating SQL in `toString()`. Per SQL specification, `SELECT *` returns all columns from the FROM table only (not joined tables). Conditional joins do not affect this behavior.
    - If `select()` is called before `from()`: Error (cannot validate columns without table context).
  - **IDE Integration:** Invalid inputs cause TypeScript type errors that IDEs highlight at the call site.
  - **Performance:** Per-method validation provides immediate feedback while avoiding full query validation on each call.

### 4.4. Fragment Parsing Context

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

1. **Phase 1: AST & Parser Updates**
   - Export missing parser fragments (`ParseWhereClause`, `ParseOrderByItems`).
   - **Verify fragment parsers work standalone:**
     - Fragment parsers already work without full query structure (no modifications needed).
     - Fragment parsers create `UnboundColumnRef` for unqualified columns (no context needed).
     - Test each fragment parser independently to confirm.
     - **Verify:** Run existing parser tests to ensure no regressions.
   - Add `optional?: boolean` flag directly to `SelectItem` AST types (direct modification approach).
     - Update other parts of codebase if needed to maintain compatibility.
     - **Verify:** Run existing AST tests to ensure no regressions.
   - **Review and update validator (if needed):**
     - Check if `ValidateSelectClause` is exported (if not, export it or create AST-level validator wrapper).
     - Validation happens on AST level only - do NOT convert to SQL string for validation.
     - Update validator to handle optional columns if needed (optional columns still validated, but marked as potentially undefined).
     - Ensure validator error types (`MatchError`/`ValidationError`) are consistent with builder's `ErrorState`.
     - **Verify:** Run existing validator tests to ensure no regressions.
   - **Review error type consistency:**
     - Ensure builder's `ErrorState` uses `MatchError` structure from `src/common/utils.ts`.
     - If error types need updates (e.g., additional fields), update `MatchError`/`ParseError` in `src/common/utils.ts` for project-wide consistency.
     - Ensure parser errors (`ParseError`) are converted to builder format consistently.
     - **Verify:** Run existing tests to ensure error type changes don't break existing code.
   - **Review and update matcher:**
     - Update `MatchSingleColumn` in `matcher.ts` to handle optional columns (from conditional selects).
     - Ensure matcher can handle optional flag on `SelectItem` (or wrapper type).
     - Test that optional columns are unionized with `undefined` in result types.
     - **Verify:** Run existing matcher tests to ensure no regressions.
   - Verify fragment parsers work independently (no context needed).

2. **Phase 2: Type-Level State Management**
   - Define `EmptyState`, `ErrorState` (using `MatchError` from `src/common/utils.ts`), and `SelectBuilderState` types.
   - Add `optional: boolean` flag to joins array items for conditional join tracking.
   - Add `union: UnionClause | undefined` field to state for union queries.
   - Implement `JoinStrictness` type and replacement validation logic.
   - Implement state transition types for each builder method.
   - Implement state-to-AST conversion utilities.
   - Implement table context tracking and propagation (following `BuildTableContext` pattern from matcher).
   - **Verify:** If validator is modified for state validation, run existing validator tests.

3. **Phase 3: Runtime Implementation**
   - Implement `ConditionTreeBuilder` with internal AST structure.
   - Implement `SelectQueryBuilder` runtime class.
   - Implement ID tracking (user-provided IDs only, no automatic generation).
   - **Implement SQL string assembly utility (runtime):**
     - Create runtime utility that assembles SQL string from user-provided fragments.
     - This is NOT an AST-to-SQL converter - it's simple string assembly.
     - Assembles parts in correct SQL order, adds keywords where needed, skips empty clauses.
     - Handle edge cases: empty arrays, undefined values, subqueries (call their `toString()` methods).
   - Implement SQL string generation from state using string assembly utility.
   - Handle default `SELECT *` when `select()` is never called (returns all columns from FROM table per SQL spec).

4. **Phase 4: Conditional Logic & Validation**
   - Implement `.when()` logic types:
     - Type-level: Always execute callback, add all parts to AST (mark conditional selects as optional).
     - Runtime: Respect conditions, only include parts in SQL when condition is true.
     - **Nested `.when()` calls are NOT supported** - adds unnecessary complexity.
   - Implement per-method validation using AST-level validator:
     - Convert builder state to `SelectClause` AST.
     - Call `ValidateSelectClause` (AST-level validator) directly - do NOT convert to SQL string.
     - Resolve `UnboundColumnRef` columns against current table context during validation.
     - Extract validation errors and return `ErrorState` if invalid.
     - **Verify:** If validator is modified, run existing validator tests.
   - Implement result type inference using existing `MatchSelectClause`:
     - Convert builder state to `SelectClause` AST.
     - Call `MatchSelectClause<SelectClause, Schema>` from `src/select/matcher.ts` to get result type.
     - Use result type in `toString()` branded return type.
     - **Verify:** If matcher is modified, run existing matcher tests.
   - Implement error state handling and error message generation.
   - Add support for `distinct()`, `union()`, `removeLimit()`, `removeOffset()` methods.
   - Test complex scenarios: conditionals (no nested), CTEs, subqueries, unions.
   - **Builder needs its own comprehensive test suite** - tests must be written as part of implementation.
   - **Final Verification:** Run full test suite to ensure all existing functionality still works.

## 6. Examples

### Basic Usage

```typescript
const builder = createSelectQuery(schema)
    .select("id", "name")
    .from("users")
    .where("active = true", "active_filter")
    .limit(10);

const sql = builder.toString();
// sql is: string & { __type: { id: number; name: string }[] }

// Extract result type using branded string type
type Result = (typeof sql).__type;
// Result: { id: number; name: string }[]

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

const builder = createSelectQuery(schema)
    .select("id")
    .from("users")
    .when(includeEmail, b => b.select("email"))
    .when(
        joinOrders,
        b => b.join("LEFT JOIN orders ON orders.user_id = users.id"),
    );

// Runtime SQL (includeEmail=false, joinOrders=true):
// "SELECT id FROM users LEFT JOIN orders ON orders.user_id = users.id"
// Note: email is NOT in SQL because includeEmail=false

// Type level AST: Includes ALL parts regardless of runtime conditions
// - "id" column (always selected)
// - "email" column (from conditional, marked optional)
// - orders join (from conditional, makes orders columns optional)

// Result type: { id: number; email?: string | undefined; orders.*?: ... }[]
// Note: email is optional (undefined union) even though it's not in runtime SQL
```

### CTEs and Subqueries

```typescript
const builder = createSelectQuery(schema)
    .with("active_users AS (SELECT * FROM users WHERE active = true)", "cte1")
    .select("au.id", "au.name")
    .from("active_users AS au")
    .where("au.created_at > NOW() - INTERVAL '30 days'");

// CTE is validated independently, then its columns become available in outer query
```

### ID-based Replacement

```typescript
let builder = createSelectQuery(schema)
    .select("id", "name")
    .join("INNER JOIN orders ON orders.user_id = users.id", "orders_join");

// Later, replace the join (must be same or stricter join type)
builder = builder.join(
    "LEFT JOIN orders ON orders.user_id = users.id",
    "orders_join",
);
// Type error: Cannot replace INNER join with LEFT join (looser strictness)
// Runtime: If replacement violates strictness rules, it's a no-op (join not replaced)
```

### ConditionTree

```typescript
const conditions = createConditionTree("and")
    .add("age > 18", "age_check")
    .add("status = 'active'", "status_check");

const builder = createSelectQuery(schema)
    .select("*")
    .from("users")
    .where(conditions);

// Note: ConditionTree does not support nested `.when()` calls
```
