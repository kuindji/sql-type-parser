/**
 * Type-level SQL SELECT column parser
 *
 * This module handles parsing of column expressions in SELECT queries.
 * Includes aggregates, literals, complex expressions, wildcards, etc.
 */

import type {
    ColumnRef,
    ExistsExpr,
    ExtendedColumnRefType,
    IntervalExpr,
    LiteralExpr,
    SelectClause,
    SelectItem,
    SQLConstantExpr,
    SQLConstantName,
    SQLSelectQuery,
    SubqueryExpr,
} from "../ast.js";

import type {
    AggregateExpr,
    AggregateFunc,
    ColumnRefType,
    ComplexExpr,
    TableColumnRef,
    TableWildcard,
    UnboundColumnRef,
    ValidatableColumnRef,
} from "../../common/ast.js";

import type {
    NextToken,
    SplitByComma,
} from "../../common/tokenizer.js";

import type {
    Decrement,
    Increment,
    ParseError,
    RemoveQuotes,
    Trim,
} from "../../common/utils.js";

// Import ParseSelectQuery for subquery parsing
// TypeScript can handle circular type-only imports
import type { ParseSelectQuery } from "./index.js";

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

// ============================================================================
// Column Classification
// ============================================================================

/**
 * Classify a column expression by its first distinctive pattern.
 * This reduces the number of type guard evaluations from 12+ to ~3
 * by using first-character/pattern dispatch.
 *
 * IMPORTANT: Complex expressions check must happen before literal checks
 * because expressions like "1 + 1" start with a number but are complex.
 */
export type ClassifyColumnType<T extends string> =
    // Global wildcard
    T extends "*" ? "wildcard"
    // Table wildcard (t.* or schema.t.*)
    : T extends `${string}.*` | `${string}. *` ? "table_wildcard"
    // EXISTS/NOT EXISTS (check before complex since IsComplexExpression includes parens)
    : T extends `EXISTS ( ${string}` | `NOT EXISTS ( ${string}` ? "exists"
    // Scalar subquery (check before complex since IsComplexExpression includes parens)
    : T extends `( SELECT ${string}` ? "subquery"
    // CAST function (check before complex)
    : T extends `CAST ( ${string}` | `cast ( ${string}` ? "cast"
    // Complex expressions (JSON ops, concatenation, parens, functions, arithmetic)
    // Must be checked BEFORE literals because "1 + 1" starts with number
    : IsComplexExpression<T> extends true ? "complex"
    // SQL constants - check all patterns
    : IsSQLConstantExpression<T> extends true ? "sql_constant"
    // INTERVAL expressions - after complex check
    : T extends `INTERVAL ${string}` | `INTERVAL '${string}` ? "interval"
    // Numeric literals (including negative) - only if NOT complex
    : T extends `${number}${string}` | `-${number}${string}` ? "literal"
    // String literals
    : T extends `'${string}` ? "literal"
    // NULL, TRUE, FALSE
    : T extends `NULL${string}` | `TRUE${string}` | `FALSE${string}` ? "literal"
    // Default to simple column
    : "simple";

/**
 * Optimized column parser using first-character dispatch
 * Reduces type guard cascade from 12+ checks to classification + single dispatch
 */
type ParseSimpleColumnOptimized<T extends string> =
    ClassifyColumnType<T> extends infer Type
        ? Type extends "wildcard" ? TableWildcard<"*", undefined>
        : Type extends "table_wildcard" ? ParseTableWildcard<T>
        : Type extends "literal" ? ParseLiteralColumn<T>
        : Type extends "sql_constant" ? ParseSQLConstantColumn<T>
        : Type extends "interval" ? ParseIntervalColumn<T>
        : Type extends "exists" ? ParseExistsColumn<T>
        : Type extends "subquery" ? ParseSubqueryColumn<T>
        : Type extends "cast" ? ParseCastColumn<T>
        : Type extends "complex" ? ParseComplexColumn<T>
        : ParseSimpleColumnRef<T>
        : never;

/**
 * Parse a simple column reference with optional alias (no special expressions)
 */
