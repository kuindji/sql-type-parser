/**
 * AST Type Tests
 *
 * Tests for AST type definitions and their structure.
 * If this file compiles without errors, all tests pass.
 */

import type {
    // Column references
    UnboundColumnRef,
    TableColumnRef,
    TableWildcard,
    ComplexExpr,
    ColumnRefType,
    ValidatableColumnRef,
    
    // Table references
    TableRef,
    DerivedTableRef,
    CTEDefinition,
    TableSource,
    
    // Expressions
    ComparisonOp,
    LogicalOp,
    LiteralValue,
    BinaryExpr,
    ParsedCondition,
    WhereExpr,
    
    // Joins
    JoinType,
    JoinClause,
    
    // Order by
    SortDirection,
    OrderByItem,
    
    // Aggregations
    AggregateFunc,
    AggregateExpr,
    
    // SELECT-specific
    SelectClause,
    SelectItem,
    ColumnRef,
    SubqueryExpr,
    SQLSelectQuery,
    UnionClause,
    UnionOperatorType,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, HasProperty } from "../helpers.js"

// ============================================================================
// Column Reference Type Tests
// ============================================================================

// Test: UnboundColumnRef structure
type UCR = UnboundColumnRef<"id">
type _UCR1 = RequireTrue<AssertEqual<UCR["type"], "UnboundColumnRef">>
type _UCR2 = RequireTrue<AssertEqual<UCR["column"], "id">>

// Test: TableColumnRef structure
type TCR = TableColumnRef<"users", "id", "public">
type _TCR1 = RequireTrue<AssertEqual<TCR["type"], "TableColumnRef">>
type _TCR2 = RequireTrue<AssertEqual<TCR["table"], "users">>
type _TCR3 = RequireTrue<AssertEqual<TCR["column"], "id">>
type _TCR4 = RequireTrue<AssertEqual<TCR["schema"], "public">>

// Test: TableWildcard structure
type TW = TableWildcard<"u", "public">
type _TW1 = RequireTrue<AssertEqual<TW["type"], "TableWildcard">>
type _TW2 = RequireTrue<AssertEqual<TW["table"], "u">>
type _TW3 = RequireTrue<AssertEqual<TW["schema"], "public">>

// Test: ComplexExpr structure
type CE = ComplexExpr<[UnboundColumnRef<"data">], "text">
type _CE1 = RequireTrue<AssertEqual<CE["type"], "ComplexExpr">>
type _CE2 = RequireTrue<AssertExtends<CE["columnRefs"], ValidatableColumnRef[]>>
type _CE3 = RequireTrue<AssertEqual<CE["castType"], "text">>

// ============================================================================
// Table Reference Type Tests
// ============================================================================

// Test: TableRef structure
type TR = TableRef<"users", "u", "public">
type _TR1 = RequireTrue<AssertEqual<TR["type"], "TableRef">>
type _TR2 = RequireTrue<AssertEqual<TR["table"], "users">>
type _TR3 = RequireTrue<AssertEqual<TR["alias"], "u">>
type _TR4 = RequireTrue<AssertEqual<TR["schema"], "public">>

// Test: TableSource union
type _TS1 = RequireTrue<AssertExtends<TableRef, TableSource>>
type _TS2 = RequireTrue<AssertExtends<DerivedTableRef, TableSource>>

// ============================================================================
// Expression Type Tests
// ============================================================================

// Test: LiteralValue structure
type LV = LiteralValue<"hello">
type _LV1 = RequireTrue<AssertEqual<LV["type"], "Literal">>
type _LV2 = RequireTrue<AssertEqual<LV["value"], "hello">>

// Test: BinaryExpr structure
type BE = BinaryExpr<UnboundColumnRef<"id">, "=", LiteralValue<1>>
type _BE1 = RequireTrue<AssertEqual<BE["type"], "BinaryExpr">>
type _BE2 = RequireTrue<AssertEqual<BE["operator"], "=">>

// Test: ParsedCondition structure
type PC = ParsedCondition<[UnboundColumnRef<"id">]>
type _PC1 = RequireTrue<AssertEqual<PC["type"], "ParsedCondition">>
type _PC2 = RequireTrue<AssertExtends<PC["columnRefs"], ValidatableColumnRef[]>>

// ============================================================================
// Comparison Operator Type Tests
// ============================================================================

// Test: ComparisonOp includes all expected operators
type _CO1 = RequireTrue<AssertExtends<"=", ComparisonOp>>
type _CO2 = RequireTrue<AssertExtends<"!=", ComparisonOp>>
type _CO3 = RequireTrue<AssertExtends<"<>", ComparisonOp>>
type _CO4 = RequireTrue<AssertExtends<"<", ComparisonOp>>
type _CO5 = RequireTrue<AssertExtends<">", ComparisonOp>>
type _CO6 = RequireTrue<AssertExtends<"<=", ComparisonOp>>
type _CO7 = RequireTrue<AssertExtends<">=", ComparisonOp>>
type _CO8 = RequireTrue<AssertExtends<"LIKE", ComparisonOp>>
type _CO9 = RequireTrue<AssertExtends<"ILIKE", ComparisonOp>>
type _CO10 = RequireTrue<AssertExtends<"IN", ComparisonOp>>
type _CO11 = RequireTrue<AssertExtends<"IS", ComparisonOp>>

