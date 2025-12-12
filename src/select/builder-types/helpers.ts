/**
 * SELECT Query Builder - Type-Level State & Utilities
 *
 * This file re-exports all helper types from the helpers/ subdirectory.
 * The types are split into smaller modules for better maintainability:
 *
 * - state-tags.ts: Core builder state types (BuilderStateTag, BuilderSqlTag)
 * - string-utils.ts: String manipulation utilities
 * - schema-utils.ts: Schema helpers and column type resolution
 * - column-to-row.ts: Column to row conversion types
 * - clause-list.ts: Clause list manipulation types
 * - sql-updates.ts: SQL tag update types (With*Sql)
 * - sql-assembly.ts: SQL string assembly types
 * - column-validation.ts: Column validation helpers
 * - state-updates.ts: State update helpers
 */

// State tags and core types
export type {
    AnyBuilderSqlTag,
    AnyBuilderStateTag,
    BuilderSqlTag,
    BuilderStateTag,
    ClauseList,
    EmptyBuilderState,
    EmptySqlState,
    IsUnionSqlError,
    SqlClausePart,
    UnionColumnsError,
    UnionSqlError,
} from "./helpers/state-tags.js";

// String manipulation utilities
export type {
    CastReturnType,
    CastTarget,
    ColumnQuery,
    ExtractAlias,
    ExtractColumnIdentifier,
    ExtractFinalCast,
    ExprWithoutAlias,
    FirstToken,
    IsLiteralString,
    IsTuple,
    IsUnknown,
    NormalizeCastTarget,
    SplitAlias,
    StripAliasFromCast,
    StripAliasIdentifier,
    StripCast,
    StripCastParams,
    StripIdentifierQuotes,
    ToStringArray,
    TrimStr,
    UnionToIntersection,
} from "./helpers/string-utils.js";

// Schema utilities and column type resolution
export type {
    ColumnRow,
    ColumnTypeForExpr,
    ColumnTypeFromSchema,
    ColumnTypeFromTable,
    DefaultSchemaName,
    ExpressionType,
    ExtractAliasFromFrom,
    ExtractAliasFromJoins,
    ExtractTableName,
    ExtractTableSpecBeforeKeyword,
    ParseTableAlias,
    PrimaryTable,
    ResolveAliasToTable,
    ResolveTableForQualifiedColumn,
    SchemaTables,
    TableNameOf,
} from "./helpers/schema-utils.js";

// Column to row conversion
export type {
    AddColumnsForSchema,
    ColumnsArrayToRow,
    ColumnsToRow,
} from "./helpers/column-to-row.js";

// Clause list manipulation
export type {
    ClauseListOrUndefined,
    ClauseListStringOrUndefined,
    ClauseListToString,
    ClauseValueToString,
    ColsToString,
    ContextSqlFromTag,
    JoinClauseString,
    NormalizeClauseList,
    RemoveClausePart,
    SelectClauseString,
    UpsertClausePart,
} from "./helpers/clause-list.js";

// SQL tag updates
export type {
    ConditionalSqlUpdate,
    ConditionalStateUpdate,
    ConditionToSql,
    MergeConditionalState,
    OptionalizeNewKeys,
    StateFromSql,
    WithFromSql,
    WithGroupBySql,
    WithGroupBySqlInternal,
    WithHavingSql,
    WithHavingSqlInternal,
    WithJoinSql,
    WithLimitSql,
    WithNamedParamsSql,
    WithOffsetSql,
    WithOrderBySql,
    WithOrderBySqlInternal,
    WithoutJoinSql,
    WithoutSelectSql,
    WithSelectSql,
    WithWhereSql,
    WithWhereSqlInternal,
} from "./helpers/sql-updates.js";

// SQL assembly
export type {
    AppendClause,
    AppendClauseNoKeyword,
    AppendLimitClause,
    AppendOffsetClause,
    AssembleBuilderSql,
} from "./helpers/sql-assembly.js";

// Column validation
export type {
    _SimpleColumnValidWithFrom,
    ColumnBaseExpr,
    SimpleColumnValid,
    ValidColumn,
    ValidColumns,
} from "./helpers/column-validation.js";

// State updates
export type {
    WithFromForSchema,
    WithJoinContext,
} from "./helpers/state-updates.js";