type ParseSimpleColumnRef<T extends string> =
    T extends `${infer Col} AS ${infer Alias}` ? ColumnRef<
            ParseColumnRefType<StripTypeCast<Trim<Col>>>,
            RemoveQuotes<Alias>
        >
    : ColumnRef<
        ParseColumnRefType<StripTypeCast<T>>,
        ExtractColumnName<StripTypeCast<T>>
    >;

// ============================================================================
// Aggregate Function Parsing
// ============================================================================

/**
 * Check if a column is an aggregate function
 */
export type IsAggregate<T extends string> = T extends `COUNT ${string}` ? true
    : T extends `SUM ${string}` ? true
    : T extends `AVG ${string}` ? true
    : T extends `MIN ${string}` ? true
    : T extends `MAX ${string}` ? true
    : false;

/**
 * Parse an aggregate function column
 */
type ParseAggregateColumn<T extends string> = T extends
    `${infer Func} ( ${infer Arg} ) AS ${infer Alias}`
    ? Func extends AggregateFunc
        ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
    : ParseError<`Unknown aggregate function: ${Func}`>
    : T extends `${infer Func} ( ${infer Arg} )`
        ? Func extends AggregateFunc
            ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
        : ParseError<`Unknown aggregate function: ${Func}`>
    : ParseError<`Invalid aggregate syntax: ${T}`>;

/**
 * Parse aggregate function argument
 */
type ParseAggregateArg<T extends string> = Trim<T> extends "*" ? "*"
    : ParseColumnRefType<Trim<T>>;

// ============================================================================
// Literal Expression Parsing
// ============================================================================

/**
 * Check if the expression is a literal value (number, string, null, boolean)
 * Examples: 1, 42, 'hello', 'world', NULL, TRUE, FALSE
 */
type IsLiteralExpression<T extends string> =
    // Check with alias first
    Trim<T> extends `${infer Expr} AS ${string}` ? IsLiteralValue<Trim<Expr>>
        : IsLiteralValue<Trim<T>>;

/**
 * Check if the value is a literal
 */
type IsLiteralValue<T extends string> =
    // Numeric literals
    T extends `${number}` ? true
        // Negative numeric literals
        : T extends `-${number}` ? true
        // String literals (single-quoted)
        : T extends `'${string}'` ? true
        // NULL literal
        : T extends "NULL" ? true
        // Boolean literals
        : T extends "TRUE" | "FALSE" ? true
        : false;

/**
 * Parse a literal column expression
 * Handles: 1 AS num, 'hello' AS str, NULL AS nothing, TRUE AS flag
 */
type ParseLiteralColumn<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseLiteralExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseLiteralExpr<Trim<T>>, ExtractLiteralAlias<Trim<T>>>;

/**
 * Parse a literal expression into a LiteralExpr AST node
 */
type ParseLiteralExpr<T extends string> =
    // NULL literal
    T extends "NULL" ? LiteralExpr<null>
        // Boolean TRUE
        : T extends "TRUE" ? LiteralExpr<true>
        // Boolean FALSE
        : T extends "FALSE" ? LiteralExpr<false>
        // String literal (single-quoted)
        : T extends `'${infer Str}'` ? LiteralExpr<Str>
        // Negative number literal
        : T extends `-${infer Num extends number}` ? LiteralExpr<
                `-${Num}` extends `${infer N extends number}` ? N : number
            >
        // Positive number literal
        : T extends `${infer Num extends number}` ? LiteralExpr<Num>
        : LiteralExpr<string | number | boolean | null>;

/**
 * Extract a default alias for a literal (returns a descriptive name)
 */
type ExtractLiteralAlias<T extends string> = T extends "NULL" ? "null"
    : T extends "TRUE" | "FALSE" ? "bool"
    : T extends `'${string}'` ? "text"
    : T extends `${number}` | `-${number}` ? "int4"
    : "literal";

// ============================================================================
// SQL Constant Parsing
// ============================================================================

/**
 * Check if the expression is a SQL constant (CURRENT_DATE, CURRENT_TIMESTAMP, etc.)
 * These are special SQL keywords that return typed values without function call syntax
 */
type IsSQLConstantExpression<T extends string> =
    // Check with alias first
    Trim<T> extends `${infer Expr} AS ${string}` ? IsSQLConstant<Trim<Expr>>
        : IsSQLConstant<Trim<T>>;

