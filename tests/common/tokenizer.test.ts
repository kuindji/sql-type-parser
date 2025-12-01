/**
 * Tokenizer Type Tests
 *
 * Tests for tokenization utilities: NormalizeSQL, NextToken, SplitByComma, etc.
 * If this file compiles without errors, all tests pass.
 */

import type {
    NormalizeSQL,
    NextToken,
    ExtractUntil,
    SplitByComma,
    FromTerminators,
    WhereTerminators,
    OrderByTerminators,
    StartsWith,
} from "../../src/index.js"
import type {
    CountOpen,
    CountClose,
    ParensBalanced,
} from "../../src/common/tokenizer.js"
import type { AssertEqual, RequireTrue } from "../helpers.js"

// ============================================================================
// NormalizeSQL Tests
// ============================================================================

// Test: Basic query normalization
type N_Basic = NormalizeSQL<"SELECT id FROM users">
type _N1 = RequireTrue<AssertEqual<N_Basic, "SELECT id FROM users">>

// Test: Lowercase keywords become uppercase
type N_Lowercase = NormalizeSQL<"select id from users">
type _N2 = RequireTrue<AssertEqual<N_Lowercase, "SELECT id FROM users">>

// Test: Mixed case keywords normalized
type N_MixedCase = NormalizeSQL<"Select Id From Users">
type _N3 = RequireTrue<AssertEqual<N_MixedCase, "SELECT Id FROM Users">>

// Test: Multiple spaces collapsed
type N_Spaces = NormalizeSQL<"SELECT   id   FROM   users">
type _N4 = RequireTrue<AssertEqual<N_Spaces, "SELECT id FROM users">>

// Test: Tabs replaced with spaces
type N_Tabs = NormalizeSQL<"SELECT\tid\tFROM\tusers">
type _N5 = RequireTrue<AssertEqual<N_Tabs, "SELECT id FROM users">>

// Test: Newlines replaced with spaces
type N_Newlines = NormalizeSQL<"SELECT\nid\nFROM\nusers">
type _N6 = RequireTrue<AssertEqual<N_Newlines, "SELECT id FROM users">>

// Test: Commas get spaces
type N_Commas = NormalizeSQL<"SELECT id,name,email FROM users">
type _N7 = RequireTrue<AssertEqual<N_Commas, "SELECT id , name , email FROM users">>

// Test: Parentheses get spaces
type N_Parens = NormalizeSQL<"SELECT COUNT(*) FROM users">
type _N8 = RequireTrue<AssertEqual<N_Parens, "SELECT COUNT ( * ) FROM users">>

// Test: All keywords normalized
type N_AllKeywords = NormalizeSQL<"select distinct id from users where active = true and role = 'admin' order by name limit 10">
type _N9 = RequireTrue<
    AssertEqual<
        N_AllKeywords,
        "SELECT DISTINCT id FROM users WHERE active = TRUE AND role = 'admin' ORDER BY name LIMIT 10"
    >
>

// Test: AS keyword followed by alias - alias should NOT be uppercased
type N_AsAlias = NormalizeSQL<"SELECT id AS userId FROM users">
type _N10 = RequireTrue<AssertEqual<N_AsAlias, "SELECT id AS userId FROM users">>

// Test: Multiple AS aliases preserve case
type N_MultiAlias = NormalizeSQL<"SELECT id AS userId, name AS userName FROM users">
type _N11 = RequireTrue<AssertEqual<N_MultiAlias, "SELECT id AS userId , name AS userName FROM users">>

// Test: JOIN keywords
type N_Join = NormalizeSQL<"SELECT * FROM users inner join orders on users.id = orders.user_id">
type _N12 = RequireTrue<
    AssertEqual<N_Join, "SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id">
>

// Test: GROUP BY and HAVING
type N_GroupHaving = NormalizeSQL<"SELECT role, count(*) FROM users group by role having count(*) > 5">
type _N13 = RequireTrue<
    AssertEqual<N_GroupHaving, "SELECT role , COUNT ( * ) FROM users GROUP BY role HAVING COUNT ( * ) > 5">
>

// Test: Aggregate functions
type N_Agg = NormalizeSQL<"SELECT count(*), sum(amount), avg(price), min(id), max(id) FROM data">
type _N14 = RequireTrue<
    AssertEqual<
        N_Agg,
        "SELECT COUNT ( * ) , SUM ( amount ) , AVG ( price ) , MIN ( id ) , MAX ( id ) FROM data"
    >
