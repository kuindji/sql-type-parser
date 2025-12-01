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
import type { ParseError, Increment, Decrement, IsStringLiteral, DynamicQuery } from "./common/utils.js"
import type { QueryType } from "./common/ast.js"

// Import parsers from each query type module
import type { ParseSelectSQL, SQLSelectQuery } from "./select/index.js"
import type { ParseInsertSQL, SQLInsertQuery } from "./insert/index.js"
import type { ParseUpdateSQL, SQLUpdateQuery } from "./update/index.js"
import type { ParseDeleteSQL, SQLDeleteQuery } from "./delete/index.js"

// ============================================================================
// Query Type Detection
// ============================================================================

/**
 * Detect the type of SQL query from the first keyword
 * 
 * For WITH (CTE) queries, looks ahead to find the actual query type
 */
export type DetectQueryType<T extends string> = 
  NextToken<NormalizeSQL<T>> extends [infer First extends string, infer Rest extends string]
    ? First extends "WITH"
      ? DetectQueryTypeAfterWith<Rest>
      : First extends "SELECT"
        ? "SELECT"
        : First extends "INSERT"
          ? "INSERT"
          : First extends "UPDATE"
            ? "UPDATE"
            : First extends "DELETE"
              ? "DELETE"
              : "UNKNOWN"
    : "UNKNOWN"

/**
 * Detect query type after WITH clause by finding the main query keyword
 */
type DetectQueryTypeAfterWith<T extends string> = 
  FindMainQueryKeyword<T> extends infer Keyword
    ? Keyword extends "SELECT" ? "SELECT"
      : Keyword extends "INSERT" ? "INSERT"
      : Keyword extends "UPDATE" ? "UPDATE"
      : Keyword extends "DELETE" ? "DELETE"
      : "SELECT"  // Default to SELECT for backwards compatibility
    : "SELECT"

/**
 * Find the main query keyword after CTEs by scanning for SELECT/INSERT/UPDATE/DELETE
 * that is not inside parentheses
 */
type FindMainQueryKeyword<T extends string, Depth extends number = 0> = 
  T extends ""
    ? "UNKNOWN"
    : T extends `(${infer Rest}`
      ? FindMainQueryKeyword<Rest, Increment<Depth>>
      : T extends `)${infer Rest}`
        ? FindMainQueryKeyword<Rest, Decrement<Depth>>
        : Depth extends 0
          ? NextToken<T> extends [infer Token extends string, infer Rest extends string]
            ? Token extends "SELECT" | "INSERT" | "UPDATE" | "DELETE"
              ? Token
              : FindMainQueryKeyword<Rest, Depth>
            : "UNKNOWN"
          : NextToken<T> extends [infer _Token, infer Rest extends string]
            ? FindMainQueryKeyword<Rest, Depth>
            : "UNKNOWN"

// ============================================================================
// Unified Query AST Types
// ============================================================================

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
 * For dynamic queries (where the string type is not a literal), returns
 * DynamicQuery marker to indicate the query cannot be parsed at compile time.
 * 
 * @example
 * ```typescript
 * type SelectAST = ParseSQL<"SELECT id, name FROM users">
 * // Returns SQLSelectQuery<SelectClause<...>>
 * 
 * type InsertAST = ParseSQL<"INSERT INTO users (id) VALUES (1)">
 * // Returns SQLInsertQuery<InsertClause<...>>
 * 
 * type UpdateAST = ParseSQL<"UPDATE users SET name = 'John' WHERE id = 1">
 * // Returns SQLUpdateQuery<UpdateClause<...>>
 * 
 * type DeleteAST = ParseSQL<"DELETE FROM users WHERE id = 1">
 * // Returns SQLDeleteQuery<DeleteClause<...>>
 * 
 * // Dynamic queries pass through without validation
 * declare const dynamic: string
 * type DynamicAST = ParseSQL<`SELECT * FROM users ${typeof dynamic}`>
 * // Returns DynamicQuery (passes through without errors)
 * ```
 */
export type ParseSQL<T extends string> = 
  // If T is not a string literal (e.g., it's `string` or contains unresolved template parts),
  // return DynamicQuery to indicate we can't parse it at compile time
  IsStringLiteral<T> extends false
    ? DynamicQuery
    : DetectQueryType<T> extends infer QType
      ? QType extends "SELECT"
        ? ParseSelectSQL<T>
        : QType extends "INSERT"
          ? ParseInsertSQL<T>
          : QType extends "UPDATE"
            ? ParseUpdateSQL<T>
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

// Re-export the UPDATE-specific parser and types for direct use
export type { ParseUpdateSQL, SQLUpdateQuery } from "./update/index.js"

// Re-export the DELETE-specific parser and types for direct use
export type { ParseDeleteSQL, SQLDeleteQuery } from "./delete/index.js"

// Re-export dynamic query support
export type { DynamicQuery } from "./common/utils.js"