/**
 * Check if the value is a SQL constant
 */
type IsSQLConstant<T extends string> = T extends SQLConstantName ? true : false;

/**
 * Parse a SQL constant column expression
 * Handles: CURRENT_DATE AS dt, CURRENT_TIMESTAMP AS ts, etc.
 */
type ParseSQLConstantColumn<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseSQLConstantExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<
        ParseSQLConstantExpr<Trim<T>>,
        ExtractSQLConstantAlias<Trim<T>>
    >;

/**
 * Parse a SQL constant expression into a SQLConstantExpr AST node
 */
type ParseSQLConstantExpr<T extends string> = T extends SQLConstantName
    ? SQLConstantExpr<T>
    : SQLConstantExpr<SQLConstantName>;

/**
 * Extract a default alias for a SQL constant (returns the lowercase name)
 */
type ExtractSQLConstantAlias<T extends string> = T extends "CURRENT_DATE"
    ? "current_date"
    : T extends "CURRENT_TIME" ? "current_time"
    : T extends "CURRENT_TIMESTAMP" ? "current_timestamp"
    : T extends "LOCALTIME" ? "localtime"
    : T extends "LOCALTIMESTAMP" ? "localtimestamp"
    : T extends "CURRENT_USER" ? "current_user"
    : T extends "SESSION_USER" ? "session_user"
    : T extends "CURRENT_CATALOG" ? "current_catalog"
    : T extends "CURRENT_SCHEMA" ? "current_schema"
    : T extends "CURRENT_ROLE" ? "current_role"
    : "constant";

// ============================================================================
// INTERVAL Expression Parsing
// ============================================================================

/**
 * Check if the expression is a PostgreSQL INTERVAL expression
 * Patterns: INTERVAL 'value', INTERVAL 'value' unit, INTERVAL 'value' unit TO unit
 */
type IsIntervalExpression<T extends string> = Trim<T> extends
    `INTERVAL '${string}'${string}` ? true
    : Trim<T> extends `INTERVAL '${string}'` ? true
    : false;

/**
 * Parse an INTERVAL column expression
 * Creates an IntervalExpr with the interval value
 */
type ParseIntervalColumn<T extends string> =
    ExtractIntervalWithAlias<Trim<T>> extends [
        infer IntervalResult extends ExtendedColumnRefType,
        infer Alias extends string,
    ] ? ColumnRef<IntervalResult, Alias>
        : ColumnRef<IntervalExpr<string>, "interval">;

/**
 * Extract INTERVAL expression and optional alias
 * Returns [IntervalExpr, alias]
 */
type ExtractIntervalWithAlias<T extends string> =
    // Pattern: INTERVAL 'value' ... AS alias (with potential units before AS)
    T extends `INTERVAL '${infer Value}' ${infer Rest}`
        ? ExtractIntervalAliasFromRest<Rest> extends infer Alias extends string
            ? [IntervalExpr<Value>, Alias]
        : [IntervalExpr<Value>, "interval"]
        // Pattern: INTERVAL 'value' (no unit, no alias)
        : T extends `INTERVAL '${infer Value}'`
            ? [IntervalExpr<Value>, "interval"]
        : [IntervalExpr<string>, "interval"];

/**
 * Extract alias from remainder after INTERVAL value
 * Handles: "DAY", "DAY AS alias", "DAY TO MONTH", "DAY TO MONTH AS alias", "AS alias"
 */
type ExtractIntervalAliasFromRest<T extends string> =
    // Direct alias: AS alias
    Trim<T> extends `AS ${infer AliasRest}`
        ? NextToken<Trim<AliasRest>> extends
            [infer Alias extends string, infer _Rest extends string]
            ? RemoveQuotes<Alias>
        : "interval"
        // Unit followed by AS alias: UNIT AS alias or UNIT TO UNIT AS alias
        : Trim<T> extends `${string} AS ${infer AliasRest}`
            ? NextToken<Trim<AliasRest>> extends
                [infer Alias extends string, infer _Rest extends string]
                ? RemoveQuotes<Alias>
            : "interval"
        // No alias, just unit(s)
        : "interval";

// ============================================================================
// CAST Expression Parsing
// ============================================================================