>

// Test: WITH clause
type N_With = NormalizeSQL<"with cte as (select id from users) select * from cte">
type _N15 = RequireTrue<AssertEqual<N_With, "WITH cte AS ( SELECT id FROM users ) SELECT * FROM cte">>

// ============================================================================
// NextToken Tests
// ============================================================================

// Test: Simple token extraction
type NT_Simple = NextToken<"SELECT id FROM users">
type _NT1 = RequireTrue<AssertEqual<NT_Simple, ["SELECT", "id FROM users"]>>

// Test: Last token
type NT_Last = NextToken<"users">
type _NT2 = RequireTrue<AssertEqual<NT_Last, ["users", ""]>>

// Test: Empty string
type NT_Empty = NextToken<"">
type _NT3 = RequireTrue<AssertEqual<NT_Empty, ["", ""]>>

// Test: Single space separated
type NT_Space = NextToken<"a b">
type _NT4 = RequireTrue<AssertEqual<NT_Space, ["a", "b"]>>

// Test: Multiple tokens
type NT_Multi = NextToken<"a b c d">
type _NT5 = RequireTrue<AssertEqual<NT_Multi, ["a", "b c d"]>>

// Test: Leading spaces trimmed
type NT_LeadingSpace = NextToken<"  SELECT id">
type _NT6 = RequireTrue<AssertEqual<NT_LeadingSpace, ["SELECT", "id"]>>

// ============================================================================
// StartsWith Tests
// ============================================================================

// Test: Starts with SELECT
type SW_Select = StartsWith<"SELECT id FROM users", "SELECT">
type _SW1 = RequireTrue<AssertEqual<SW_Select, true>>

// Test: Does not start with FROM
type SW_NotFrom = StartsWith<"SELECT id FROM users", "FROM">
type _SW2 = RequireTrue<AssertEqual<SW_NotFrom, false>>

// Test: Starts with WHERE
type SW_Where = StartsWith<"WHERE id = 1", "WHERE">
type _SW3 = RequireTrue<AssertEqual<SW_Where, true>>

// Test: Empty string
type SW_Empty = StartsWith<"", "SELECT">
type _SW4 = RequireTrue<AssertEqual<SW_Empty, false>>

// ============================================================================
// ExtractUntil Tests
// ============================================================================

// Test: Extract until FROM
type EU_From = ExtractUntil<"id, name, email FROM users", "FROM">
type _EU1 = RequireTrue<AssertEqual<EU_From, ["id, name, email", "FROM users"]>>

// Test: Extract until WHERE
type EU_Where = ExtractUntil<"users WHERE id = 1", "WHERE">
type _EU2 = RequireTrue<AssertEqual<EU_Where, ["users", "WHERE id = 1"]>>

// Test: No terminator found - returns all content
type EU_NoTerm = ExtractUntil<"id, name, email", "FROM">
type _EU3 = RequireTrue<AssertEqual<EU_NoTerm, ["id, name, email", ""]>>

// Test: Extract until FROM terminators
type EU_FromTerm = ExtractUntil<"users u WHERE id = 1", FromTerminators>
type _EU4 = RequireTrue<AssertEqual<EU_FromTerm, ["users u", "WHERE id = 1"]>>

// Test: Respects parenthesis depth
type EU_Parens = ExtractUntil<"( SELECT id FROM inner ) FROM outer", "FROM">
type _EU5 = RequireTrue<AssertEqual<EU_Parens, ["( SELECT id FROM inner )", "FROM outer"]>>

// ============================================================================
// SplitByComma Tests
// ============================================================================

// Test: Simple split
type SBC_Simple = SplitByComma<"a , b , c">
type _SBC1 = RequireTrue<AssertEqual<SBC_Simple, ["a", "b", "c"]>>

// Test: Single item (no comma)
type SBC_Single = SplitByComma<"a">
type _SBC2 = RequireTrue<AssertEqual<SBC_Single, ["a"]>>

// Test: Two items
type SBC_Two = SplitByComma<"a , b">
type _SBC3 = RequireTrue<AssertEqual<SBC_Two, ["a", "b"]>>

// Test: Empty string
type SBC_Empty = SplitByComma<"">
type _SBC4 = RequireTrue<AssertEqual<SBC_Empty, []>>

// Test: Respects parentheses - comma inside parens not split
type SBC_Parens = SplitByComma<"a , func ( b , c ) , d">
type _SBC5 = RequireTrue<AssertEqual<SBC_Parens, ["a", "func ( b , c )", "d"]>>

