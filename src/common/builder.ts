/**
 * Common builder utilities shared across query builders.
 *
 * Phase 3: runtime ConditionTreeBuilder + base .when() helper.
 */

import type { WhereExpr } from "./ast.js";

// Internal condition tree state mirrors WhereExpr / LogicalExpr structure.
export type ConditionTreePart = WhereExpr | ConditionTreeState;

export interface ConditionTreeState {
    readonly operator: "and" | "or";
    readonly parts: ReadonlyArray<{
        readonly id: string;
        readonly condition: WhereExpr | ConditionTreeState;
    }>;
}

type UppercaseOperator<Op extends "and" | "or"> = Op extends "and" ? "AND"
    : "OR";

type AppendCondition<
    Current extends string,
    Part extends string,
    Op extends "and" | "or",
> = string extends Current | Part ? string
    : Current extends "()" ? `(${Part})`
    : Current extends `(${infer Body})`
        ? `(${Body} ${UppercaseOperator<Op>} ${Part})`
    : string;

/**
 * Immutable condition tree builder used by SELECT/UPDATE/DELETE.
 *
 * Runtime-only; type-level behavior is driven by WhereExpr types, but we also
 * carry a lightweight string literal of the rendered expression when inputs
 * are literal strings to keep BuilderSQL precise.
 */
export class ConditionTreeBuilder<
    Op extends "and" | "or" = "and" | "or",
    Expr extends string = string,
> {
    private readonly state: ConditionTreeState;

    private constructor(state: ConditionTreeState) {
        this.state = state;
    }

    /** Create a new condition tree with the given operator. */
    static create<Op extends "and" | "or">(
        operator: Op,
    ): ConditionTreeBuilder<Op, "()"> {
        return new ConditionTreeBuilder<Op, "()">(
            {
                operator,
                parts: [],
            },
        );
    }

    /** Internal accessor used by query builders to read the tree state. */
    getState(): ConditionTreeState {
        return this.state;
    }

    /**
     * Add a new condition part.
     *
     * Currently this treats string fragments as opaque expressions and uses them
     * directly in toString(); query builders are responsible for validating &
     * parsing them into WhereExpr when integrating with the type-level parser.
     */
    add<
        Part extends string | ConditionTreeBuilder<any, any>,
    >(
        part: Part,
        id?: string,
    ): ConditionTreeBuilder<
        Op,
        AppendCondition<
            Expr,
            Part extends ConditionTreeBuilder<any, infer PExpr extends string>
                ? PExpr
                : Part extends string ? Part
                : string,
            Op
        >
    > {
        const partId = id ?? ConditionTreeBuilder.generateId();

        const condition: WhereExpr | ConditionTreeState =
            part instanceof ConditionTreeBuilder
                ? part.getState()
                : (part as any);

        // Replace existing part with same ID, or append if not found.
        const existingIndex = this.state.parts.findIndex(p => p.id === partId);
        const nextParts = existingIndex === -1
            ? [ ...this.state.parts, { id: partId, condition } ]
            : this.state.parts.map((p, idx) =>
                idx === existingIndex ? { id: partId, condition } : p
            );

        return new ConditionTreeBuilder<
            Op,
            AppendCondition<
                Expr,
                Part extends ConditionTreeBuilder<
                    any,
                    infer PExpr extends string
                > ? PExpr
                    : Part extends string ? Part
                    : string,
                Op
            >
        >(
            {
                operator: this.state.operator,
                parts: nextParts,
            },
        );
    }

    /** Remove a condition part by ID (no-op if not found). */
    remove(id: string): ConditionTreeBuilder<Op, Expr> {
        const nextParts = this.state.parts.filter(p => p.id !== id);
        if (nextParts.length === this.state.parts.length) {
            return this;
        }
        return new ConditionTreeBuilder<Op, Expr>(
            {
                operator: this.state.operator,
                parts: nextParts,
            },
        );
    }

    /**
     * Conditional modification helper shared by all builders.
     *
     * Runtime semantics:
     * - If condition is true: the callback is executed and its result returned.
     * - If condition is false: the callback is skipped and `this` is returned.
     *
     * Type-level behavior for specific builders is implemented separately.
     */
    when<Next extends ConditionTreeBuilder<any, any>>(
        condition: boolean,
        callback: (b: ConditionTreeBuilder<Op, Expr>) => Next,
    ): ConditionTreeBuilder<Op, Expr> | Next {
        return condition ? callback(this) : this;
    }

    /**
     * String representation used by query builders for WHERE/HAVING clauses.
     *
     * - Entire expression is wrapped in parentheses.
     * - Logical operators rendered as uppercase AND/OR.
     */
    toString(): Expr {
        if (this.state.parts.length === 0) {
            return "()" as Expr;
        }

        const op = this.state.operator.toUpperCase();
        const rendered = this.state.parts
            .map(part => ConditionTreeBuilder.renderPart(part.condition))
            .filter(s => s.length > 0)
            .join(` ${op} `);

        return `(${rendered})` as Expr;
    }

    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------

    private static renderPart(
        condition: WhereExpr | ConditionTreeState,
    ): string {
        if (ConditionTreeBuilder.isConditionTreeState(condition)) {
            const nested = new ConditionTreeBuilder(condition).toString();
            return nested;
        }
        // For now treat WhereExpr as an opaque string at runtime.
        return String((condition as any) ?? "").trim();
    }

    private static isConditionTreeState(
        value: WhereExpr | ConditionTreeState,
    ): value is ConditionTreeState {
        return (
            typeof value === "object"
            && value !== null
            && (value as any).operator !== undefined
            && Array.isArray((value as any).parts)
        );
    }

    private static generateId(): string {
        // Simple, stable ID for runtime usage; callers can override via explicit id.
        return `cond_${Math.random().toString(36).slice(2, 10)}`;
    }
}