/**
 * Check if the expression is a CAST function
 * CAST ( expr AS type ) - note: AS inside CAST is different from column alias AS
 */
type IsCastExpression<T extends string> = Trim<T> extends `CAST ( ${string}`
    ? true
    : Trim<T> extends `cast ( ${string}` ? true
    : false;

/**
 * Parse a CAST expression column
 * Handles: CAST ( expr AS type ) AS alias
 */
type ParseCastColumn<T extends string> =
    // Pattern: CAST ( expr AS type ) AS alias
    ExtractCastContent<Trim<T>> extends [
        infer CastExpr extends string,
        infer CastType extends string,
        infer Rest extends string,
    ]
        ? Trim<Rest> extends `AS ${infer Alias}`
            ? ColumnRef<ParseCastExpr<CastExpr, CastType>, RemoveQuotes<Alias>>
        : ColumnRef<
            ParseCastExpr<CastExpr, CastType>,
            ExtractCastAlias<CastExpr>
        >
        : ColumnRef<ComplexExpr<[], undefined>, "cast">;

/**
 * Parse the CAST expression into a ComplexExpr with the cast type
 */
type ParseCastExpr<Expr extends string, CastType extends string> = ComplexExpr<
    ExtractAllColumnRefs<Expr>,
    CastType,
    `CAST ( ${Expr} AS ${CastType} )`
>;

/**
 * Extract alias from CAST expression (use the expression name or "cast")
 */
type ExtractCastAlias<Expr extends string> = Trim<Expr> extends
    `${infer _}.${infer Col}` ? Col
    : Trim<Expr> extends "" ? "cast"
    : Trim<Expr>;

/**
 * Extract content from a CAST expression
 * Input: "CAST ( expr AS type ) rest" or "cast ( expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastContent<T extends string> =
    // Remove CAST keyword (case-insensitive after normalization)
    Trim<T> extends `CAST ( ${infer Content}` ? ExtractCastParts<Content>
        : Trim<T> extends `cast ( ${infer Content}` ? ExtractCastParts<Content>
        : never;

/**
 * Extract expression and type from inside CAST parentheses
 * Input: "expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastParts<T extends string> =
    // Find the AS keyword that separates expr from type
    T extends `${infer Expr} AS ${infer TypeAndRest}`
        ? ExtractCastType<TypeAndRest> extends
            [infer CastType extends string, infer Rest extends string]
            ? [Trim<Expr>, Trim<CastType>, Trim<Rest>]
        : never
        : never;

/**
 * Extract the type and remainder after the closing paren
 * Input: "text ) AS alias" or "varchar ( 255 ) ) rest"
 * Returns: [type, rest]
 */
type ExtractCastType<T extends string> =
    // Handle type with precision: varchar ( 255 ) )
    T extends `${infer Type} ( ${infer Precision} ) ) ${infer Rest}`
        ? [`${Trim<Type>}(${Trim<Precision>})`, Rest]
        : T extends `${infer Type} ( ${infer Precision} ) )`
            ? [`${Trim<Type>}(${Trim<Precision>})`, ""]
        // Simple type: text )
        : T extends `${infer Type} ) ${infer Rest}` ? [Trim<Type>, Rest]
        : T extends `${infer Type} )` ? [Trim<Type>, ""]
        : never;

// ============================================================================
// EXISTS Expression Parsing
// ============================================================================

/**
 * Check if the expression is EXISTS or NOT EXISTS
 * Patterns: EXISTS ( SELECT ..., NOT EXISTS ( SELECT ...
 */
type IsExistsExpression<T extends string> = Trim<T> extends
    `EXISTS ( SELECT ${string}` ? true
    : Trim<T> extends `NOT EXISTS ( SELECT ${string}` ? true
    : false;

/**
 * Parse an EXISTS/NOT EXISTS column expression
 * Creates an ExistsExpr with the inner subquery
 */
type ParseExistsColumn<T extends string> =
    ExtractExistsWithAlias<Trim<T>> extends [
        infer ExistsResult extends ExtendedColumnRefType,
        infer Alias extends string,
    ] ? ColumnRef<ExistsResult, Alias>
        : ColumnRef<ComplexExpr<[], undefined>, "exists">;

