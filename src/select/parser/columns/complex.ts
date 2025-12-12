/**
 * Complex expression parsing (JSON operators, concatenation, arithmetic, functions, etc.)
 */

import type { ColumnRef, SQLConstantName } from "../../ast.js";
import type {
    ComplexExpr,
    TableColumnRef,
    UnboundColumnRef,
    ValidatableColumnRef,
} from "../../../common/ast.js";
import type { NextToken } from "../../../common/tokenizer.js";
import type { Decrement, Increment, RemoveQuotes, Trim } from "../../../common/utils.js";
import type {
    ExtractBeforeCast,
    ExtractFinalCastType,
    HasTypeCast,
    IsSimpleIdentifier,
    SkipUntilClosingParen,
    StripAliasAndCast,
    StripTypeCast,
} from "./utils.js";

// ============================================================================
// Complex Expression Detection
// ============================================================================

/**
 * Check if this is a function call (pattern: identifier ( ... ))
 * Excludes aggregate functions which are handled separately
 * After normalization, functions look like: funcName ( args )
 */
export type IsFunctionCall<T extends string> =
    // Pattern: identifier ( ... where identifier is not a paren or comma
    Trim<T> extends `${infer Name} ( ${string}`
        ? Name extends "(" | ")" | "," ? false
        : true
        : false;

/**
 * Check if the expression is complex (contains JSON operators, concatenation, function calls,
 * nested parens, type casts, parameter placeholders, arithmetic, IS NULL/IS NOT NULL, etc.)
 */
export type IsComplexExpression<T extends string> = T extends
    `${string}->${string}` ? true
    : T extends `${string}->>${string}` ? true
    : T extends `${string}#>${string}` ? true
    : T extends `${string}#>>${string}` ? true
    : T extends `${string}||${string}` ? true
    : T extends `${string} || ${string}` ? true
    : T extends `( ${string}` ? true
    : IsFunctionCall<T> extends true ? true
    : HasTypeCast<T> extends true ? true
    : IsParameterRef<T> extends true ? true
    : IsArithmeticExpression<T> extends true ? true
    : IsNullCheckExpression<T> extends true ? true
    : false;

/**
 * Check if the expression contains IS NULL or IS NOT NULL
 */
export type IsNullCheckExpression<T extends string> = T extends
    `${string} IS NOT NULL${string}` ? true
    : T extends `${string} IS NULL${string}` ? true
    : false;

/**
 * Check if the expression is a parameter placeholder ($1, $2, :name)
 * Handles: $1, $1 AS alias, $1::type, $1::type AS alias
 */
export type IsParameterRef<T extends string> = StripAliasAndCast<Trim<T>> extends
    infer Base extends string ? Base extends `$${number}` ? true
    : Base extends `:${string}` ? true
    : false
    : false;

/**
 * Check if the expression contains arithmetic operators (+, -, *, /)
 * This catches expressions like: 1 + 1, a - b, etc.
 */
export type IsArithmeticExpression<T extends string> = T extends
    `${string} + ${string}` ? true
    : T extends `${string} - ${string}` ? true
    : T extends `${string} * ${string}` ? true
    : T extends `${string} / ${string}` ? true
    : T extends `${string} % ${string}` ? true
    : false;

// ============================================================================
// Complex Expression Parsing
// ============================================================================

/**
 * Helper to get the last alias in a chain of AS clauses
 */
type ComplexLastAlias<T extends string> = Trim<T> extends
    `${infer _Head} AS ${infer Rest}` ? ComplexLastAlias<Rest>
    : RemoveQuotes<Trim<T>>;

/**
 * Helper to get expression without the last alias
 */
