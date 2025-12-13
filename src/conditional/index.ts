/**
 * Conditional SQL Module
 *
 * Provides type-safe conditional SQL processing with:
 * - Conditional blocks: `/*if:condition* /.../*endif* /`
 * - Named parameters: `:paramName`
 * - Full result type inference with optionality
 *
 * @example
 * ```typescript
 * import { createConditionalQuery } from '@kuindji/sql-type-parser/conditional'
 *
 * const query = createConditionalQuery<MySchema>()
 *
 * const result = query(
 *   `SELECT id, name
 *    /*if:includeEmail* /, email/*endif* /
 *    FROM users
 *    /*if:withOrders* /
 *    LEFT JOIN orders o ON o.user_id = users.id
 *    /*endif* /
 *    WHERE id = :userId
 *    /*if:activeOnly* /AND active = true/*endif* /`,
 *   { includeEmail: true, withOrders: false, activeOnly: true },
 *   { userId: 123 }
 * )
 *
 * // result.sql: "SELECT id, name, email FROM users WHERE id = $1 AND active = true"
 * // result.params: [123]
 * // Type: { id: number; name: string; email: string | undefined }
 * ```
 */

import type { DatabaseSchema } from "../common/schema.js";
import type { QueryParamValue } from "./runtime.js";
import type {
    ConditionalQueryResult,
    ProcessedSQL,
    ValidateConditionalSQL,
} from "./matcher.js";
import {
    conditionalSQL,
    type ConditionalSQLOutput,
} from "./runtime.js";

// ============================================================================
// Re-exports
// ============================================================================

export type {
    ConditionalQueryResult,
    ProcessedSQL,
    ValidateConditionalSQL,
} from "./matcher.js";

export type {
    AllConditionsFalse,
    AllConditionsTrue,
    ConditionalColumn,
    ConditionalLeftJoinColumn,
    EvalCondition,
    ExtractParamNames,
    GetPath,
    IsTruthy,
    ProcessConditionalSQL,
    ValidateParams,
} from "./types.js";

export {
    conditionalSQL,
    normalizeWhitespace,
    processConditionalSQL,
    processParams,
    type ConditionalSQLOptions,
    type ConditionalSQLOutput,
    type QueryParamValue,
} from "./runtime.js";

// ============================================================================
// Typed Query Function
// ============================================================================

/**
 * Branded output type that carries result type information.
 */
export interface TypedConditionalSQLOutput<Result> extends ConditionalSQLOutput {
    /** Type brand for result inference (not used at runtime) */
    readonly __resultType?: Result;
}

/**
 * Create a type-safe conditional query function for a schema.
 *
 * The returned function processes SQL templates with conditional blocks
 * and parameters, returning both the processed SQL and a typed result.
 *
 * @example
 * ```typescript
 * const query = createConditionalQuery<MySchema>()
 *
 * const { sql, params } = query(
 *   `SELECT id, name /*if:extra* /, extra/*endif* / FROM users WHERE id = :id`,
 *   { extra: true },
 *   { id: 1 }
 * )
 * ```
 */
export function createConditionalQuery<Schema extends DatabaseSchema>() {
    /**
     * Process a conditional SQL template.
     *
     * @param template - SQL template with conditional blocks and :params
     * @param conditions - Object with condition values (must use `as const` for type inference)
     * @param params - Object with parameter values
     * @returns Processed SQL and params with inferred result type
     */
    function query<
        Template extends string,
        Conditions extends Record<string, unknown>,
        Params extends Record<string, QueryParamValue> = {},
    >(
        template: Template,
        conditions: Conditions,
        params?: Params,
    ): TypedConditionalSQLOutput<
        ConditionalQueryResult<Template, Conditions, Schema>
    > {
        const result = conditionalSQL(template, conditions, params ?? {});
        return result as TypedConditionalSQLOutput<
            ConditionalQueryResult<Template, Conditions, Schema>
        >;
    }

    return query;
}

/**
 * Extract the result type from a TypedConditionalSQLOutput.
 */
export type ExtractResultType<T> = T extends TypedConditionalSQLOutput<
    infer R
> ? R
    : never;

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate a conditional SQL query at compile time.
 * Returns the template if valid, or an error message type if invalid.
 */
export type ValidConditionalQuery<
    Template extends string,
    Conditions extends Record<string, unknown>,
    Schema extends DatabaseSchema,
> = ValidateConditionalSQL<Template, Conditions, Schema> extends true
    ? Template
    : `[SQL Error] ${ValidateConditionalSQL<Template, Conditions, Schema> & string}`;

// ============================================================================
// Static Type Helpers
// ============================================================================

/**
 * Helper to specify condition types statically for better type inference.
 *
 * Use this when you want to pre-define condition shapes that can be
 * reused across multiple queries.
 *
 * @example
 * ```typescript
 * type MyConditions = {
 *   includeDeleted: boolean
 *   withOrders: boolean
 * }
 *
 * const query = createConditionalQuery<MySchema>()
 * const typedQuery = withConditions<MyConditions>(query)
 *
 * // Now conditions are typed as MyConditions
 * const result = typedQuery(template, { includeDeleted: true, withOrders: false }, params)
 * ```
 */
export function withConditions<StaticConditions extends Record<string, unknown>>(
    queryFn: ReturnType<typeof createConditionalQuery>,
) {
    return <
        Template extends string,
        Params extends Record<string, QueryParamValue> = {},
    >(
        template: Template,
        conditions: StaticConditions,
        params?: Params,
    ) => {
        return queryFn(template, conditions, params);
    };
}