/**
 * Extract EXISTS expression and optional alias
 * Returns [ExistsExpr | ComplexExpr, alias]
 */
type ExtractExistsWithAlias<T extends string> =
    // NOT EXISTS pattern with alias
    Trim<T> extends `NOT EXISTS ( ${infer Rest}`
        ? ExtractExistsInnerAndAlias<Rest, true>
        // EXISTS pattern with alias
        : Trim<T> extends `EXISTS ( ${infer Rest}`
            ? ExtractExistsInnerAndAlias<Rest, false>
        : [ComplexExpr<[], undefined>, "exists"];

/**
 * Extract the inner SELECT and alias from EXISTS expression
 * Input: Rest starts after "EXISTS ( " or "NOT EXISTS ( "
 */
type ExtractExistsInnerAndAlias<Rest extends string, Negated extends boolean> =
    ExtractUntilClosingParen<Rest, 1, ""> extends
        [infer Inner extends string, infer Remainder extends string]
        ? ParseExistsInnerQuery<Inner, Negated> extends infer Result
            ? ExtractAliasFromRemainder<Remainder> extends
                infer Alias extends string ? [Result, Alias]
            : [Result, "exists"]
        : [ComplexExpr<[], undefined>, "exists"]
        : [ComplexExpr<[], undefined>, "exists"];

/**
 * Parse the inner SELECT query for EXISTS
 */
type ParseExistsInnerQuery<Inner extends string, Negated extends boolean> =
    ParseSelectQuery<Inner> extends
        SQLSelectQuery<infer Query extends SelectClause>
        ? ExistsExpr<Query, Negated>
        : ComplexExpr<[], undefined>;

/**
 * Extract alias from remainder after closing paren
 * Remainder might be: "" or " AS alias" or " AS alias rest"
 */
export type ExtractAliasFromRemainder<T extends string> = Trim<T> extends
    `AS ${infer AliasRest}`
    ? NextToken<AliasRest> extends
        [infer Alias extends string, infer _Rest extends string]
        ? RemoveQuotes<Alias>
    : "exists"
    : "exists";

// ============================================================================
// Subquery Expression Parsing
// ============================================================================

/**
 * Check if the expression is a scalar subquery (starts with parenthesized SELECT)
 */
type IsSubqueryExpression<T extends string> = Trim<T> extends
    `( SELECT ${string}` ? true : false;

/**
 * Parse a scalar subquery column expression
 * Extracts the inner SELECT, parses it, and creates a SubqueryExpr
 */
type ParseSubqueryColumn<T extends string> = T extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseSubqueryExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseSubqueryExpr<T>, "subquery">;

/**
 * Parse a subquery expression, extracting the SELECT from parentheses
 */
type ParseSubqueryExpr<T extends string> =
    ExtractParenthesizedContent<Trim<T>> extends
        [infer Inner extends string, infer Remainder extends string]
        ? ParseSelectQuery<Inner> extends
            SQLSelectQuery<infer Query extends SelectClause>
            ? SubqueryExpr<Query, ExtractSubqueryCastType<Remainder>>
        : ParseSelectQuery<Inner> extends ParseError<infer E>
            ? ComplexExpr<[], undefined> // Fallback to unknown on parse error
        : ComplexExpr<[], undefined>
        : ComplexExpr<[], undefined>;

/**
 * Extract the cast type that may follow a subquery's closing parenthesis
 * e.g., ")::text" -> "text"
 */
export type ExtractSubqueryCastType<T extends string> = Trim<T> extends
    `::${infer Type} ${string}` ? ExtractTypeName<Type>
    : Trim<T> extends `::${infer Type}` ? ExtractTypeName<Type>
    : undefined;

/**
 * Extract content from balanced parentheses
 * Returns [inner content, remainder after closing paren]
 */
export type ExtractParenthesizedContent<T extends string> = Trim<T> extends
    `( ${infer Rest}` ? ExtractUntilClosingParen<Rest, 1, "">
    : never;

// ============================================================================
// Complex Expression Parsing
// ============================================================================

/**
 * Check if this is a function call (pattern: identifier ( ... ))
 * Excludes aggregate functions which are handled separately
 * After normalization, functions look like: funcName ( args )
 */
