/**
 * Database Integration Examples
 *
 * Shows how to create type-safe query functions.
 * Query is written ONCE, no `as` casts needed.
 */

import type {
    ValidateSQL,
    DatabaseSchema,
    SelectResultArray,
    IsValidSelect,
    ValidQuery,
} from "../../src/index.js"

import { createSelectFn } from "../../src/index.js"

/**
 * Force TypeScript to expand a type for better IDE display
 * This makes hover tooltips show the actual shape instead of type aliases
 */
type Prettify<T> = {
    [K in keyof T]: T[K]
} & {}


// ============================================================================
// Schema Definition
// ============================================================================

type MySchema = {
    defaultSchema: "public"
    schemas: {
        public: {
            users: {
                id: number
                name: string
                email: string
                role: "admin" | "user" | "guest"
                is_active: boolean
                created_at: string
            }
            posts: {
                id: number
                user_id: number
                title: string
                content: string
                status: "draft" | "published" | "archived"
                views: number
            }
        }
    }
}

// ============================================================================
// Example 1: Basic Select Function
// ============================================================================

// Your database client (any client works)
async function clientSelect(_sql: string, _params?: unknown[]) {
    return Promise.resolve([]);
}

// Create a typed select function
const select = createSelectFn<MySchema>(clientSelect);

// Usage
async function example1() {
    // ✅ Valid query - result is typed
    const users = await select("SELECT id, name, email FROM users WHERE is_active = $1", [true])
    // users: Array<{ id: number; name: string; email: string }>

    console.log(users[0].name) // ✅ string
    console.log(users[0].id) // ✅ number

    // ✅ Union types preserved
    const _roles = await select("SELECT role FROM users")
    // roles: Array<{ role: "admin" | "user" | "guest" }>

    // ❌ Invalid query - COMPILE ERROR (not runtime!)
    // const bad = await select("SELECT unknown FROM users")
    // Error: Argument of type '"SELECT unknown FROM users"' is not assignable
    //        to parameter of type 'never'
}

// ============================================================================
// Example 2: Create Your Own Wrapper
// ============================================================================

/**
 * Users can easily create their own wrapper if they have specific needs.
 * The key is the `ValidQuery` type that validates at compile time.
 */

// Example: Wrapper that returns { rows, count }
function createMyWrapper<Schema extends DatabaseSchema>(
    handler: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; count: number }>
) {
    return function query<Q extends string>(
        sql: ValidQuery<Q, Schema>,
        params?: unknown[]
    ) {
        return handler(sql, params) as Promise<{
            rows: Prettify<SelectResultArray<Q, Schema>>
            count: number
        }>
    }
}

// Usage
declare const customDb: {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; count: number }>
}

const mySelect = createMyWrapper<MySchema>((sql, params) => customDb.query(sql, params))

async function example4() {
    const result = await mySelect("SELECT id, name FROM users WHERE is_active = $1", [true])
    // result: { rows: Array<{ id: number; name: string }>; count: number }

    console.log(result.count)
    console.log(result.rows[0].name) // ✅ string
}

// ============================================================================
// Example 4: Compile-Time Validation Types
// ============================================================================

// Check if query is valid
type IsValid1 = IsValidSelect<"SELECT id FROM users", MySchema> // true
type IsValid2 = IsValidSelect<"SELECT bad FROM users", MySchema> // false

// Get validation result (true or error message)
type Validation1 = ValidateSQL<"SELECT id FROM users", MySchema> // true
type Validation2 = ValidateSQL<"SELECT bad FROM users", MySchema> // error message


// ============================================================================
// Type Verification
// ============================================================================

type _Assert1 = IsValid1 extends true ? true : never
type _Assert2 = IsValid2 extends false ? true : never
