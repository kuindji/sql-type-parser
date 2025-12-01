/**
 * AST Type Tests
 *
 * Tests for AST type definitions.
 * If this file compiles without errors, all tests pass.
 */

import type {
    SQLSelectQuery,
    SelectClause,
    SubquerySelectClause,
    ColumnRef,
    TableRef,
    DerivedTableRef,
    TableColumnRef,
    UnboundColumnRef,
    TableWildcard,
    ComplexExpr,
    SubqueryExpr,
    ValidatableColumnRef,
    ColumnRefType,
    ExtendedColumnRefType,
    TableSource,
    CTEDefinition,
    JoinClause,
    JoinType,
    OrderByItem,
    SortDirection,
    AggregateExpr,
    AggregateFunc,
    BinaryExpr,
    LogicalExpr,
    LogicalExprAny,
    LiteralValue,
    ComparisonOp,
    LogicalOp,
    WhereExpr,
    SelectItem,
    SelectColumns,
    UnionClauseAny,
} from "../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, HasProperty } from "./helpers.js"

// ============================================================================
// Column Reference Types Tests
// ============================================================================

// Test: UnboundColumnRef structure
type UCR_Structure = UnboundColumnRef<"id">
type _UCR1 = RequireTrue<AssertEqual<UCR_Structure["type"], "UnboundColumnRef">>
type _UCR2 = RequireTrue<AssertEqual<UCR_Structure["column"], "id">>

// Test: TableColumnRef structure
type TCR_Structure = TableColumnRef<"users", "id", "public">
type _TCR1 = RequireTrue<AssertEqual<TCR_Structure["type"], "TableColumnRef">>
type _TCR2 = RequireTrue<AssertEqual<TCR_Structure["table"], "users">>
type _TCR3 = RequireTrue<AssertEqual<TCR_Structure["column"], "id">>
type _TCR4 = RequireTrue<AssertEqual<TCR_Structure["schema"], "public">>

// Test: TableColumnRef without schema
type TCR_NoSchema = TableColumnRef<"users", "id", undefined>
type _TCR5 = RequireTrue<AssertEqual<TCR_NoSchema["schema"], undefined>>

// Test: TableWildcard structure
type TW_Structure = TableWildcard<"u", "public">
type _TW1 = RequireTrue<AssertEqual<TW_Structure["type"], "TableWildcard">>
type _TW2 = RequireTrue<AssertEqual<TW_Structure["table"], "u">>
type _TW3 = RequireTrue<AssertEqual<TW_Structure["schema"], "public">>

// Test: ComplexExpr structure
type CE_Structure = ComplexExpr<[UnboundColumnRef<"data">], "text">
type _CE1 = RequireTrue<AssertEqual<CE_Structure["type"], "ComplexExpr">>
type _CE2 = RequireTrue<AssertEqual<CE_Structure["castType"], "text">>

// Test: ColumnRef structure
type CR_Structure = ColumnRef<UnboundColumnRef<"id">, "user_id">
type _CR1 = RequireTrue<AssertEqual<CR_Structure["type"], "ColumnRef">>
type _CR2 = RequireTrue<AssertEqual<CR_Structure["alias"], "user_id">>

// Test: ValidatableColumnRef union
type VCR_Unbound = UnboundColumnRef<"x"> extends ValidatableColumnRef ? true : false
type _VCR1 = RequireTrue<VCR_Unbound>

type VCR_Table = TableColumnRef<"t", "c", undefined> extends ValidatableColumnRef ? true : false
type _VCR2 = RequireTrue<VCR_Table>

// Test: ColumnRefType union
type CRT_Includes = UnboundColumnRef extends ColumnRefType ? true : false
type _CRT1 = RequireTrue<CRT_Includes>

type CRT_Includes2 = TableColumnRef extends ColumnRefType ? true : false
type _CRT2 = RequireTrue<CRT_Includes2>

type CRT_Includes3 = TableWildcard extends ColumnRefType ? true : false
type _CRT3 = RequireTrue<CRT_Includes3>