type IsFunctionCall<T extends string> =
    // Pattern: identifier ( ... where identifier is not a paren or comma
    Trim<T> extends `${infer Name} ( ${string}`
        ? Name extends "(" | ")" | "," ? false
        : true
        : false;

/**
 * Check if the expression is complex (contains JSON operators, concatenation, function calls,
 * nested parens, type casts, parameter placeholders, arithmetic, IS NULL/IS NOT NULL, etc.)
 */
export type IsComplexExpression<T extends string> = T extends `${string}->${string}`
    ? true
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
type IsNullCheckExpression<T extends string> = T extends
    `${string} IS NOT NULL${string}` ? true
    : T extends `${string} IS NULL${string}` ? true
    : false;

/**
 * Check if the expression is a parameter placeholder ($1, $2, :name)
 * Handles: $1, $1 AS alias, $1::type, $1::type AS alias
 */
type IsParameterRef<T extends string> = StripAliasAndCast<Trim<T>> extends
    infer Base extends string ? Base extends `$${number}` ? true
    : Base extends `:${string}` ? true
    : false
    : false;

/**
 * Strip alias and type cast from expression
 */
type StripAliasAndCast<T extends string> = T extends
    `${infer Expr} AS ${string}` ? StripTypeCast<Trim<Expr>>
    : StripTypeCast<T>;

/**
 * Check if the expression contains arithmetic operators (+, -, *, /)
 * This catches expressions like: 1 + 1, a - b, etc.
 */
type IsArithmeticExpression<T extends string> = T extends
    `${string} + ${string}` ? true
    : T extends `${string} - ${string}` ? true
    : T extends `${string} * ${string}` ? true
    : T extends `${string} / ${string}` ? true
    : T extends `${string} % ${string}` ? true
    : false;

/**
 * Check if the expression contains a type cast (::type)
 */
type HasTypeCast<T extends string> = T extends `${string}::${string}` ? true
    : false;

/**
 * Parse a complex column expression
 * Extracts base column for validation and final cast type for result type
 */
type ComplexLastAlias<T extends string> = Trim<T> extends
    `${infer _Head} AS ${infer Rest}` ? ComplexLastAlias<Rest>
    : RemoveQuotes<Trim<T>>;

type ComplexExprWithoutAlias<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Rest}`
    ? Rest extends `${infer _Inner} AS ${infer _RestTail}`
        ? ComplexExprWithoutAlias<`${Expr} AS ${Rest}`>
    : Trim<Expr>
    : Trim<T>;

type ParseComplexColumn<T extends string> = ColumnRef<
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

/**
 * Extract all column references from a complex expression
 * Scans token by token to find all column patterns
 */
type ExtractAllColumnRefs<T extends string> = ScanTokensForColumnRefs<
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
 * Skip tokens until we find the matching closing parenthesis
 * Returns the string after the closing paren
 */
type SkipUntilClosingParen<
    T extends string,
    Depth extends number,
> = Depth extends 0 ? T
    : NextToken<Trim<T>> extends
        [infer Token extends string, infer Rest extends string]
        ? Token extends "(" ? SkipUntilClosingParen<Rest, Increment<Depth>>
        : Token extends ")" ? SkipUntilClosingParen<Rest, Decrement<Depth>>
        : SkipUntilClosingParen<Rest, Depth>
    : "";

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

/**
 * Check if a string is a SQL keyword, operator, literal, or parameter placeholder
 * that should not be treated as a column
 */
type IsKeywordOrOperator<T extends string> =
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

/**
 * Extract the column name before the :: cast operator
 */
type ExtractBeforeCast<T extends string> = T extends `${infer Name}::${string}`
    ? Name
    : T;

/**
 * Check if a string is a simple identifier (no spaces, not a special char)
 */
export type IsSimpleIdentifier<T extends string> = T extends "" ? false
    : T extends `${string} ${string}` ? false
    : T extends
        "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" | "<" | ">" | "!" | "||"
        ? false
    // Exclude string literal parts (tokens that start or end with single quotes)
    : T extends `'${string}` ? false
    : T extends `${string}'` ? false
    // Exclude number literals
    : T extends `${number}` ? false
    : true;

/**
 * Extract the final type cast from an expression
 */