type ComplexExprWithoutAlias<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Rest}`
    ? Rest extends `${infer _Inner} AS ${infer _RestTail}`
        ? ComplexExprWithoutAlias<`${Expr} AS ${Rest}`>
    : Trim<Expr>
    : Trim<T>;

/**
 * Parse a complex column expression
 * Extracts base column for validation and final cast type for result type
 */
export type ParseComplexColumn<T extends string> = ColumnRef<
    ParseComplexExpr<ComplexExprWithoutAlias<T>>,
    Trim<T> extends `${string} AS ${string}` ? ComplexLastAlias<T>
        : ExtractComplexColumnName<T>
>;

/**
 * Parse a complex expression into ComplexExpr AST
 * Extracts all column references for validation, the final cast type,
 * and stores the original expression for assembly
 */
type ParseComplexExpr<T extends string> = ComplexExpr<
    ExtractAllColumnRefs<T>,
    ExtractFinalCastType<T>,
    T
>;

// ============================================================================
// Column Reference Extraction
// ============================================================================

/**
 * Extract all column references from a complex expression
 * Scans token by token to find all column patterns
 */
export type ExtractAllColumnRefs<T extends string> = ScanTokensForColumnRefs<
    Trim<T>,
    []
>;

/**
 * Scan tokens one by one looking for column reference patterns
 * Skips function names (tokens followed by opening parenthesis)
 * Skips entire EXISTS/NOT EXISTS subqueries to avoid treating inner table names as column refs
 */
export type ScanTokensForColumnRefs<
    T extends string,
    Acc extends ValidatableColumnRef[],
    Depth extends number = 20,
> = Depth extends 0 ? Acc
    : Trim<T> extends "" ? Acc
    : NextToken<Trim<T>> extends
        [infer Token extends string, infer Rest extends string]
    // Check for EXISTS/NOT EXISTS - skip entire subquery content
        ? IsExistsToken<Token, Rest> extends true
            ? SkipExistsAndContinue<Token, Rest, Acc, Decrement<Depth>>
            // Skip function names: if the next token is "(", this token is a function name, not a column
        : IsFunctionName<Token, Rest> extends true
            ? ScanTokensForColumnRefs<Rest, Acc, Decrement<Depth>>
        : ExtractColumnFromToken<Token> extends infer ColRef
            // Must check [ColRef] extends [never] first because never extends everything
            ? [ColRef] extends [never]
                ? ScanTokensForColumnRefs<Rest, Acc, Decrement<Depth>>
            : ColRef extends ValidatableColumnRef ? ScanTokensForColumnRefs<
                    Rest,
                    [...Acc, ColRef],
                    Decrement<Depth>
                >
            : ScanTokensForColumnRefs<Rest, Acc, Decrement<Depth>>
        : ScanTokensForColumnRefs<Rest, Acc, Decrement<Depth>>
    : Acc;

/**
 * Check if we're at an EXISTS or NOT EXISTS token
 * EXISTS must be followed by (
 * NOT must be followed by EXISTS (
 */
type IsExistsToken<Token extends string, Rest extends string> = Token extends
    "EXISTS" ? NextToken<Trim<Rest>> extends ["(", string] ? true
    : false
    : Token extends "NOT"
        ? NextToken<Trim<Rest>> extends
            ["EXISTS", infer AfterExists extends string]
            ? NextToken<Trim<AfterExists>> extends ["(", string] ? true
            : false
        : false
    : false;

/**
 * Skip EXISTS/NOT EXISTS subquery and continue scanning
 * Finds the opening ( and skips until matching )
 */
type SkipExistsAndContinue<
    Token extends string,
    Rest extends string,
    Acc extends ValidatableColumnRef[],
    Depth extends number,
> = Token extends "NOT"
    // NOT EXISTS - skip NOT, EXISTS, then find and skip parenthesized content
    ? NextToken<Trim<Rest>> extends
        ["EXISTS", infer AfterExists extends string]
        ? NextToken<Trim<AfterExists>> extends
            ["(", infer AfterParen extends string]
            ? SkipUntilClosingParen<AfterParen, 1> extends
                infer Remainder extends string
                ? ScanTokensForColumnRefs<Remainder, Acc, Depth>
            : Acc
        : ScanTokensForColumnRefs<AfterExists, Acc, Depth>
    : ScanTokensForColumnRefs<Rest, Acc, Depth>
    // EXISTS - skip EXISTS, then find and skip parenthesized content
    : NextToken<Trim<Rest>> extends ["(", infer AfterParen extends string]
        ? SkipUntilClosingParen<AfterParen, 1> extends
            infer Remainder extends string
            ? ScanTokensForColumnRefs<Remainder, Acc, Depth>
        : Acc
    : ScanTokensForColumnRefs<Rest, Acc, Depth>;

/**
 * Check if a token is a function name (followed by opening parenthesis)
 * A token is a function name if:
 * 1. It's not a known SQL keyword or operator
 * 2. The next token is "("
 */
type IsFunctionName<Token extends string, Rest extends string> =
    // Skip known SQL keywords and operators that aren't function names
    Token extends
        | "("
        | ")"
        | ","
        | "AS"
        | "AND"
        | "OR"
        | "NOT"
        | "IN"
        | "IS"
        | "LIKE"
        | "ILIKE"
        | "BETWEEN"
        | "SELECT"
        | "FROM"
        | "WHERE"
        | "JOIN"
        | "ON"
        | "ORDER"
        | "BY"
        | "GROUP"
        | "HAVING"
        | "LIMIT"
        | "OFFSET" ? false
        : IsSimpleIdentifier<Token> extends true
            ? NextToken<Trim<Rest>> extends ["(", string] ? true
            : false
        : false;

// ============================================================================
// Token Column Extraction
// ============================================================================

/**
 * Try to extract a column reference from a single token
 * Handles: schema.table.col, alias."col", alias."col"::type, "table"."col", "col", "col"::type
 * Also handles unquoted: schema.table.col::type, table.col::type, col::type
 */
export type ExtractColumnFromToken<T extends string> =
    // First check for three-part identifier (schema.table.column)
    ExtractThreePartColumnRef<T> extends infer ThreePart
        ? [ThreePart] extends [never] ? ExtractTwoPartOrSimpleColumnRef<T>
        : ThreePart
        : never;

/**
 * Extract three-part column reference (schema.table.column)
 */
type ExtractThreePartColumnRef<T extends string> =
    // Pattern: "schema"."table"."column"::type
    T extends `"${infer Schema}"."${infer Table}"."${infer Col}"::${string}`
        ? TableColumnRef<Table, Col, Schema>
        : T extends `"${infer Schema}"."${infer Table}"."${infer Col}"`
            ? TableColumnRef<Table, Col, Schema>
        // Pattern: schema.table.column::type (unquoted)
        : T extends `${infer Schema}.${infer Table}.${infer Col}::${string}`
            ? IsSimpleIdentifier<Schema> extends true
                ? IsSimpleIdentifier<Table> extends true
                    ? TableColumnRef<Table, ExtractBeforeCast<Col>, Schema>
                : never
            : never
        // Pattern: schema.table.column (unquoted, no cast)
        : T extends `${infer Schema}.${infer Table}.${infer Col}`
            ? IsSimpleIdentifier<Schema> extends true
                ? IsSimpleIdentifier<Table> extends true
                    ? IsSimpleIdentifier<Col> extends true
                        ? TableColumnRef<Table, Col, Schema>
                    : never
                : never
            : never
        : never;

/**
 * Extract the base column from a JSON operator expression (recursively)
 * Handles nested JSON operators: config->'a'->>'b' -> config
 * e.g., config->>'settings' -> config, table.col->'key' -> table.col
 */
type ExtractBaseColumnFromJsonExpr<T extends string> =
    // Pattern: base->> or base->
    T extends `${infer Base}->>${string}` ? ExtractBaseColumnFromJsonExpr<Base> // Recurse in case there are more operators
        : T extends `${infer Base}->${string}`
            ? ExtractBaseColumnFromJsonExpr<Base>
        : T extends `${infer Base}#>>${string}`
            ? ExtractBaseColumnFromJsonExpr<Base>
        : T extends `${infer Base}#>${string}`
            ? ExtractBaseColumnFromJsonExpr<Base>
        : T; // No more operators, return as-is

