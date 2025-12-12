/**
 * JOIN Parser Tests
 *
 * Tests for parsing various JOIN types.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    SQLSelectQuery,
    TableRef,
    JoinClause,
    ParsedCondition,
} from "../../../src/index.js"
import type { RequireTrue } from "../../helpers.js"

// ============================================================================
// JOIN Tests
// ============================================================================

// Test: INNER JOIN
type P_InnerJoin = ParseSQL<"SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id">
type P_InnerJoin_Check = P_InnerJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"INNER", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P13 = RequireTrue<P_InnerJoin_Check>

// Test: LEFT JOIN
type P_LeftJoin = ParseSQL<"SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id">
type P_LeftJoin_Check = P_LeftJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"LEFT", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P14 = RequireTrue<P_LeftJoin_Check>

// Test: RIGHT JOIN
type P_RightJoin = ParseSQL<"SELECT * FROM users RIGHT JOIN orders ON users.id = orders.user_id">
type P_RightJoin_Check = P_RightJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"RIGHT", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P15 = RequireTrue<P_RightJoin_Check>

// Test: FULL OUTER JOIN
type P_FullJoin = ParseSQL<"SELECT * FROM users FULL OUTER JOIN orders ON users.id = orders.user_id">
type P_FullJoin_Check = P_FullJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"FULL OUTER", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P16 = RequireTrue<P_FullJoin_Check>

// Test: LEFT OUTER JOIN
type P_LeftOuterJoin = ParseSQL<"SELECT * FROM users LEFT OUTER JOIN orders ON users.id = orders.user_id">
type P_LeftOuterJoin_Check = P_LeftOuterJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"LEFT OUTER", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P17 = RequireTrue<P_LeftOuterJoin_Check>

// Test: Multiple JOINs
type P_MultiJoin = ParseSQL<`
  SELECT u.id
  FROM users AS u
  LEFT JOIN orders AS o ON u.id = o.user_id
  LEFT JOIN products AS p ON o.product_id = p.id
`>
type P_MultiJoin_Check = P_MultiJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause, JoinClause] }
    ? true
    : false
    : false
type _P18 = RequireTrue<P_MultiJoin_Check>

// Test: Plain JOIN (treated as INNER)
type P_PlainJoin = ParseSQL<"SELECT * FROM users JOIN orders ON users.id = orders.user_id">
type P_PlainJoin_Check = P_PlainJoin extends SQLSelectQuery<infer Q>
    ? Q extends { joins: [JoinClause<"INNER", TableRef, ParsedCondition>] }
    ? true
    : false
    : false
type _P19 = RequireTrue<P_PlainJoin_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type JoinParserTestsPass = true
