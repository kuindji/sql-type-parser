/**
 * SELECT Query Validator Entry Point
 *
 * This module provides the main entry point for SELECT query validation.
 * It is separate from the matcher (QueryResult) to allow for deeper
 * validation checks without impacting the performance of result type extraction.
 *
 * Design Philosophy:
 * -----------------
 * - QueryResult: Lightweight, focused on extracting column types for the result.
 *   Reports errors only for columns it can't resolve.
 *
 * - ValidateSelectSQL: Comprehensive validation including:
 *   - Column existence checks in SELECT clause
 *   - JOIN condition field validation
 *   - WHERE clause field validation
 *   - HAVING clause field validation
 *   - GROUP BY field validation
 *   - ORDER BY field validation
 *   - Type compatibility checks (future)
 *
 * This separation allows us to add deeper validation without making
 * QueryResult slower or more complex.
 */

import type { SelectClause, SQLSelectQuery, UnionClauseAny } from "../ast.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type { HasTemplateHoles, ParseError } from "../../common/utils.js";
import type { ParseSelectSQL } from "../parser.js";
import type { ValidateSelectOptions, DefaultValidateOptions } from "./types.js";
import type { ValidateSelectClause } from "./select-clause.js";
import type { ValidateUnionClause } from "./union.js";

// ============================================================================
// Main Validator Entry Point
// ============================================================================

/**
 * Validate a SELECT query against a schema
 *
 * This is the comprehensive validation entry point.
 * Returns true if valid, or an error message if invalid.
 *
 * For dynamic queries (non-literal strings or template interpolations),
 * validation is skipped and returns true since we can't validate at compile time.
 *
 * Unlike QueryResult which focuses on extracting the result type,
 * this validator is designed to perform all validation checks
 * including deep validation of JOIN/WHERE clauses.
 *
 * @param SQL - The SQL query string to validate
 * @param Schema - The database schema to validate against
 * @param Options - Validation options (optional, defaults to full validation)
 *
 * @example
 * ```typescript
 * // Full validation (default)
 * type Valid = ValidateSelectSQL<"SELECT id FROM users WHERE name = 'test'", Schema>
 *
 * // Disable field validation in WHERE/JOIN/etc (only validate SELECT columns)
 * type Valid = ValidateSelectSQL<"SELECT id FROM users", Schema, { validateAllFields: false }>
 *
 * // Dynamic queries pass through without validation
 * declare const dynamicPart: string
 * type Valid = ValidateSelectSQL<`SELECT * FROM users ${typeof dynamicPart}`, Schema>
 * // Returns true (no validation possible for dynamic queries)
 * ```
 */
export type ValidateSelectSQL<
    SQL extends string,
    Schema extends DatabaseSchema,
    Options extends ValidateSelectOptions = DefaultValidateOptions,
> = SQL extends SQL // Force distribution over union types
    ? HasTemplateHoles<SQL> extends true ? true // Dynamic queries bypass validation - can't validate at compile time
    : ParseSelectSQL<SQL> extends infer Parsed
        ? Parsed extends ParseError<infer E> ? E
        : Parsed extends SQLSelectQuery<infer QueryContent>
            ? ValidateQueryContent<QueryContent, Schema, Options>
        : "Failed to parse query"
    : never
    : never;

/**
 * Validate the query content (SelectClause or UnionClause)
 */
export type ValidateQueryContent<
    Content,
    Schema extends DatabaseSchema,
    Options extends ValidateSelectOptions = DefaultValidateOptions,
> = Content extends UnionClauseAny
    ? ValidateUnionClause<Content, Schema, Options>
    : Content extends SelectClause
        ? ValidateSelectClause<Content, Schema, Options>
    : "Invalid query content";
