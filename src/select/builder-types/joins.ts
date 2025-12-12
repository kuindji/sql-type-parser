import type { JoinStrictness } from "./state.js";
// ============================================================================
// Join Strictness Replacement Rules
// ============================================================================

/**
 * Type-level predicate describing whether a join with OldStrictness
 * may be replaced by a join with NewStrictness.
 *
 * Follows the hierarchy:
 *   INNER > LEFT = RIGHT > FULL > CROSS
 *
 * - You may tighten (weaken-or-equal → stricter).
 * - You must not loosen (stricter → weaker).
 */
export type CanReplaceJoin<
    OldStrictness extends JoinStrictness,
    NewStrictness extends JoinStrictness,
> =
    // Strictest: INNER can only be replaced with INNER
    OldStrictness extends "INNER" ? NewStrictness extends "INNER" ? true : false
        // LEFT/RIGHT can be tightened to INNER or kept as LEFT/RIGHT
        : OldStrictness extends "LEFT" | "RIGHT"
            ? NewStrictness extends "INNER" | "LEFT" | "RIGHT" ? true : false
        // FULL can be tightened to LEFT/RIGHT/INNER or kept as FULL
        : OldStrictness extends "FULL" ? NewStrictness extends
                | "FULL"
                | "LEFT"
                | "RIGHT"
                | "INNER" ? true
            : false
        // CROSS (weakest) can be replaced with any strictness
        : OldStrictness extends "CROSS"
            ? NewStrictness extends JoinStrictness ? true : false
        : false;

/**
 * Utility for mapping a JoinType from the AST to JoinStrictness.
 *
 * This is only used at the type level; runtime mapping is added later
 * alongside the concrete builder implementation.
 */
export type JoinTypeToStrictness<
    T extends string,
> = T extends "INNER" ? "INNER"
    : T extends "LEFT" | "LEFT OUTER" ? "LEFT"
    : T extends "RIGHT" | "RIGHT OUTER" ? "RIGHT"
    : T extends "FULL" | "FULL OUTER" ? "FULL"
    : T extends "CROSS" ? "CROSS"
    : never;