type CRT_Includes4 = ComplexExpr extends ColumnRefType ? true : false
type _CRT4 = RequireTrue<CRT_Includes4>

// Test: ExtendedColumnRefType includes SubqueryExpr
type ECRT_Includes = SubqueryExpr extends ExtendedColumnRefType ? true : false
type _ECRT1 = RequireTrue<ECRT_Includes>

// ============================================================================
// Table Reference Types Tests
// ============================================================================

// Test: TableRef structure
type TR_Structure = TableRef<"users", "u", "public">
type _TR1 = RequireTrue<AssertEqual<TR_Structure["type"], "TableRef">>
type _TR2 = RequireTrue<AssertEqual<TR_Structure["table"], "users">>
type _TR3 = RequireTrue<AssertEqual<TR_Structure["alias"], "u">>
type _TR4 = RequireTrue<AssertEqual<TR_Structure["schema"], "public">>

// Test: DerivedTableRef structure
type DTR_Check = DerivedTableRef extends { type: "DerivedTableRef"; alias: string } ? true : false
type _DTR1 = RequireTrue<DTR_Check>

// Test: CTEDefinition structure
type CTE_Check = CTEDefinition extends { type: "CTEDefinition"; name: string } ? true : false
type _CTE1 = RequireTrue<CTE_Check>

// Test: TableSource union
type TS_TableRef = TableRef extends TableSource ? true : false
type _TS1 = RequireTrue<TS_TableRef>

type TS_Derived = DerivedTableRef extends TableSource ? true : false
type _TS2 = RequireTrue<TS_Derived>

// ============================================================================
// Expression Types Tests
// ============================================================================

// Test: ComparisonOp includes expected operators
type CO_Eq = "=" extends ComparisonOp ? true : false
type _CO1 = RequireTrue<CO_Eq>

type CO_Ne = "!=" extends ComparisonOp ? true : false
type _CO2 = RequireTrue<CO_Ne>

type CO_Lt = "<" extends ComparisonOp ? true : false
type _CO3 = RequireTrue<CO_Lt>

type CO_Like = "LIKE" extends ComparisonOp ? true : false
type _CO4 = RequireTrue<CO_Like>

type CO_In = "IN" extends ComparisonOp ? true : false
type _CO5 = RequireTrue<CO_In>

type CO_Is = "IS" extends ComparisonOp ? true : false
type _CO6 = RequireTrue<CO_Is>

// Test: LogicalOp
type LO_And = "AND" extends LogicalOp ? true : false
type _LO1 = RequireTrue<LO_And>

type LO_Or = "OR" extends LogicalOp ? true : false
type _LO2 = RequireTrue<LO_Or>

// Test: LiteralValue
type LV_String = LiteralValue<"hello">
type _LV1 = RequireTrue<AssertEqual<LV_String["type"], "Literal">>
type _LV2 = RequireTrue<AssertEqual<LV_String["value"], "hello">>

type LV_Number = LiteralValue<42>
type _LV3 = RequireTrue<AssertEqual<LV_Number["value"], 42>>

type LV_Bool = LiteralValue<true>
type _LV4 = RequireTrue<AssertEqual<LV_Bool["value"], true>>

type LV_Null = LiteralValue<null>
type _LV5 = RequireTrue<AssertEqual<LV_Null["value"], null>>

// Test: BinaryExpr structure
type BE_Structure = BinaryExpr<UnboundColumnRef<"id">, "=", LiteralValue<1>>
type _BE1 = RequireTrue<AssertEqual<BE_Structure["type"], "BinaryExpr">>
type _BE2 = RequireTrue<AssertEqual<BE_Structure["operator"], "=">>

// ============================================================================
// Join Types Tests
// ============================================================================

// Test: JoinType includes all join types
type JT_Inner = "INNER" extends JoinType ? true : false
type _JT1 = RequireTrue<JT_Inner>

type JT_Left = "LEFT" extends JoinType ? true : false
type _JT2 = RequireTrue<JT_Left>