/**
 * Convenience helper for creating a condition tree.
 * Prefer this over calling ConditionTreeBuilder.create directly.
 */
export function createConditionTree<Op extends "and" | "or">(
    operator: Op,
): ConditionTreeBuilder<Op, "()"> {
    return ConditionTreeBuilder.create(operator);
}

/**
 * Generic runtime `.when` helper for all builders.
 *
 * This is a small convenience wrapper that implements the shared
 * runtime semantics:
 *
 * - If condition is true: execute callback and return its result.
 * - If condition is false: skip callback and return builder unchanged.
 */
export function whenRuntime<B>(
    builder: B,
    condition: boolean,
    callback: (b: B) => B,
): B {
    return condition ? callback(builder) : builder;
}

// ---------------------------------------------------------------------------
// Parameter utilities (shared across builders)
// ---------------------------------------------------------------------------

/** Runtime parameter value type supported by query builders. */
export type QueryParamValue = string | number | boolean | null;

type BuildArray<N extends number, Acc extends unknown[] = []> = number extends N
    ? unknown[]
    : Acc["length"] extends N ? Acc
    : BuildArray<N, [ ...Acc, unknown ]>;

/**
 * Compute the string literal representing the placeholders for a parameter
 * tuple, offset by the number of existing parameters. Falls back to `string`
 * when counts are not known as literals.
 */
export type ParamString<
    Params extends readonly QueryParamValue[],
    Offset extends number = 0,
    Seen extends unknown[] = BuildArray<Offset>,
    Acc extends string = "",
> = Params extends readonly [
    any,
    ...infer Rest extends readonly QueryParamValue[],
] ? ParamString<
        Rest,
        Offset,
        [ ...Seen, unknown ],
        Acc extends "" ? `$${[ ...Seen, unknown ]["length"]}`
            : `${Acc}, $${[ ...Seen, unknown ]["length"]}`
    >
    : Acc;

/**
 * Append new parameters onto an existing list and return both the combined
 * params and the positional placeholder string (e.g. "$1, $2").
 */
export function appendParamsRuntime(
    existing: readonly QueryParamValue[],
    params: readonly QueryParamValue[],
): {
    readonly params: readonly QueryParamValue[];
    readonly paramString: string;
} {
    const base = existing ?? [];
    const nextParams = [ ...base, ...params ];
    const paramString = buildParamString(params, base.length);
    return {
        params: nextParams,
        paramString,
    };
}

/**
 * Build the placeholder string for a set of parameters with a given offset.
 */
export function buildParamString(
    params: readonly QueryParamValue[],
    offset: number,
): string {
    if (!params || params.length === 0) {
        return "";
    }
    return params.map((_, idx) => `$${offset + idx + 1}`).join(", ");
}