type ExtractFinalCastType<T extends string> =
    // Match ) ::type AS alias at the end
    Trim<T> extends `${string}) ::${infer Type} AS ${string}`
        ? ExtractTypeName<Type>
        // Match ) ::type at the end
        : Trim<T> extends `${string}) ::${infer Type}` ? ExtractTypeName<Type>
        // Match ::type AS alias at the end (no paren)
        : Trim<T> extends `${string}::${infer Type} AS ${string}`
            ? ExtractTypeName<Type>
        // Match ::type at the end (no paren)
        : Trim<T> extends `${string}::${infer Type}` ? ExtractTypeName<Type>
        : undefined;

/**
 * Extract just the type name from a cast (handles things like varchar(255))
 */
type ExtractTypeName<T extends string> = Trim<T> extends
    `${infer TypeName} ( ${string}` ? Trim<TypeName>
    : Trim<T> extends `${infer TypeName}(${string}` ? Trim<TypeName>
    : Trim<T>;

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

/**
 * Strip PostgreSQL type cast syntax (::type) from a column reference
 */
export type StripTypeCast<T extends string> = T extends `${infer Col}::${string}`
    ? Trim<Col>
    : T;

// ============================================================================
// Wildcard Parsing
// ============================================================================

/**
 * Check if this is a table.* or alias.* or schema.table.* pattern
 */
type IsTableWildcard<T extends string> = Trim<T> extends `${string}.*` ? true
    : Trim<T> extends `${string}. *` ? true
    : false;

/**
 * Parse a table.* or schema.table.* wildcard into a TableWildcard type
 */
type ParseTableWildcard<T extends string> =
    // Check for schema.table.* pattern first
    [ParseSchemaTableWildcard<Trim<T>>] extends [never]
        ? ParseSimpleTableWildcard<T>
        : ParseSchemaTableWildcard<Trim<T>> extends
            [infer Schema extends string, infer Table extends string]
            ? TableWildcard<Table, Schema>
        : ParseSimpleTableWildcard<T>;

/**
 * Parse simple table.* pattern (no schema)
 */
type ParseSimpleTableWildcard<T extends string> = Trim<T> extends
    `${infer Table}.*` ? TableWildcard<RemoveQuotes<Table>, undefined>
    : Trim<T> extends `${infer Table}. *`
        ? TableWildcard<RemoveQuotes<Table>, undefined>
    : never;

/**
 * Parse schema.table.* pattern, returns [schema, table] or never
 */
type ParseSchemaTableWildcard<T extends string> =
    // Pattern: "schema"."table".*
    T extends `"${infer Schema}"."${infer Table}".*` ? [Schema, Table]
        : T extends `"${infer Schema}"."${infer Table}". *` ? [Schema, Table]
        // Pattern: "schema".table.*
        : T extends `"${infer Schema}".${infer Table}.*`
            ? IsSimpleIdentifier<Table> extends true ? [Schema, Table]
            : never
        : T extends `"${infer Schema}".${infer Table}. *`
            ? IsSimpleIdentifier<Table> extends true ? [Schema, Table]
            : never
        // Pattern: schema."table".*
        : T extends `${infer Schema}."${infer Table}".*`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table]
            : never
        : T extends `${infer Schema}."${infer Table}". *`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table]
            : never
        // Pattern: schema.table.* (check it has exactly 2 dots before *)
        : T extends `${infer Part1}.${infer Part2}.*`
            ? IsSimpleIdentifier<Part1> extends true
                ? Part2 extends `${string}.${string}` ? never // More than 2 parts, not schema.table.*
                : IsSimpleIdentifier<Part2> extends true ? [Part1, Part2]
                : never
            : never
        : T extends `${infer Part1}.${infer Part2}. *`
            ? IsSimpleIdentifier<Part1> extends true
                ? Part2 extends `${string}.${string}` ? never
                : IsSimpleIdentifier<Part2> extends true ? [Part1, Part2]
                : never
            : never
        : never;

// ============================================================================
// Column Reference Parsing
// ============================================================================

/**
 * Extract column name for default alias (removes quotes)
 */
