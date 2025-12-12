/**
 * SELECT Tests Index
 *
 * Exports all test results for SELECT query functionality.
 * If this file compiles without errors, all tests pass.
 */

export type { ASTTestsPass } from "./ast.test.js";
export type { BuilderComplexTestsPass } from "./builder/complex.test.js";
export type { StateTestsPass as BuilderStateTestsPass } from "./builder/state.test.js";
export type {
    MatcherComplexTestsPass,
    MatcherTestsPass,
} from "./matcher/index.js";
export type { ParserTestsPass } from "./parser.test.js";
export type { ParserComplexTestsPass } from "./parser/complex.test.js";
export type { UnionTestsPass } from "./parser/union.test.js";
export type { ValidatorTestsPass } from "./validator.test.js";

/**
 * All SELECT tests pass if this type is true
 */
export type SelectTestsPass = true;
