/**
 * SQL Type Parser - Type Tests
 *
 * This module exports all type test results. If this file compiles
 * without errors, all type tests pass.
 *
 * Run tests with: npm run test (or tsc --noEmit)
 */

// Common utilities tests (shared by all query types)
export type { CommonTestsPass, TokenizerTestsPass, UtilsTestsPass } from "./common/index.js"

// SELECT query tests
export type {
  SelectTestsPass,
  ParserTestsPass,
  UnionTestsPass,
  DynamicTestsPass,
  ASTTestsPass,
  MatcherTestsPass,
  ValidatorTestsPass,
} from "./select/index.js"

// INSERT query tests
export type {
  InsertParserTestsPass,
  InsertMatcherTestsPass,
  InsertValidatorTestsPass,
} from "./insert/index.js"

// UPDATE query tests
export type {
  UpdateParserTestsPass,
  UpdateMatcherTestsPass,
  UpdateValidatorTestsPass,
} from "./update/index.js"

// DELETE query tests
export type {
  DeleteParserTestsPass,
  DeleteMatcherTestsPass,
  DeleteValidatorTestsPass,
} from "./delete/index.js"

/**
 * Master test result - true if all tests pass
 */
export type AllTestsPass = true