export type ExtractColumnName<T extends string> =
    // Check for three-part: schema.table.column
    T extends `${infer _}.${infer _2}.${infer Col}` ? RemoveQuotes<Col>
        // Check for two-part: table.column
        : T extends `${infer _}.${infer Col}` ? RemoveQuotes<Col>
        // Single identifier
        : RemoveQuotes<T>;

/**
 * Parse a column reference (schema.table.column, table.column, or just column)
 */
export type ParseColumnRefType<T extends string> =
    // Check for three-part identifier: schema.table.column
    [ParseThreePartIdentifier<Trim<T>>] extends [never]
        ? ParseTwoOrOnePartIdentifier<T>
        : ParseThreePartIdentifier<Trim<T>> extends [
            infer Schema extends string,
            infer Table extends string,
            infer Col extends string,
        ] ? TableColumnRef<Table, Col, Schema>
        : ParseTwoOrOnePartIdentifier<T>;

/**
 * Parse two-part (table.column) or single-part (column) identifier
 */
type ParseTwoOrOnePartIdentifier<T extends string> =
    // Check for two-part identifier: table.column
    Trim<T> extends `${infer Table}.${infer Col}`
        ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Col>, undefined>
        // Single identifier: column
        : UnboundColumnRef<RemoveQuotes<T>>;

/**
 * Parse a three-part identifier: schema.table.column
 * Returns [schema, table, column] or never if not a three-part identifier
 */
type ParseThreePartIdentifier<T extends string> =
    // Pattern: "schema"."table"."column"
    T extends `"${infer Schema}"."${infer Table}"."${infer Col}"`
        ? [Schema, Table, Col]
        // Pattern: "schema"."table".column
        : T extends `"${infer Schema}"."${infer Table}".${infer Col}`
            ? [Schema, Table, RemoveQuotes<Col>]
        // Pattern: "schema".table."column"
        : T extends `"${infer Schema}".${infer Table}."${infer Col}"`
            ? [Schema, RemoveQuotes<Table>, Col]
        // Pattern: "schema".table.column
        : T extends `"${infer Schema}".${infer Table}.${infer Col}`
            ? IsSimpleIdentifier<Table> extends true
                ? IsSimpleIdentifier<Col> extends true ? [Schema, Table, Col]
                : never
            : never
        // Pattern: schema."table"."column"
        : T extends `${infer Schema}."${infer Table}"."${infer Col}"`
            ? IsSimpleIdentifier<Schema> extends true ? [Schema, Table, Col]
            : never
        // Pattern: schema."table".column
        : T extends `${infer Schema}."${infer Table}".${infer Col}`
            ? IsSimpleIdentifier<Schema> extends true
                ? [Schema, Table, RemoveQuotes<Col>]
            : never
        // Pattern: schema.table."column"
        : T extends `${infer Schema}.${infer Table}."${infer Col}"`
            ? IsSimpleIdentifier<Schema> extends true
                ? IsSimpleIdentifier<Table> extends true
                    ? [Schema, Table, Col]
                : never
            : never
        // Pattern: schema.table.column (all unquoted)
        : T extends `${infer Part1}.${infer Part2}.${infer Part3}`
            ? IsSimpleIdentifier<Part1> extends true
                ? IsSimpleIdentifier<Part2> extends true
                    ? IsSimpleIdentifier<Part3> extends true
                        ? [Part1, Part2, Part3]
                    : never
                : never
            : never
        : never;

// ============================================================================
// Parenthesis Utilities
// ============================================================================

/**
 * Extract content until we find the matching closing parenthesis
 */
export type ExtractUntilClosingParen<
    T extends string,
    Depth extends number,
    Acc extends string,
> = Depth extends 0 ? [Trim<Acc>, Trim<T>]
    : NextToken<T> extends
        [infer Token extends string, infer Rest extends string]
        ? Token extends "(" ? ExtractUntilClosingParen<
                Rest,
                Increment<Depth>,
                `${Acc} ${Token}`
            >
        : Token extends ")"
            ? Decrement<Depth> extends 0 ? [Trim<Acc>, Trim<Rest>]
            : ExtractUntilClosingParen<
                Rest,
                Decrement<Depth>,
                `${Acc} ${Token}`
            >
        : ExtractUntilClosingParen<Rest, Depth, `${Acc} ${Token}`>
    : [Trim<Acc>, ""];
