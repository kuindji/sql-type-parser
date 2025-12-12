/**
 * SELECT Query Validator
 *
 * Re-exports all public types from the validator module.
 */

// Re-exports for convenience
export type { DatabaseSchema } from "../../common/schema.js";
export type { MatchError } from "../../common/utils.js";

// Validation types and options
export type { ValidateSelectOptions, DefaultValidateOptions } from "./types.js";

// Main entry point
export type { ValidateSelectSQL, ValidateQueryContent } from "./entry.js";

// Select clause validation
export type { ValidateSelectClause, ValidateAllClauses } from "./select-clause.js";

// Union clause validation
export type { ValidateUnionClause } from "./union.js";

// Context building
export type {
    BuildValidationContext,
    BuildCTEContext,
    BuildTableContext,
    ResolveTableSource,
    ResolveDerivedTable,
    ExpandAllColumns,
} from "./context.js";

// Column validators
export type {
    ValidateColumns,
    ValidateColumnList,
    ValidateSingleColumn,
    ValidateColumnRef,
    ValidateTableColumn,
    ValidateUnboundColumn,
    ValidateTableWildcard,
    ValidateAggregateArg,
} from "./column-validators.js";

// Clause validators
export type {
    ValidateWhereClause,
    ValidateHavingClause,
    ValidateGroupByClause,
    ValidateOrderByClause,
    ValidateJoinConditions,
    ValidateColumnRefList,
    ValidateColumnRefType,
} from "./clause-validators.js";