/**
 * Extract column name from a potentially parenthesized and/or type-casted expression
 */
type ExtractColumnFromParenExpr<T extends string> =
    // Strip outer parentheses first
    Trim<T> extends `(${infer Inner})` ? ExtractColumnFromParenExpr<Trim<Inner>>
        // Strip type cast (::type)
        : Trim<T> extends `${infer Col}::${string}`
            ? ExtractColumnFromParenExpr<Trim<Col>>
        // Extract from quoted identifier
        : Trim<T> extends `"${infer Col}"` ? Col
        // Simple identifier
        : Trim<T>;

/**
 * Check if the token contains a JSON operator
 */
type HasJsonOperator<T extends string> = T extends `${string}->>${string}`
    ? true
    : T extends `${string}->${string}` ? true
    : T extends `${string}#>>${string}` ? true
    : T extends `${string}#>${string}` ? true
    : false;

/**
 * Extract two-part (table.column) or simple column reference
 */
type ExtractTwoPartOrSimpleColumnRef<T extends string> =
    // Pattern: alias."column"::type (with cast) - alias must be simple identifier
    T extends `${infer Alias}."${infer Col}"::${string}`
        ? IsSimpleIdentifier<Alias> extends true
            ? TableColumnRef<Alias, Col, undefined>
        : never
        // Pattern: alias."column" (no cast)
        : T extends `${infer Alias}."${infer Col}"`
            ? IsSimpleIdentifier<Alias> extends true
                ? TableColumnRef<Alias, Col, undefined>
            : never
        // Pattern: "table"."column"::type
        : T extends `"${infer Table}"."${infer Col}"::${string}`
            ? TableColumnRef<Table, Col, undefined>
        // Pattern: "table"."column"
        : T extends `"${infer Table}"."${infer Col}"`
            ? TableColumnRef<Table, Col, undefined>
        // Pattern: "column"::type (unbound column with cast)
        : T extends `"${infer Col}"::${string}` ? UnboundColumnRef<Col>
        // Pattern: "column" followed by JSON operator
        : T extends `"${infer Col}"->>${string}` ? UnboundColumnRef<Col>
        : T extends `"${infer Col}"->${string}` ? UnboundColumnRef<Col>
        : T extends `"${infer Col}"#>>${string}` ? UnboundColumnRef<Col>
        : T extends `"${infer Col}"#>${string}` ? UnboundColumnRef<Col>
        // Pattern: "column" (quoted simple column, no cast)
        : T extends `"${infer Col}"` ? UnboundColumnRef<Col>
        // Pattern: table.column::type (unquoted with cast) - but NOT schema.table.column
        : T extends `${infer Table}.${infer Col}::${string}`
            ? Col extends `${string}.${string}` ? never // This is schema.table.column, handled above
            : IsSimpleIdentifier<Table> extends true
                ? TableColumnRef<Table, ExtractBeforeCast<Col>, undefined>
            : never
        // Pattern: table.column with JSON operator (e.g., t.col->>'key')
        : T extends `${infer Table}.${infer Rest}`
            ? HasJsonOperator<Rest> extends true
                ? IsSimpleIdentifier<Table> extends true
                    ? ExtractBaseColumnFromJsonExpr<Rest> extends
                        infer BaseCol extends string
                        ? IsSimpleIdentifier<BaseCol> extends true
                            ? TableColumnRef<Table, BaseCol, undefined>
                        : never
                    : never
                : never
            : Rest extends `${string}.${string}` ? never // This is schema.table.column, handled above
            : IsSimpleIdentifier<Table> extends true
                ? IsSimpleIdentifier<Rest> extends true
                    ? TableColumnRef<Table, Rest, undefined>
                : never
            : never
        // Pattern: column with JSON operator (e.g., config->>'key') - MUST come before ::type pattern
        : HasJsonOperator<T> extends true
            ? ExtractBaseColumnFromJsonExpr<T> extends
                infer BaseCol extends string
                ? IsSimpleIdentifier<BaseCol> extends true
                    ? IsKeywordOrOperator<BaseCol> extends true ? never
                    : UnboundColumnRef<BaseCol>
                    // Handle parenthesized/casted expressions like ("config"::json)
                : ExtractColumnFromParenExpr<BaseCol> extends
                    infer ExtractedCol extends string
                    ? IsSimpleIdentifier<ExtractedCol> extends true
                        ? IsKeywordOrOperator<ExtractedCol> extends true ? never
                        : UnboundColumnRef<ExtractedCol>
                    : never
                : never
            : never
        // Pattern: column::type (unquoted simple column with cast) - after JSON check
        : T extends `${infer Col}::${string}`
            ? IsSimpleIdentifier<ExtractBeforeCast<Col>> extends true
                ? IsKeywordOrOperator<ExtractBeforeCast<Col>> extends true
                    ? never // Parameter placeholders ($1, :param) are values, not columns
                : UnboundColumnRef<ExtractBeforeCast<Col>>
            : never
        // Pattern: simple unquoted identifier (unbound column)
        : IsSimpleIdentifier<T> extends true
            ? IsKeywordOrOperator<T> extends true ? never // Skip SQL keywords and operators
            : UnboundColumnRef<T>
        : never;

