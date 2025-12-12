/**
 * Type-level schema matcher for SELECT queries
 *
 * Takes a parsed SQL SELECT AST and a database schema, returns the result row type.
 * This module handles SELECT-specific matching logic.
 */

// Re-exports for convenience (maintaining backwards compatibility)
export type { DatabaseSchema } from "../../common/schema.js";
export type { MatchError } from "../../common/utils.js";

// Main entry points
export type { MatchSelectClause, MatchSelectQuery } from "./main.js";

// Convenience types
export type { QueryResult, ValidateQuery, ValidateSQL } from "./query-result.js";

// Context building (exported for use by other modules)
export type {
    BuildCTEContext,
    BuildTableContext,
    BuildTableContextWithCTEs,
    FlattenContext,
    MergeJoinContexts,
    ResolveCTEQuery,
    ResolveDerivedTable,
    ResolveTableInSchema,
    ResolveTableRefOrCTE,
    ResolveTableSource,
} from "./context.js";

// Column matching (exported for use by other modules)
export type {
    ExtractColumnsAsObject,
    ExtractColumnListAsObject,
    ExtractSingleColumnAsObject,
    IsOptionalSelectItem,
    MatchColumnList,
    MatchColumns,
    MatchSingleColumn,
} from "./columns.js";

// Column resolution (exported for use by other modules)
export type {
    BuildSubqueryContext,
    ExpandAllColumns,
    FindColumnExists,
    FindColumnInContext,
    MatchSingleSubqueryColumn,
    MatchSubqueryColumns,
    MergeContexts,
    ResolveColumnRef,
    ResolveComplexExpr,
    ResolveLiteralExpr,
    ResolveSchemaTableColumn,
    ResolveSchemaTableWildcard,
    ResolveSQLConstant,
    ResolveSubqueryExpr,
    ResolveTableColumn,
    ResolveTableWildcard,
    ResolveUnboundColumn,
    ValidateAllColumnRefs,
    ValidateSchemaTableColumn,
    ValidateSingleColumnRef,
} from "./resolve.js";

// Aggregate types (exported for use by other modules)
export type { GetAggregateResultType } from "./aggregates.js";

// Union handling (exported for use by other modules)
export type {
    CombineUnionResults,
    IntersectResultType,
    MatchUnionClause,
    UnionResultType,
} from "./union.js";

// Utility types
export type { UnionToIntersection } from "./utils.js";
