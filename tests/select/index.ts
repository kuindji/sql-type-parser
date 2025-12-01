/**
 * SELECT Query Tests Index
 *
 * Exports all test results for SELECT query parsing and matching.
 * If this file compiles without errors, all tests pass.
 */

export type { ParserTestsPass } from "./parser.test.js"
export type { MatcherTestsPass } from "./matcher.test.js"
export type { ASTTestsPass } from "./ast.test.js"
export type { UnionTestsPass } from "./union.test.js"
export type { IntegrationTestsPass } from "./integration.test.js"

/**
 * All SELECT tests pass if this type is true
 */
export type SelectTestsPass = true

