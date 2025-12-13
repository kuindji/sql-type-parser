/**
 * Conditional SQL Runtime Implementation
 *
 * Runtime processing of SQL templates with conditional blocks
 * and parameter substitution.
 */

// ============================================================================
// Types
// ============================================================================

export type QueryParamValue = string | number | boolean | null;

export interface ConditionalSQLOptions {
    /**
     * If true, preserves conditional comment markers in output.
     * Useful for debugging.
     * @default false
     */
    preserveMarkers?: boolean;
}

export interface ConditionalSQLOutput {
    /** The processed SQL string with conditions applied */
    sql: string;
    /** The parameter values in order of appearance */
    params: QueryParamValue[];
}

// ============================================================================
// Core Runtime Implementation
// ============================================================================

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return current;
}

/**
 * Process conditional blocks in a SQL template.
 *
 * @param template - SQL template with `/*if:condition* /.../*endif* /` blocks
 * @param conditions - Object with condition values
 * @returns Processed SQL string
 */
export function processConditionalSQL(
    template: string,
    conditions: Record<string, unknown>,
): string {
    // Pattern matches /*if:condition*/ ... /*endif*/
    // Uses negative lookahead to match innermost conditions first
    const pattern =
        /\/\*if:(!?[\w.]+)\*\/((?:(?!\/\*if:)[\s\S])*?)\/\*endif\*\//g;

    let result = template;
    let hasMatches = true;

    // Process iteratively to handle nested conditions
    while (hasMatches) {
        hasMatches = false;

        result = result.replace(
            pattern,
            (_, condition: string, content: string) => {
                hasMatches = true;

                const isNegated = condition.startsWith("!");
                const key = isNegated ? condition.slice(1) : condition;
                const value = getNestedValue(conditions, key);
                const isTruthy = Boolean(value);

                return (isNegated ? !isTruthy : isTruthy) ? content : "";
            },
        );
    }

    return result;
}

/**
 * Extract named parameters from SQL and convert to positional placeholders.
 *
 * @param sql - SQL string with :paramName placeholders
 * @param params - Object with parameter values
 * @returns Object with processed SQL and ordered params array
 */
export function processParams(
    sql: string,
    params: Record<string, QueryParamValue>,
): ConditionalSQLOutput {
    // Find all param references in order of first appearance
    const paramRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_])/g;
    const usedParams: string[] = [];
    let match;

    while ((match = paramRegex.exec(sql)) !== null) {
        const name = match[1];
        if (name in params && !usedParams.includes(name)) {
            usedParams.push(name);
        }
    }

    // Replace each param with positional placeholder
    let processedSql = sql;
    for (let i = 0; i < usedParams.length; i++) {
        const name = usedParams[i];
        const regex = new RegExp(`:${name}(?![a-zA-Z0-9_])`, "g");
        processedSql = processedSql.replace(regex, `$${i + 1}`);
    }

    // Extract param values in order
    const paramValues = usedParams.map(name => params[name]);

    return {
        sql: processedSql,
        params: paramValues,
    };
}

/**
 * Process a conditional SQL template with both conditions and parameters.
 *
 * @param template - SQL template with conditional blocks and :params
 * @param conditions - Object with condition values
 * @param params - Object with parameter values
 * @returns Processed SQL and params array
 */
export function conditionalSQL(
    template: string,
    conditions: Record<string, unknown>,
    params: Record<string, QueryParamValue> = {},
): ConditionalSQLOutput {
    // Step 1: Process conditional blocks
    const conditionalProcessed = processConditionalSQL(template, conditions);

    // Step 2: Process parameters
    return processParams(conditionalProcessed, params);
}

/**
 * Normalize whitespace in SQL (collapse multiple spaces/newlines).
 * Useful for comparing or logging processed SQL.
 */
export function normalizeWhitespace(sql: string): string {
    return sql
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s*\(\s*/g, "(")
        .replace(/\s*\)\s*/g, ")")
        .trim();
}

