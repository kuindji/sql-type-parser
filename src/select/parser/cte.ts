/**
 * Type-level SQL SELECT CTE (WITH clause) parser utilities
 *
 * This module provides utility types for CTE parsing.
 * The full CTE parsing implementation is in index.ts to handle
 * circular dependencies with ParseSelectQuery.
 */

import type { Trim } from "../../common/utils.js";
import type { ExtractUntilClosingParen } from "./columns.js";

// ============================================================================
// CTE Utilities
// ============================================================================

/**
 * Extract the CTE query from parentheses and return rest
 * This is a utility that extracts the string content - actual parsing
 * happens in index.ts using ParseSelectQuery
 */
export type ExtractCTEQuery<T extends string> =
    ExtractUntilClosingParen<T, 1, ""> extends [
        infer Query extends string,
        infer Rest extends string,
    ] ? [Trim<Query>, Trim<Rest>]
        : never;
