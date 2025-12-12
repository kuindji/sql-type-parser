/**
 * SELECT Parser Tests Index
 *
 * Re-exports all parser test verification types.
 * If this file compiles without errors, all parser tests pass.
 */

export type { BasicParserTestsPass } from "./basic.test.js"
export type { TableRefParserTestsPass } from "./table-ref.test.js"
export type { JoinParserTestsPass } from "./join.test.js"
export type { ClausesParserTestsPass } from "./clauses.test.js"
export type { AggregatesParserTestsPass } from "./aggregates.test.js"
export type { WildcardsParserTestsPass } from "./wildcards.test.js"
export type { CTEParserTestsPass } from "./cte.test.js"
export type { SubqueriesParserTestsPass } from "./subqueries.test.js"
export type { ExpressionsParserTestsPass } from "./expressions.test.js"
export type { LiteralsParserTestsPass } from "./literals.test.js"
export type { IdentifiersParserTestsPass } from "./identifiers.test.js"
export type { CompleteParserTestsPass } from "./complete.test.js"
export type { NormalizationParserTestsPass } from "./normalization.test.js"
export type { ParserComplexTestsPass } from "./complex.test.js"
export type { UnionTestsPass } from "./union.test.js"

export type ParserTestsPass = true
