/**
 * Type-level SQL SELECT column parser
 *
 * This module handles parsing of column expressions in SELECT queries.
 * Includes aggregates, literals, complex expressions, wildcards, etc.
 */

import type { SelectItem } from "../../ast.js";
import type { SplitByComma } from "../../../common/tokenizer.js";
import type { ParseError, Trim } from "../../../common/utils.js";

// Import from sub-modules
import type { IsAggregate, ParseAggregateColumn } from "./aggregate.js";
import type { ParseSimpleColumnOptimized } from "./classify.js";

// ============================================================================
// Re-exports from sub-modules
// ============================================================================

// Utils exports
export type {
    IsSimpleIdentifier,
    StripTypeCast,
    HasTypeCast,
    ExtractBeforeCast,
    ExtractTypeName,
    ExtractFinalCastType,
    StripAliasAndCast,
    ExtractUntilClosingParen,
    ExtractParenthesizedContent,
    SkipUntilClosingParen,
    ExtractAliasFromRemainder,
    ExtractSubqueryCastType,
    ExtractColumnName,
} from "./utils.js";

// Reference exports
export type {
    ParseColumnRefType,
    ParseThreePartIdentifier,
} from "./reference.js";

// Wildcard exports
export type { IsTableWildcard, ParseTableWildcard } from "./wildcard.js";

// Aggregate exports
export type { IsAggregate, ParseAggregateColumn } from "./aggregate.js";

// Literal exports
export type {
    IsLiteralExpression,
    IsLiteralValue,
    ParseLiteralColumn,
    ParseLiteralExpr,
    ExtractLiteralAlias,
} from "./literal.js";

// SQL constant exports
export type {
    IsSQLConstantExpression,
    IsSQLConstant,
    ParseSQLConstantColumn,
    ParseSQLConstantExpr,
    ExtractSQLConstantAlias,
} from "./sql-constant.js";

// Interval exports
export type {
    IsIntervalExpression,
    ParseIntervalColumn,
} from "./interval.js";

// Cast exports
export type {
    IsCastExpression,
    ParseCastColumn,
} from "./cast.js";

// Exists exports
export type {
    IsExistsExpression,
    ParseExistsColumn,
} from "./exists.js";

// Subquery exports
export type {
    IsSubqueryExpression,
    ParseSubqueryColumn,
} from "./subquery.js";

// Complex expression exports
export type {
    IsFunctionCall,
    IsComplexExpression,
    IsNullCheckExpression,
    IsParameterRef,
    IsArithmeticExpression,
    ParseComplexColumn,
    ExtractAllColumnRefs,
    ScanTokensForColumnRefs,
    ExtractColumnFromToken,
    IsKeywordOrOperator,
} from "./complex.js";

// Classification exports
export type {
    ClassifyColumnType,
    ParseSimpleColumnOptimized,
    ParseSimpleColumnRef,
} from "./classify.js";

// ============================================================================
// Column Parsing - Main Entry Points
// ============================================================================

/**
 * Parse column list
 */
export type ParseColumns<T extends string> = Trim<T> extends "*" ? "*"
    : SplitByComma<Trim<T>> extends infer Parts extends string[]
        ? ParseColumnList<Parts>
    : ParseError<"Failed to split columns">;

/**
 * Parse a list of columns
 */
export type ParseColumnList<T extends string[]> = T extends [
    infer First extends string,
    ...infer Rest extends string[],
]
    ? ParseSingleColumn<First> extends infer Col
        ? Col extends ParseError<string> ? Col
        : Rest extends [] ? [Col]
        : ParseColumnList<Rest> extends infer RestCols
            ? RestCols extends ParseError<string> ? RestCols
            : RestCols extends SelectItem[] ? [Col, ...RestCols]
            : ParseError<"Invalid column list">
        : never
    : never
    : [];

/**
 * Parse a single column (could be aggregate, aliased, or simple)
 */
export type ParseSingleColumn<T extends string> = Trim<T> extends ""
    ? ParseError<"Empty column">
    : IsAggregate<Trim<T>> extends true ? ParseAggregateColumn<Trim<T>>
    : ParseSimpleColumnOptimized<Trim<T>>;
