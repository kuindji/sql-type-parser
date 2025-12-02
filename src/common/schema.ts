/**
 * Database Schema Type Definitions
 * 
 * This module defines the structure of database schemas used for
 * type-level query validation and result type inference.
 */

// ============================================================================
// Relation Types
// ============================================================================

/**
 * Relation cardinality types
 */
export type RelationType = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"

/**
 * Reference to a table column
 * Used to define the endpoints of a relation
 */
export type ColumnReference<
    Schema extends string | undefined = string | undefined,
    Table extends string = string,
    Column extends string = string,
> = {
    /** Schema name (uses default if not specified) */
    schema?: Schema
    /** Table name */
    table: Table
    /** Column name */
    column: Column
}

/**
 * Defines a relationship between two tables
 * 
 * @example
 * ```typescript
 * // Foreign key: orders.user_id -> users.id
 * type OrderUserRelation = Relation<
 *   { table: "orders"; column: "user_id" },
 *   { table: "users"; column: "id" },
 *   "many-to-one"
 * >
 * ```
 */
export type Relation<
    From extends ColumnReference = ColumnReference,
    To extends ColumnReference = ColumnReference,
    Type extends RelationType = RelationType,
> = {
    /** The referencing side (foreign key) */
    from: From
    /** The referenced side (primary key) */
    to: To
    /** The cardinality of the relationship */
    type: Type
}

/**
 * A collection of named relations
 */
export type Relations = {
    [relationName: string]: Relation
}

// ============================================================================
// Schema Types
// ============================================================================

/**
 * Definition of a single table's columns
 * Maps column names to their TypeScript types
 * 
 * Uses `object` instead of index signature to allow both
 * `interface` and `type` declarations as table definitions
 */
export type TableDefinition = object

/**
 * Definition of tables within a database schema
 * Maps table names to their column definitions
 */
export type SchemaDefinition = {
    [tableName: string]: TableDefinition
}

/**
 * Expected structure of a database schema with optional relations
 * 
 * @example
 * ```typescript
 * type MySchema = {
 *   defaultSchema: "public",
 *   schemas: {
 *     public: {
 *       users: { id: number; name: string; email: string }
 *       orders: { id: number; user_id: number; total: number }
 *     }
 *   }
 * }
 * ```
 */
export type DatabaseSchema = {
    /**
     * Database schemas containing table definitions
     * Each schema maps table names to their column definitions
     */
    schemas: {
        [schemaName: string]: SchemaDefinition
    }

    /**
     * Default schema to use when table names are not schema-qualified
     * If not specified, uses the first schema key
     */
    defaultSchema?: string

    /**
     * Optional relation definitions between tables
     * Used for validating JOIN conditions
     * Does not affect table column definitions
     */
    relations?: Relations
}

// ============================================================================
// Schema Utility Types
// ============================================================================

/**
 * Get the default schema name from a DatabaseSchema
 * Uses defaultSchema if specified, otherwise uses the first schema key
 */
export type GetDefaultSchema<Schema extends DatabaseSchema> =
    Schema["defaultSchema"] extends string
    ? Schema["defaultSchema"]
    : keyof Schema["schemas"] extends infer Keys
    ? Keys extends string
    ? Keys
    : never
    : never

/**
 * Get all table names from a schema
 */
export type GetTableNames<
    Schema extends DatabaseSchema,
    SchemaName extends keyof Schema["schemas"] = GetDefaultSchema<Schema>
> = SchemaName extends keyof Schema["schemas"]
    ? keyof Schema["schemas"][SchemaName]
    : never

/**
 * Get column names from a specific table
 */
export type GetColumnNames<
    Schema extends DatabaseSchema,
    TableName extends string,
    SchemaName extends keyof Schema["schemas"] = GetDefaultSchema<Schema>
> = SchemaName extends keyof Schema["schemas"]
    ? TableName extends keyof Schema["schemas"][SchemaName]
    ? keyof Schema["schemas"][SchemaName][TableName]
    : never
    : never

/**
 * Get the type of a specific column
 */
export type GetColumnType<
    Schema extends DatabaseSchema,
    TableName extends string,
    ColumnName extends string,
    SchemaName extends keyof Schema["schemas"] = GetDefaultSchema<Schema>
> = SchemaName extends keyof Schema["schemas"]
    ? TableName extends keyof Schema["schemas"][SchemaName]
    ? ColumnName extends keyof Schema["schemas"][SchemaName][TableName]
    ? Schema["schemas"][SchemaName][TableName][ColumnName]
    : never
    : never
    : never

/**
 * Check if a schema has relations defined
 */
export type HasRelations<Schema extends DatabaseSchema> =
    Schema extends { relations: Relations }
    ? keyof Schema["relations"] extends never
    ? false
    : true
    : false

/**
 * Get all relation names from a schema
 */
export type GetRelationNames<Schema extends DatabaseSchema> =
    Schema extends { relations: infer R }
    ? R extends Relations
    ? keyof R
    : never
    : never

/**
 * Get a specific relation from a schema
 */
export type GetRelation<
    Schema extends DatabaseSchema,
    RelationName extends string
> = Schema extends { relations: infer R }
    ? R extends Relations
    ? RelationName extends keyof R
    ? R[RelationName]
    : never
    : never
    : never

/**
 * Find relations where the given table is the "from" side
 */
export type FindRelationsFrom<
    Schema extends DatabaseSchema,
    TableName extends string,
    SchemaName extends string | undefined = undefined
> = Schema extends { relations: infer R }
    ? R extends Relations
    ? {
        [K in keyof R]: R[K] extends Relation<infer From, infer _To, infer _Type>
        ? From extends { table: TableName; schema?: SchemaName }
        ? K
        : never
        : never
    }[keyof R]
    : never
    : never

/**
 * Find relations where the given table is the "to" side
 */
export type FindRelationsTo<
    Schema extends DatabaseSchema,
    TableName extends string,
    SchemaName extends string | undefined = undefined
> = Schema extends { relations: infer R }
    ? R extends Relations
    ? {
        [K in keyof R]: R[K] extends Relation<infer _From, infer To, infer _Type>
        ? To extends { table: TableName; schema?: SchemaName }
        ? K
        : never
        : never
    }[keyof R]
    : never
    : never

