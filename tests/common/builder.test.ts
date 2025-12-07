/**
 * Common Builder Tests
 *
 * Phase 3: runtime ConditionTreeBuilder and whenRuntime helper.
 * If this file compiles and basic runtime expectations hold, tests pass.
 */

import { createConditionTree, whenRuntime } from "../../src/common/index.js";

// Simple smoke tests for ConditionTreeBuilder runtime behavior.

const tree = createConditionTree("and")
    .add("age > 18", "age")
    .add("active = true", "active");

const treeSql: string = tree.toString();
// Expect something like: "(age > 18 AND active = true)"
if (!treeSql.startsWith("(") || !treeSql.endsWith(")")) {
    throw new Error("ConditionTreeBuilder.toString() must wrap in parentheses");
}

// whenRuntime should conditionally apply callback at runtime
const base = { value: 1 };
const inc = whenRuntime(base, true, b => ({ value: b.value + 1 }));
const same = whenRuntime(base, false, b => ({ value: b.value + 1 }));

if (inc.value !== 2) {
    throw new Error("whenRuntime should apply callback when condition is true");
}
if (same.value !== 1) {
    throw new Error(
        "whenRuntime should not apply callback when condition is false",
    );
}

export type CommonBuilderTestsPass = true;
