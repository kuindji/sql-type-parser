/**
 * Shared utilities for column parsing
 */

import type { NextToken } from "../../../common/tokenizer.js";
import type {
    Decrement,
    Increment,
    RemoveQuotes,
    Trim,
} from "../../../common/utils.js";

// ============================================================================
// Simple Identifier Utilities
// ============================================================================

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

// ============================================================================
// Type Cast Utilities
// ============================================================================

/**
 * Strip PostgreSQL type cast syntax (::type) from a column reference
 */
export type StripTypeCast<T extends string> = T extends `${infer Col}::${string}`
    ? Trim<Col>
    : T;

/**
 * Check if the expression contains a type cast (::type)
 */
export type HasTypeCast<T extends string> = T extends `${string}::${string}`
    ? true
    : false;

/**
 * Extract the column name before the :: cast operator
 */
export type ExtractBeforeCast<T extends string> = T extends
    `${infer Name}::${string}` ? Name
    : T;

/**
 * Extract just the type name from a cast (handles things like varchar(255))
 */
export type ExtractTypeName<T extends string> = Trim<T> extends
    `${infer TypeName} ( ${string}` ? Trim<TypeName>
    : Trim<T> extends `${infer TypeName}(${string}` ? Trim<TypeName>
    : Trim<T>;

/**
 * Extract the final type cast from an expression
 */
export type ExtractFinalCastType<T extends string> =
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
 * Strip alias and type cast from expression
 */
export type StripAliasAndCast<T extends string> = T extends
    `${infer Expr} AS ${string}` ? StripTypeCast<Trim<Expr>>
    : StripTypeCast<T>;

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

/**
 * Extract content from balanced parentheses
 * Returns [inner content, remainder after closing paren]
 */
export type ExtractParenthesizedContent<T extends string> = Trim<T> extends
    `( ${infer Rest}` ? ExtractUntilClosingParen<Rest, 1, "">
    : never;

/**
 * Skip tokens until we find the matching closing parenthesis
 * Returns the string after the closing paren
 */
export type SkipUntilClosingParen<
    T extends string,
    Depth extends number,
> = Depth extends 0 ? T
    : NextToken<Trim<T>> extends
        [infer Token extends string, infer Rest extends string]
        ? Token extends "(" ? SkipUntilClosingParen<Rest, Increment<Depth>>
        : Token extends ")" ? SkipUntilClosingParen<Rest, Decrement<Depth>>
        : SkipUntilClosingParen<Rest, Depth>
    : "";

// ============================================================================
// Alias Extraction Utilities
// ============================================================================

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

/**
 * Extract the cast type that may follow a subquery's closing parenthesis
 * e.g., ")::text" -> "text"
 */
export type ExtractSubqueryCastType<T extends string> = Trim<T> extends
    `::${infer Type} ${string}` ? ExtractTypeName<Type>
    : Trim<T> extends `::${infer Type}` ? ExtractTypeName<Type>
    : undefined;

// ============================================================================
// Column Name Extraction
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