// Test: Nested parentheses
type SBC_Nested = SplitByComma<"a , func ( inner ( x , y ) ) , b">
type _SBC6 = RequireTrue<AssertEqual<SBC_Nested, ["a", "func ( inner ( x , y ) )", "b"]>>

// Test: Multiple columns with spaces
type SBC_Columns = SplitByComma<"id , name , email">
type _SBC7 = RequireTrue<AssertEqual<SBC_Columns, ["id", "name", "email"]>>

// ============================================================================
// CountOpen/CountClose Tests
// ============================================================================

// Test: Count open parentheses
type CO_One = CountOpen<"(a)">
type _CO1 = RequireTrue<AssertEqual<CO_One, 1>>

type CO_Two = CountOpen<"((a))">
type _CO2 = RequireTrue<AssertEqual<CO_Two, 2>>

type CO_Three = CountOpen<"(((a)))">
type _CO3 = RequireTrue<AssertEqual<CO_Three, 3>>

type CO_None = CountOpen<"abc">
type _CO4 = RequireTrue<AssertEqual<CO_None, 0>>

// Test: Count close parentheses
type CC_One = CountClose<"(a)">
type _CC1 = RequireTrue<AssertEqual<CC_One, 1>>

type CC_Two = CountClose<"((a))">
type _CC2 = RequireTrue<AssertEqual<CC_Two, 2>>

type CC_Three = CountClose<"(((a)))">
type _CC3 = RequireTrue<AssertEqual<CC_Three, 3>>

type CC_None = CountClose<"abc">
type _CC4 = RequireTrue<AssertEqual<CC_None, 0>>

// ============================================================================
// ParensBalanced Tests
// ============================================================================

// Test: Balanced parentheses
type PB_Balanced = ParensBalanced<"(a)">
type _PB1 = RequireTrue<AssertEqual<PB_Balanced, true>>

type PB_Nested = ParensBalanced<"((a))">
type _PB2 = RequireTrue<AssertEqual<PB_Nested, true>>

type PB_Multiple = ParensBalanced<"(a)(b)">
type _PB3 = RequireTrue<AssertEqual<PB_Multiple, true>>

type PB_Complex = ParensBalanced<"func(a, func2(b, c))">
type _PB4 = RequireTrue<AssertEqual<PB_Complex, true>>

// Test: Unbalanced parentheses
type PB_ExtraOpen = ParensBalanced<"((a)">
type _PB5 = RequireTrue<AssertEqual<PB_ExtraOpen, false>>

type PB_ExtraClose = ParensBalanced<"(a))">
type _PB6 = RequireTrue<AssertEqual<PB_ExtraClose, false>>

// Test: No parentheses is balanced
type PB_None = ParensBalanced<"abc">
type _PB7 = RequireTrue<AssertEqual<PB_None, true>>

// ============================================================================
// Terminator Type Tests
// ============================================================================

// Test: FromTerminators includes expected keywords
type FT_Where = "WHERE" extends FromTerminators ? true : false
type _FT1 = RequireTrue<FT_Where>

type FT_Join = "JOIN" extends FromTerminators ? true : false
type _FT2 = RequireTrue<FT_Join>

type FT_Left = "LEFT" extends FromTerminators ? true : false
type _FT3 = RequireTrue<FT_Left>

type FT_Order = "ORDER" extends FromTerminators ? true : false
type _FT4 = RequireTrue<FT_Order>

type FT_Group = "GROUP" extends FromTerminators ? true : false
type _FT5 = RequireTrue<FT_Group>

// Test: WhereTerminators
type WT_Order = "ORDER" extends WhereTerminators ? true : false
type _WT1 = RequireTrue<WT_Order>

type WT_Group = "GROUP" extends WhereTerminators ? true : false
type _WT2 = RequireTrue<WT_Group>

type WT_Limit = "LIMIT" extends WhereTerminators ? true : false
type _WT3 = RequireTrue<WT_Limit>

// Test: OrderByTerminators
type OT_Limit = "LIMIT" extends OrderByTerminators ? true : false
type _OT1 = RequireTrue<OT_Limit>

type OT_Offset = "OFFSET" extends OrderByTerminators ? true : false
type _OT2 = RequireTrue<OT_Offset>

// ============================================================================
// Export for verification
// ============================================================================

export type TokenizerTestsPass = true