// ============================================================================
// Keyword/Operator Detection
// ============================================================================

/**
 * Check if a string is a SQL keyword, operator, literal, or parameter placeholder
 * that should not be treated as a column
 */
export type IsKeywordOrOperator<T extends string> =
    // String literals (single-quoted values are values, not identifiers)
    T extends `'${string}'` ? true
        // SQL keywords (including function-specific keywords like FOR, USING)
        // Include both uppercase and lowercase for case-insensitive matching
        : T extends
            | "SELECT"
            | "FROM"
            | "WHERE"
            | "AND"
            | "OR"
            | "NOT"
            | "IN"
            | "IS"
            | "NULL"
            | "null"
            | "TRUE"
            | "true"
            | "FALSE"
            | "false"
            | "LIKE"
            | "ILIKE"
            | "BETWEEN"
            | "EXISTS"
            | "CASE"
            | "WHEN"
            | "THEN"
            | "ELSE"
            | "END"
            | "AS"
            | "ON"
            | "JOIN"
            | "LEFT"
            | "RIGHT"
            | "INNER"
            | "OUTER"
            | "FULL"
            | "CROSS"
            | "GROUP"
            | "BY"
            | "HAVING"
            | "ORDER"
            | "ASC"
            | "DESC"
            | "LIMIT"
            | "OFFSET"
            | "UNION"
            | "INTERSECT"
            | "EXCEPT"
            | "ALL"
            | "DISTINCT"
            | "COUNT"
            | "SUM"
            | "AVG"
            | "MIN"
            | "MAX"
            | "COALESCE"
            | "NULLIF"
            | "CAST"
            | "FOR"
            | "USING"
            | "WITH"
            | "OVER"
            | "PARTITION"
            | "ROWS"
            | "RANGE"
            | "PRECEDING"
            | "FOLLOWING"
            // INTERVAL and its unit keywords
            | "INTERVAL"
            | "YEAR"
            | "MONTH"
            | "DAY"
            | "HOUR"
            | "MINUTE"
            | "SECOND"
            | "MILLISECOND"
            | "MICROSECOND"
            | "YEARS"
            | "MONTHS"
            | "DAYS"
            | "HOURS"
            | "MINUTES"
            | "SECONDS"
            | "MILLISECONDS"
            | "MICROSECONDS"
            | "WEEK"
            | "WEEKS"
            | "TO"
            // NULLS FIRST/LAST for ORDER BY
            | "NULLS"
            | "FIRST"
            | "LAST"
            // EXTRACT field keywords (epoch, dow, doy, etc.)
            | "EPOCH"
            | "epoch"
            | "DOW"
            | "dow"
            | "DOY"
            | "doy"
            | "ISODOW"
            | "isodow"
            | "ISOYEAR"
            | "isoyear"
            | "QUARTER"
            | "quarter"
            | "TIMEZONE"
            | "timezone"
            | "TIMEZONE_HOUR"
            | "timezone_hour"
            | "TIMEZONE_MINUTE"
            | "timezone_minute" ? true
        // SQL constants (CURRENT_DATE, CURRENT_TIMESTAMP, etc.)
        : T extends SQLConstantName ? true
        // Comparison operators
        : T extends "=" | "!=" | "<>" | "<" | ">" | "<=" | ">=" ? true
        // Lowercase versions of keywords (after normalization some might be lowercased in certain contexts)
        : T extends
            | "for"
            | "from"
            | "using"
            | "with"
            | "over"
            | "partition"
            | "rows"
            | "range" ? true
        // Parameter placeholders ($1, $2, etc. or :name)
        : T extends `$${number}` | `$${string}` | `:${string}` ? true
        // Numeric literals
        : T extends `${number}` ? true
        : false;