// ============================================================================
// Join Type Tests
// ============================================================================

// Test: JoinType includes all expected types
type _JT1 = RequireTrue<AssertExtends<"INNER", JoinType>>
type _JT2 = RequireTrue<AssertExtends<"LEFT", JoinType>>
type _JT3 = RequireTrue<AssertExtends<"RIGHT", JoinType>>
type _JT4 = RequireTrue<AssertExtends<"FULL", JoinType>>
type _JT5 = RequireTrue<AssertExtends<"CROSS", JoinType>>
type _JT6 = RequireTrue<AssertExtends<"LEFT OUTER", JoinType>>
type _JT7 = RequireTrue<AssertExtends<"RIGHT OUTER", JoinType>>
type _JT8 = RequireTrue<AssertExtends<"FULL OUTER", JoinType>>

// Test: JoinClause structure
type JC = JoinClause<"LEFT", TableRef<"orders", "o">, ParsedCondition>
type _JC1 = RequireTrue<AssertEqual<JC["type"], "JoinClause">>
type _JC2 = RequireTrue<AssertEqual<JC["joinType"], "LEFT">>

// ============================================================================
// Order By Type Tests
// ============================================================================

// Test: SortDirection
type _SD1 = RequireTrue<AssertExtends<"ASC", SortDirection>>
type _SD2 = RequireTrue<AssertExtends<"DESC", SortDirection>>

// Test: OrderByItem structure
type OBI = OrderByItem<UnboundColumnRef<"name">, "DESC">
type _OBI1 = RequireTrue<AssertEqual<OBI["type"], "OrderByItem">>
type _OBI2 = RequireTrue<AssertEqual<OBI["direction"], "DESC">>

// ============================================================================
// Aggregate Type Tests
// ============================================================================

// Test: AggregateFunc
type _AF1 = RequireTrue<AssertExtends<"COUNT", AggregateFunc>>
type _AF2 = RequireTrue<AssertExtends<"SUM", AggregateFunc>>
type _AF3 = RequireTrue<AssertExtends<"AVG", AggregateFunc>>
type _AF4 = RequireTrue<AssertExtends<"MIN", AggregateFunc>>
type _AF5 = RequireTrue<AssertExtends<"MAX", AggregateFunc>>

// Test: AggregateExpr structure
type AE = AggregateExpr<"COUNT", "*", "total">
type _AE1 = RequireTrue<AssertEqual<AE["type"], "AggregateExpr">>
type _AE2 = RequireTrue<AssertEqual<AE["func"], "COUNT">>
type _AE3 = RequireTrue<AssertEqual<AE["argument"], "*">>
type _AE4 = RequireTrue<AssertEqual<AE["alias"], "total">>

// ============================================================================
// SELECT-specific Type Tests
// ============================================================================

// Test: ColumnRef structure
type CR = ColumnRef<UnboundColumnRef<"id">, "user_id">
type _CR1 = RequireTrue<AssertEqual<CR["type"], "ColumnRef">>
type _CR2 = RequireTrue<AssertEqual<CR["alias"], "user_id">>

// Test: SelectItem union
type _SI1 = RequireTrue<AssertExtends<ColumnRef, SelectItem>>
type _SI2 = RequireTrue<AssertExtends<AggregateExpr, SelectItem>>
type _SI3 = RequireTrue<AssertExtends<TableWildcard, SelectItem>>

// Test: SQLSelectQuery structure
type SSQ = SQLSelectQuery<SelectClause>
type _SSQ1 = RequireTrue<AssertEqual<SSQ["type"], "SQLQuery">>
type _SSQ2 = RequireTrue<AssertEqual<SSQ["queryType"], "SELECT">>

// ============================================================================
// Union Type Tests
// ============================================================================

// Test: UnionOperatorType
type _UO1 = RequireTrue<AssertExtends<"UNION", UnionOperatorType>>
type _UO2 = RequireTrue<AssertExtends<"UNION ALL", UnionOperatorType>>
type _UO3 = RequireTrue<AssertExtends<"INTERSECT", UnionOperatorType>>
type _UO4 = RequireTrue<AssertExtends<"INTERSECT ALL", UnionOperatorType>>
type _UO5 = RequireTrue<AssertExtends<"EXCEPT", UnionOperatorType>>
type _UO6 = RequireTrue<AssertExtends<"EXCEPT ALL", UnionOperatorType>>

// Test: UnionClause structure
type UC = UnionClause<SelectClause, "UNION", SelectClause>
type _UC1 = RequireTrue<AssertEqual<UC["type"], "UnionClause">>
type _UC2 = RequireTrue<AssertEqual<UC["operator"], "UNION">>

// ============================================================================
// Export for verification
// ============================================================================

export type ASTTestsPass = true

