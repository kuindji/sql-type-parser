/**
 * Query Type Router
 * 
 * This module provides the main entry point for parsing SQL queries.
 * It detects the query type (SELECT, INSERT, UPDATE, DELETE) and
 * routes to the appropriate parser.
 * 
 * Design Philosophy:
 * -----------------
 * Each query type has its own execution tree in the type system.
 * This prevents TypeScript performance issues by avoiding deep
 * conditional type evaluation across all query types simultaneously.
 * 
 * When you add support for a new query type:
 * 1. Create a new directory (e.g., src/insert/)
 * 2. Implement ast.ts, parser.ts, matcher.ts in that directory
 * 3. Add the query type to QueryType in common/ast.ts
 * 4. Add a case to DetectQueryType and ParseSQL in this file
 * 5. Export from index.ts
 */

import type { NormalizeSQL, NextToken } from "./common/tokenizer.js"
import type { ParseError } from "./common/utils.js"
import type { QueryType } from "./common/ast.js"

// Import parsers from each query type module
import type { ParseSelectSQL, SQLSelectQuery } from "./select/index.js"
import type { ParseInsertSQL, SQLInsertQuery } from "./insert/index.js"
import type { ParseDeleteSQL, SQLDeleteQuery } from "./delete/index.js"

// ============================================================================
// Query Type Detection
// ============================================================================

/**
 * Detect the type of SQL query from the first keyword
 */
export type DetectQueryType<T extends string> = 
  NextToken<NormalizeSQL<T>> extends [infer First extends string, infer _Rest]
    ? First extends "SELECT" | "WITH"
      ? "SELECT"
      : First extends "INSERT"
        ? "INSERT"
        : First extends "UPDATE"
          ? "UPDATE"
          : First extends "DELETE"
            ? "DELETE"
            : "UNKNOWN"
    : "UNKNOWN"

// ============================================================================
// Unified Query AST Types
// ============================================================================

/**
 * Placeholder AST type for UPDATE queries (to be implemented)
 */
export type SQLUpdateQuery = {
  readonly type: "SQLQuery"
  readonly queryType: "UPDATE"
  readonly query: {
    readonly type: "UpdateClause"
    // Will be expanded when UPDATE is implemented
  }
}

/**
 * Union of all SQL query AST types
 */
export type AnySQLQuery = SQLSelectQuery | SQLInsertQuery | SQLUpdateQuery | SQLDeleteQuery

// ============================================================================
// Main Parser Entry Point
// ============================================================================

/**
 * Parse any SQL query string into an AST
 * 
 * This is the main entry point for parsing. It detects the query type
 * and routes to the appropriate parser.
 * 
 * @example
 * ```typescript
 * type SelectAST = ParseSQL<"SELECT id, name FROM users">
 * // Returns SQLSelectQuery<SelectClause<...>>
 * 
 * type InsertAST = ParseSQL<"INSERT INTO users (id) VALUES (1)">
 * // Returns ParseError (INSERT not yet implemented)
 * ```
 */
export type ParseSQL<T extends string> = 
  DetectQueryType<T> extends infer QType
    ? QType extends "SELECT"
      ? ParseSelectSQL<T>
      : QType extends "INSERT"
        ? ParseInsertSQL<T>
        : QType extends "UPDATE"
          ? ParseError<"UPDATE queries are not yet supported">
          : QType extends "DELETE"
            ? ParseDeleteSQL<T>
            : ParseError<"Unknown query type">
    : never

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a parsed query is a SELECT query
 */
export type IsSelectQuery<T> = T extends SQLSelectQuery ? true : false

/**
 * Check if a parsed query is an INSERT query
 */
export type IsInsertQuery<T> = T extends SQLInsertQuery ? true : false

/**
 * Check if a parsed query is an UPDATE query
 */
export type IsUpdateQuery<T> = T extends SQLUpdateQuery ? true : false

/**
 * Check if a parsed query is a DELETE query
 */
export type IsDeleteQuery<T> = T extends SQLDeleteQuery ? true : false

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Re-export the SELECT-specific parser for direct use
export type { ParseSelectSQL } from "./select/index.js"

// Re-export the INSERT-specific parser and types for direct use
export type { ParseInsertSQL, SQLInsertQuery } from "./insert/index.js"

// Re-export the DELETE-specific parser and types for direct use
export type { ParseDeleteSQL, SQLDeleteQuery } from "./delete/index.js"