type JT_Right = "RIGHT" extends JoinType ? true : false
type _JT3 = RequireTrue<JT_Right>

type JT_Full = "FULL" extends JoinType ? true : false
type _JT4 = RequireTrue<JT_Full>

type JT_Cross = "CROSS" extends JoinType ? true : false
type _JT5 = RequireTrue<JT_Cross>

type JT_LeftOuter = "LEFT OUTER" extends JoinType ? true : false
type _JT6 = RequireTrue<JT_LeftOuter>

// Test: JoinClause structure
type JC_Check = JoinClause extends { type: "JoinClause"; joinType: JoinType } ? true : false
type _JC1 = RequireTrue<JC_Check>

// ============================================================================
// Order By Types Tests
// ============================================================================

// Test: SortDirection
type SD_Asc = "ASC" extends SortDirection ? true : false
type _SD1 = RequireTrue<SD_Asc>

type SD_Desc = "DESC" extends SortDirection ? true : false
type _SD2 = RequireTrue<SD_Desc>

// Test: OrderByItem structure
type OBI_Check = OrderByItem extends { type: "OrderByItem"; direction: SortDirection } ? true : false
type _OBI1 = RequireTrue<OBI_Check>

// ============================================================================
// Aggregate Types Tests
// ============================================================================

// Test: AggregateFunc includes all functions
type AF_Count = "COUNT" extends AggregateFunc ? true : false
type _AF1 = RequireTrue<AF_Count>

type AF_Sum = "SUM" extends AggregateFunc ? true : false
type _AF2 = RequireTrue<AF_Sum>

type AF_Avg = "AVG" extends AggregateFunc ? true : false
type _AF3 = RequireTrue<AF_Avg>

type AF_Min = "MIN" extends AggregateFunc ? true : false
type _AF4 = RequireTrue<AF_Min>

type AF_Max = "MAX" extends AggregateFunc ? true : false
type _AF5 = RequireTrue<AF_Max>

// Test: AggregateExpr structure
type AE_Structure = AggregateExpr<"COUNT", "*", "total">
type _AE1 = RequireTrue<AssertEqual<AE_Structure["type"], "AggregateExpr">>
type _AE2 = RequireTrue<AssertEqual<AE_Structure["func"], "COUNT">>
type _AE3 = RequireTrue<AssertEqual<AE_Structure["argument"], "*">>
type _AE4 = RequireTrue<AssertEqual<AE_Structure["alias"], "total">>

// ============================================================================
// Select Types Tests
// ============================================================================

// Test: SelectItem union
type SI_ColumnRef = ColumnRef extends SelectItem ? true : false
type _SI1 = RequireTrue<SI_ColumnRef>

type SI_Aggregate = AggregateExpr extends SelectItem ? true : false
type _SI2 = RequireTrue<SI_Aggregate>

type SI_Wildcard = TableWildcard extends SelectItem ? true : false
type _SI3 = RequireTrue<SI_Wildcard>

// Test: SelectColumns is array
type SC_Array = SelectColumns extends SelectItem[] ? true : false
type _SC1 = RequireTrue<SC_Array>

// Test: SelectClause structure
type SC_Check = SelectClause extends {
    type: "SelectClause"
    columns: SelectColumns | "*"
    from: TableSource
    distinct: boolean
}
    ? true
    : false
type _SC2 = RequireTrue<SC_Check>

// Test: SubquerySelectClause has required properties
type SSC_Check = SubquerySelectClause extends { type: "SelectClause"; distinct: boolean } ? true : false
type _SSC1 = RequireTrue<SSC_Check>

// ============================================================================
// SQLSelectQuery Tests
// ============================================================================

// Test: SQLSelectQuery structure - can contain SelectClause or UnionClauseAny
type SQ_Check = SQLSelectQuery extends { type: "SQLQuery"; query: SelectClause | UnionClauseAny } ? true : false
type _SQ1 = RequireTrue<SQ_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type ASTTestsPass = true

