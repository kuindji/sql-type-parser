/**
 * Union Clause Validation
 *
 * Types for validating UNION queries.
 */

import type { SelectClause, UnionClause, UnionClauseAny } from "../ast.js";
import type { DatabaseSchema } from "../../common/schema.js";
import type { ValidateSelectOptions, DefaultValidateOptions } from "./types.js";
import type { ValidateSelectClause } from "./select-clause.js";

// ============================================================================
// Union Clause Validation
// ============================================================================

/**
 * Validate a union clause
 */
export type ValidateUnionClause<
    Union extends UnionClauseAny,
    Schema extends DatabaseSchema,
    Options extends ValidateSelectOptions = DefaultValidateOptions,
> = Union extends UnionClause<infer Left, infer _Op, infer Right>
    ? ValidateSelectClause<Left, Schema, Options> extends true
        ? Right extends UnionClauseAny
            ? ValidateUnionClause<Right, Schema, Options>
        : Right extends SelectClause
            ? ValidateSelectClause<Right, Schema, Options>
        : "Invalid right side of union"
    : ValidateSelectClause<Left, Schema, Options>
    : "Invalid union clause";