// ============================================================================
// Column Name Extraction for Aliases
// ============================================================================

/**
 * Extract column name for complex expressions (for default alias)
 * For JSON operators, extracts the last key as the alias (without quotes)
 */
type ExtractComplexColumnName<T extends string> = T extends
    `${string} AS ${infer Alias}` ? RemoveQuotes<Alias>
    // Extract the last JSON key from the expression
    : ExtractJsonKeyForAlias<T> extends infer Key extends string
        ? Key extends "" ? "expr" : Key
    : "expr";

/**
 * Extract the JSON key from a JSON operator expression for use as alias
 */
type ExtractJsonKeyForAlias<T extends string> =
    // Strip any type cast at the end first
    StripTypeCast<T> extends infer Stripped extends string
        ? ExtractLastJsonKey<Stripped>
        : "";

/**
 * Extract the last JSON key from an expression (handles nested accessors)
 */
type ExtractLastJsonKey<T extends string> =
    // Pattern: ...->>'key' (last accessor with ->>)
    T extends `${string}->>'${infer Key}'` ? Key
        : T extends `${string}->>"${infer Key}"` ? Key
        : T extends `${string}->>${infer Key}`
            ? IsSimpleIdentifier<Key> extends true ? Key : ""
        // Pattern: ...->'key' (last accessor with ->)
        : T extends `${string}->'${infer Key}'` ? Key
        : T extends `${string}->"${infer Key}"` ? Key
        : T extends `${string}->${infer Key}`
            ? IsSimpleIdentifier<Key> extends true ? Key : ""
        // Pattern: ...#>>'key' (last accessor with #>>)
        : T extends `${string}#>>'${infer Key}'` ? Key
        : T extends `${string}#>>"${infer Key}"` ? Key
        // Pattern: ...#>'key' (last accessor with #>)
        : T extends `${string}#>'${infer Key}'` ? Key
        : T extends `${string}#>"${infer Key}"` ? Key
        : "";
