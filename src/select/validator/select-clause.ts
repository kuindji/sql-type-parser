/**
 * Select Clause Validation
 *
 * Main validation for SELECT clauses including all subclauses.
 */

import type { SelectClause } from "../ast.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type { MatchError } from "../../common/utils.js";
import type { ValidateSelectOptions, DefaultValidateOptions } from "./types.js";
import type { BuildValidationContext } from "./context.js";
import type { ValidateColumns } from "./column-validators.js";
import type {
    ValidateGroupByClause,
    ValidateHavingClause,
    ValidateJoinConditions,
    ValidateOrderByClause,
    ValidateWhereClause,
} from "./clause-validators.js";

// ============================================================================
// Select Clause Validation
// ============================================================================

/**
 * Validate a SELECT clause
 *
 * This validates:
 * 1. The FROM clause table exists
 * 2. All JOIN tables exist
 * 3. All selected columns exist
 * 4. JOIN condition field references (when validateAllFields is true)
 * 5. WHERE clause field references (when validateAllFields is true)
 * 6. HAVING clause field references (when validateAllFields is true)
 * 7. GROUP BY field references (when validateAllFields is true)
 * 8. ORDER BY field references (when validateAllFields is true)
 */
export type ValidateSelectClause<
    Select,
    Schema extends DatabaseSchema,
    Options extends ValidateSelectOptions = DefaultValidateOptions,
> = Select extends SelectClause<
    infer Columns,
    infer From,
    infer Joins,
    infer Where,
    infer GroupBy,
    infer Having,
    infer OrderBy,
    infer _Limit,
    infer _Offset,
    infer _Distinct,
    infer CTEs
>
    ? BuildValidationContext<From, Joins, CTEs, Schema> extends infer Context
        ? Context extends MatchError<infer E> ? E
        : ValidateColumns<Columns, Context, Schema> extends infer ColResult
            ? ColResult extends true
                ? Options["validateAllFields"] extends false ? true // Skip full validation if disabled
                : ValidateAllClauses<
                    Joins,
                    Where,
                    GroupBy,
                    Having,
                    OrderBy,
                    Context,
                    Schema
                >
            : ColResult
        : "Column validation failed"
    : "Context building failed"
    : "Invalid SELECT clause";

/**
 * Validate all clause field references (JOIN ON, WHERE, GROUP BY, HAVING, ORDER BY)
 */
export type ValidateAllClauses<
    Joins,
    Where,
    GroupBy,
    Having,
    OrderBy,
    Context,
    Schema extends DatabaseSchema,
> = ValidateJoinConditions<Joins, Context, Schema> extends infer JoinResult
    ? JoinResult extends true
        ? ValidateWhereClause<Where, Context, Schema> extends infer WhereResult
            ? WhereResult extends true
                ? ValidateGroupByClause<GroupBy, Context, Schema> extends
                    infer GroupByResult
                    ? GroupByResult extends true
                        ? ValidateHavingClause<Having, Context, Schema> extends
                            infer HavingResult
                            ? HavingResult extends true
                                ? ValidateOrderByClause<
                                    OrderBy,
                                    Context,
                                    Schema
                                >
                            : HavingResult
                        : "HAVING validation failed"
                    : GroupByResult
                : "GROUP BY validation failed"
            : WhereResult
        : "WHERE validation failed"
    : JoinResult
    : "JOIN validation failed";
