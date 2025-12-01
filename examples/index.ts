/**
 * Examples Index
 * 
 * Re-exports all example types for easy importing.
 * These are schema definitions and type examples - tests are in the /tests folder.
 */

// Shared schema definitions (used by all examples and tests)
export type {
  ECommerceSchema,
  BlogSchema,
  JsonSchema,
  CamelCaseSchema,
  MultiSchemaExample,
  UUID,
  Timestamp,
  JSONObject,
} from "./schema.js"

// SELECT query examples
export * from "./select/index.js"
