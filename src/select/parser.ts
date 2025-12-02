/**
 * Type-level SQL SELECT parser
 * 
 * This module handles parsing of SELECT queries specifically.
 * It uses shared utilities from common/ but maintains its own
 * execution tree for TypeScript performance.
 */

import type {
  SelectClause,
  SelectItem,
  ColumnRef,
  SubqueryExpr,
  ExtendedColumnRefType,
  UnionClause,
  UnionClauseAny,
  UnionOperatorType,
  SQLSelectQuery,
} from "./ast.js"

import type {
  TableRef,
  TableSource,
  DerivedTableRef,
  CTEDefinition,
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  ComplexExpr,
  ValidatableColumnRef,
  ColumnRefType,
  WhereExpr,
  BinaryExpr,
  LiteralValue,
  JoinClause,
  JoinType,
  OrderByItem,
  AggregateExpr,
  AggregateFunc,
  UnparsedExpr,
  ParsedCondition,
} from "../common/ast.js"

import type {
  NormalizeSQL,
  NextToken,
  ExtractUntil,
  SplitByComma,
  FromTerminators,
  WhereTerminators,
  OrderByTerminators,
  StartsWith,
} from "../common/tokenizer.js"

import type { Trim, ParseError, Flatten, RemoveQuotes, Increment, Decrement } from "../common/utils.js"

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse a SQL SELECT query string into an AST
 */
export type ParseSelectSQL<T extends string> = ParseQueryOrUnion<NormalizeSQL<T>>

/**
 * Parse a query that may contain UNION/INTERSECT/EXCEPT operators
 */
type ParseQueryOrUnion<T extends string> = ParseSelectQueryWithRest<T> extends infer Result
  ? Result extends { query: infer Q extends SelectClause; rest: infer Rest extends string }
    ? CheckForUnion<Q, Rest>
    : Result extends SQLSelectQuery<infer Q>
      ? Result
      : Result
  : never

/**
 * Parse a normalized SELECT query and return both the query and remaining string
 */
type ParseSelectQueryWithRest<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "WITH"
    ? ParseWithAndSelectWithRest<Rest>
    : First extends "SELECT"
      ? ParseSelectBodyWithCTEsAndRest<Rest, undefined>
      : ParseError<`Expected SELECT or WITH, got: ${First}`>
  : ParseError<"Empty query">

/**
 * Legacy entry point for backward compatibility with subquery parsing
 */
type ParseSelectQuery<T extends string> = ParseSelectQueryWithRest<T> extends infer Result
  ? Result extends { query: infer Q extends SelectClause; rest: infer Rest extends string }
    ? CheckForUnion<Q, Rest>
    : Result
  : never

/**
 * Parse WITH clause followed by SELECT
 */
type ParseWithAndSelect<T extends string> = ParseWithAndSelectWithRest<T> extends infer Result
  ? Result extends { query: infer Q extends SelectClause; rest: infer Rest extends string }
    ? CheckForUnion<Q, Rest>
    : Result
  : never

/**
 * Parse WITH clause followed by SELECT, returning both query and rest
 */
type ParseWithAndSelectWithRest<T extends string> = ParseCTEList<T> extends infer CTEResult
  ? CTEResult extends { ctes: infer CTEs extends CTEDefinition[]; rest: infer AfterCTEs extends string }
    ? NextToken<AfterCTEs> extends ["SELECT", infer SelectRest extends string]
      ? ParseSelectBodyWithCTEsAndRest<SelectRest, CTEs>
      : ParseError<"Expected SELECT after WITH clause">
    : CTEResult
  : never

// ============================================================================
// Union Parser
// ============================================================================

/**
 * Check if there's a union operator and parse accordingly
 */
type CheckForUnion<
  Left extends SelectClause,
  Rest extends string,
> = Trim<Rest> extends ""
  ? SQLSelectQuery<Left>
  : ParseUnionOperator<Rest> extends [infer Op extends UnionOperatorType, infer AfterOp extends string]
    ? ParseSelectQueryWithRest<AfterOp> extends infer RightResult
      ? RightResult extends { query: infer RightQ extends SelectClause; rest: infer AfterRight extends string }
        ? CheckForMoreUnions<Left, Op, RightQ, AfterRight>
        : RightResult extends SQLSelectQuery<infer RightQ>
          ? RightQ extends SelectClause
            ? SQLSelectQuery<UnionClause<Left, Op, RightQ>>
            : RightQ extends UnionClauseAny
              ? SQLSelectQuery<UnionClause<Left, Op, RightQ>>
              : ParseError<"Invalid right side of union">
          : RightResult
      : never
    : SQLSelectQuery<Left>

/**
 * Handle more unions on the right side
 */
type CheckForMoreUnions<
  Left extends SelectClause,
  Op extends UnionOperatorType,
  Right extends SelectClause,
  Rest extends string,
> = Trim<Rest> extends ""
  ? SQLSelectQuery<UnionClause<Left, Op, Right>>
  : ParseUnionOperator<Rest> extends [infer NextOp extends UnionOperatorType, infer AfterNextOp extends string]
    ? ParseSelectQueryWithRest<AfterNextOp> extends infer NextRightResult
      ? NextRightResult extends { query: infer NextRightQ extends SelectClause; rest: infer AfterNextRight extends string }
        ? CheckForMoreUnions<Left, Op, Right, Rest> extends SQLSelectQuery<infer LeftUnion>
          ? LeftUnion extends UnionClauseAny
            ? CheckForMoreUnions<Right, NextOp, NextRightQ, AfterNextRight> extends SQLSelectQuery<infer RightUnion>
              ? SQLSelectQuery<UnionClause<Left, Op, RightUnion>>
              : ParseError<"Failed to parse chained union">
            : ParseError<"Invalid union chain">
          : ParseError<"Failed to parse union chain">
        : NextRightResult
      : never
    : SQLSelectQuery<UnionClause<Left, Op, Right>>

/**
 * Parse a union operator and return [operator, remaining string]
 */
type ParseUnionOperator<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "UNION"
    ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
      ? ["UNION ALL", AfterAll]
      : ["UNION", Rest]
    : First extends "INTERSECT"
      ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
        ? ["INTERSECT ALL", AfterAll]
        : ["INTERSECT", Rest]
      : First extends "EXCEPT"
        ? NextToken<Rest> extends ["ALL", infer AfterAll extends string]
          ? ["EXCEPT ALL", AfterAll]
          : ["EXCEPT", Rest]
        : never
  : never

/**
 * Parse a comma-separated list of CTEs
 */
type ParseCTEList<
  T extends string,
  Acc extends CTEDefinition[] = []
> = ParseSingleCTE<T> extends infer CTEResult
  ? CTEResult extends { cte: infer CTE extends CTEDefinition; rest: infer Rest extends string }
    ? NextToken<Rest> extends [",", infer AfterComma extends string]
      ? ParseCTEList<AfterComma, [...Acc, CTE]>
      : { ctes: [...Acc, CTE]; rest: Rest }
    : CTEResult extends ParseError<string>
      ? CTEResult
      : ParseError<"Invalid CTE syntax">
  : never

/**
 * Parse a single CTE: name AS ( SELECT ... )
 */
type ParseSingleCTE<T extends string> = NextToken<T> extends [
  infer Name extends string,
  infer AfterName extends string,
]
  ? NextToken<AfterName> extends ["AS", infer AfterAS extends string]
    ? NextToken<AfterAS> extends ["(", infer AfterParen extends string]
      ? ExtractCTEQuery<AfterParen> extends [infer QueryStr extends string, infer Rest extends string]
        ? ParseSelectQuery<QueryStr> extends SQLSelectQuery<infer Query extends SelectClause>
          ? { cte: CTEDefinition<RemoveQuotes<Name>, Query>; rest: Rest }
          : ParseError<"Failed to parse CTE query">
        : ParseError<"Invalid CTE query syntax">
      : ParseError<"Expected ( after AS in CTE">
    : ParseError<"Expected AS after CTE name">
  : ParseError<"Expected CTE name">

/**
 * Extract the CTE query from parentheses and return rest
 */
type ExtractCTEQuery<T extends string> = ExtractUntilClosingParen<T, 1, ""> extends [
  infer Query extends string,
  infer Rest extends string
]
  ? [Trim<Query>, Trim<Rest>]
  : never

// ============================================================================
// SELECT Body Parser
// ============================================================================

/**
 * Parse the body of a SELECT statement (legacy - no CTEs)
 */
type ParseSelectBody<T extends string> = ParseSelectBodyWithCTEs<T, undefined>

/**
 * Parse the body of a SELECT statement with optional CTEs
 */
type ParseSelectBodyWithCTEs<
  T extends string,
  CTEs extends CTEDefinition[] | undefined
> = ParseSelectBodyWithCTEsAndRest<T, CTEs> extends infer Result
  ? Result extends { query: infer Q extends SelectClause; rest: string }
    ? SQLSelectQuery<Q>
    : Result
  : never

/**
 * Parse the body of a SELECT statement with optional CTEs, returning both query and rest
 */
type ParseSelectBodyWithCTEsAndRest<
  T extends string,
  CTEs extends CTEDefinition[] | undefined
> = CheckDistinct<T> extends [
  infer IsDistinct extends boolean,
  infer AfterDistinct extends string,
]
  ? ExtractUntil<AfterDistinct, "FROM"> extends [
    infer ColumnsPart extends string,
    infer FromPart extends string,
  ]
  ? ParseColumns<ColumnsPart> extends infer Columns
  ? Columns extends ParseError<string>
  ? Columns
  : ParseFromClause<FromPart> extends infer FromResult
  ? FromResult extends ParseError<string>
  ? FromResult
  : FromResult extends {
    from: infer From extends TableSource
    rest: infer Rest extends string
  }
  ? BuildSelectClauseWithCTEsAndRest<Columns, From, Rest, IsDistinct, CTEs>
  : ParseError<"Failed to parse FROM clause">
  : never
  : never
  : ParseError<"Missing FROM clause">
  : never

/**
 * Check for DISTINCT keyword
 */
type CheckDistinct<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "DISTINCT"
  ? [true, Rest]
  : [false, T]
  : [false, T]

// ============================================================================
// Column Parser
// ============================================================================

/**
 * Parse column list
 */
type ParseColumns<T extends string> = Trim<T> extends "*"
  ? "*"
  : SplitByComma<Trim<T>> extends infer Parts extends string[]
  ? ParseColumnList<Parts>
  : ParseError<"Failed to split columns">

/**
 * Parse a list of columns
 */
type ParseColumnList<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? ParseSingleColumn<First> extends infer Col
  ? Col extends ParseError<string>
  ? Col
  : Rest extends []
  ? [Col]
  : ParseColumnList<Rest> extends infer RestCols
  ? RestCols extends ParseError<string>
  ? RestCols
  : RestCols extends SelectItem[]
  ? [Col, ...RestCols]
  : ParseError<"Invalid column list">
  : never
  : never
  : []

/**
 * Parse a single column (could be aggregate, aliased, or simple)
 */
type ParseSingleColumn<T extends string> = Trim<T> extends ""
  ? ParseError<"Empty column">
  : IsAggregate<Trim<T>> extends true
  ? ParseAggregateColumn<Trim<T>>
  : ParseSimpleColumn<Trim<T>>

/**
 * Check if a column is an aggregate function
 */
type IsAggregate<T extends string> = T extends `COUNT ${string}`
  ? true
  : T extends `SUM ${string}`
  ? true
  : T extends `AVG ${string}`
  ? true
  : T extends `MIN ${string}`
  ? true
  : T extends `MAX ${string}`
  ? true
  : false

/**
 * Parse an aggregate function column
 */
type ParseAggregateColumn<T extends string> =
  T extends `${infer Func} ( ${infer Arg} ) AS ${infer Alias}`
  ? Func extends AggregateFunc
  ? AggregateExpr<Func, ParseAggregateArg<Arg>, RemoveQuotes<Alias>>
  : ParseError<`Unknown aggregate function: ${Func}`>
  : T extends `${infer Func} ( ${infer Arg} )`
  ? Func extends AggregateFunc
  ? AggregateExpr<Func, ParseAggregateArg<Arg>, `${Func}_result`>
  : ParseError<`Unknown aggregate function: ${Func}`>
  : ParseError<`Invalid aggregate syntax: ${T}`>

/**
 * Parse aggregate function argument
 */
type ParseAggregateArg<T extends string> = Trim<T> extends "*"
  ? "*"
  : ParseColumnRefType<Trim<T>>

/**
 * Parse a simple column reference with optional alias
 * Handles PostgreSQL type casting syntax (::type), complex expressions, and subqueries
 */
type ParseSimpleColumn<T extends string> =
  // Check for table.* wildcard first
  IsTableWildcard<T> extends true
    ? ParseTableWildcard<T>
    // Check for scalar subquery (parenthesized SELECT)
    : IsSubqueryExpression<T> extends true
      ? ParseSubqueryColumn<T>
      // Check for CAST function (must be before general complex expression check)
      : IsCastExpression<T> extends true
        ? ParseCastColumn<T>
        // Check for complex expression (contains JSON operators or parentheses with operators)
        : IsComplexExpression<T> extends true
          ? ParseComplexColumn<T>
          // Simple column with optional alias
          : T extends `${infer Col} AS ${infer Alias}`
            ? ColumnRef<ParseColumnRefType<StripTypeCast<Trim<Col>>>, RemoveQuotes<Alias>>
            : ColumnRef<ParseColumnRefType<StripTypeCast<T>>, ExtractColumnName<StripTypeCast<T>>>

/**
 * Check if the expression is a CAST function
 * CAST ( expr AS type ) - note: AS inside CAST is different from column alias AS
 */
type IsCastExpression<T extends string> =
  Trim<T> extends `CAST ( ${string}` ? true :
  Trim<T> extends `cast ( ${string}` ? true :
  false

/**
 * Parse a CAST expression column
 * Handles: CAST ( expr AS type ) AS alias
 */
type ParseCastColumn<T extends string> =
  // Pattern: CAST ( expr AS type ) AS alias
  ExtractCastContent<Trim<T>> extends [infer CastExpr extends string, infer CastType extends string, infer Rest extends string]
    ? Trim<Rest> extends `AS ${infer Alias}`
      ? ColumnRef<ParseCastExpr<CastExpr, CastType>, RemoveQuotes<Alias>>
      : ColumnRef<ParseCastExpr<CastExpr, CastType>, ExtractCastAlias<CastExpr>>
    : ColumnRef<ComplexExpr<[], undefined>, "cast">

/**
 * Parse the CAST expression into a ComplexExpr with the cast type
 */
type ParseCastExpr<Expr extends string, CastType extends string> =
  ComplexExpr<ExtractAllColumnRefs<Expr>, CastType>

/**
 * Extract alias from CAST expression (use the expression name or "cast")
 */
type ExtractCastAlias<Expr extends string> =
  Trim<Expr> extends `${infer _}.${infer Col}`
    ? Col
    : Trim<Expr> extends ""
      ? "cast"
      : Trim<Expr>

/**
 * Extract content from a CAST expression
 * Input: "CAST ( expr AS type ) rest" or "cast ( expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastContent<T extends string> =
  // Remove CAST keyword (case-insensitive after normalization)
  Trim<T> extends `CAST ( ${infer Content}`
    ? ExtractCastParts<Content>
    : Trim<T> extends `cast ( ${infer Content}`
      ? ExtractCastParts<Content>
      : never

/**
 * Extract expression and type from inside CAST parentheses
 * Input: "expr AS type ) rest"
 * Returns: [expr, type, rest]
 */
type ExtractCastParts<T extends string> =
  // Find the AS keyword that separates expr from type
  T extends `${infer Expr} AS ${infer TypeAndRest}`
    ? ExtractCastType<TypeAndRest> extends [infer CastType extends string, infer Rest extends string]
      ? [Trim<Expr>, Trim<CastType>, Trim<Rest>]
      : never
    : never

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
      : T extends `${infer Type} ) ${infer Rest}`
        ? [Trim<Type>, Rest]
        : T extends `${infer Type} )`
          ? [Trim<Type>, ""]
          : never

/**
 * Check if the expression is a scalar subquery (starts with parenthesized SELECT)
 */
type IsSubqueryExpression<T extends string> =
  Trim<T> extends `( SELECT ${string}` ? true : false

/**
 * Parse a scalar subquery column expression
 * Extracts the inner SELECT, parses it, and creates a SubqueryExpr
 */
type ParseSubqueryColumn<T extends string> =
  T extends `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseSubqueryExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseSubqueryExpr<T>, "subquery">

/**
 * Parse a subquery expression, extracting the SELECT from parentheses
 */
type ParseSubqueryExpr<T extends string> =
  ExtractParenthesizedContent<Trim<T>> extends [infer Inner extends string, infer Remainder extends string]
    ? ParseSelectQuery<Inner> extends SQLSelectQuery<infer Query extends SelectClause>
      ? SubqueryExpr<Query, ExtractSubqueryCastType<Remainder>>
      : ParseSelectQuery<Inner> extends ParseError<infer E>
        ? ComplexExpr<[], undefined> // Fallback to unknown on parse error
        : ComplexExpr<[], undefined>
    : ComplexExpr<[], undefined>

/**
 * Extract the cast type that may follow a subquery's closing parenthesis
 * e.g., ")::text" -> "text"
 */
type ExtractSubqueryCastType<T extends string> =
  Trim<T> extends `::${infer Type} ${string}`
    ? ExtractTypeName<Type>
    : Trim<T> extends `::${infer Type}`
      ? ExtractTypeName<Type>
      : undefined

/**
 * Extract content from balanced parentheses
 * Returns [inner content, remainder after closing paren]
 */
type ExtractParenthesizedContent<T extends string> =
  Trim<T> extends `( ${infer Rest}`
    ? ExtractUntilClosingParen<Rest, 1, "">
    : never

/**
 * Extract content until we find the matching closing parenthesis
 */
type ExtractUntilClosingParen<
  T extends string,
  Depth extends number,
  Acc extends string
> = Depth extends 0
  ? [Trim<Acc>, Trim<T>]
  : NextToken<T> extends [infer Token extends string, infer Rest extends string]
    ? Token extends "("
      ? ExtractUntilClosingParen<Rest, Increment<Depth>, `${Acc} ${Token}`>
      : Token extends ")"
        ? Decrement<Depth> extends 0
          ? [Trim<Acc>, Trim<Rest>]
          : ExtractUntilClosingParen<Rest, Decrement<Depth>, `${Acc} ${Token}`>
        : ExtractUntilClosingParen<Rest, Depth, `${Acc} ${Token}`>
    : [Trim<Acc>, ""]

/**
 * Check if this is a function call (pattern: identifier ( ... ))
 * Excludes aggregate functions which are handled separately
 * After normalization, functions look like: funcName ( args )
 */
type IsFunctionCall<T extends string> = 
  // Pattern: identifier ( ... where identifier is not a paren or comma
  Trim<T> extends `${infer Name} ( ${string}`
    ? Name extends "(" | ")" | "," 
      ? false 
      : true
    : false

/**
 * Check if the expression is complex (contains JSON operators, concatenation, function calls, nested parens, type casts, etc.)
 */
type IsComplexExpression<T extends string> = 
  T extends `${string}->${string}` ? true :
  T extends `${string}->>${string}` ? true :
  T extends `${string}#>${string}` ? true :
  T extends `${string}#>>${string}` ? true :
  T extends `${string}||${string}` ? true :
  T extends `${string} || ${string}` ? true :
  T extends `( ${string}` ? true :
  IsFunctionCall<T> extends true ? true :
  HasTypeCast<T> extends true ? true :
  false

/**
 * Check if the expression contains a type cast (::type)
 */
type HasTypeCast<T extends string> =
  T extends `${string}::${string}` ? true : false

/**
 * Parse a complex column expression
 * Extracts base column for validation and final cast type for result type
 */
type ParseComplexColumn<T extends string> = 
  T extends `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseComplexExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<ParseComplexExpr<T>, ExtractComplexColumnName<T>>

/**
 * Parse a complex expression into ComplexExpr AST
 * Extracts all column references for validation and the final cast type
 */
type ParseComplexExpr<T extends string> = ComplexExpr<
  ExtractAllColumnRefs<T>,
  ExtractFinalCastType<T>
>

/**
 * Extract all column references from a complex expression
 * Scans token by token to find all column patterns
 */
type ExtractAllColumnRefs<T extends string> = 
  ScanTokensForColumnRefs<Trim<T>, []>

/**
 * Scan tokens one by one looking for column reference patterns
 * Skips function names (tokens followed by opening parenthesis)
 */
type ScanTokensForColumnRefs<
  T extends string,
  Acc extends ValidatableColumnRef[]
> = Trim<T> extends ""
  ? Acc
  : NextToken<Trim<T>> extends [infer Token extends string, infer Rest extends string]
    // Skip function names: if the next token is "(", this token is a function name, not a column
    ? IsFunctionName<Token, Rest> extends true
      ? ScanTokensForColumnRefs<Rest, Acc>
      : ExtractColumnFromToken<Token> extends infer ColRef
        // Must check [ColRef] extends [never] first because never extends everything
        ? [ColRef] extends [never]
          ? ScanTokensForColumnRefs<Rest, Acc>
          : ColRef extends ValidatableColumnRef
            ? ScanTokensForColumnRefs<Rest, [...Acc, ColRef]>
            : ScanTokensForColumnRefs<Rest, Acc>
        : ScanTokensForColumnRefs<Rest, Acc>
    : Acc

/**
 * Check if a token is a function name (followed by opening parenthesis)
 * A token is a function name if:
 * 1. It's not a known SQL keyword or operator
 * 2. The next token is "("
 */
type IsFunctionName<Token extends string, Rest extends string> = 
  // Skip known SQL keywords and operators that aren't function names
  Token extends "(" | ")" | "," | "AS" | "AND" | "OR" | "NOT" | "IN" | "IS" | "LIKE" | "ILIKE" | "BETWEEN" | "SELECT" | "FROM" | "WHERE" | "JOIN" | "ON" | "ORDER" | "BY" | "GROUP" | "HAVING" | "LIMIT" | "OFFSET"
    ? false
    : IsSimpleIdentifier<Token> extends true
      ? NextToken<Trim<Rest>> extends ["(", string]
        ? true
        : false
      : false

/**
 * Try to extract a column reference from a single token
 * Handles: schema.table.col, alias."col", alias."col"::type, "table"."col", "col", "col"::type
 * Also handles unquoted: schema.table.col::type, table.col::type, col::type
 */
type ExtractColumnFromToken<T extends string> =
  // First check for three-part identifier (schema.table.column)
  ExtractThreePartColumnRef<T> extends infer ThreePart
    ? [ThreePart] extends [never]
      ? ExtractTwoPartOrSimpleColumnRef<T>
      : ThreePart
    : never

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
  : never

/**
 * Extract the base column from a JSON operator expression (recursively)
 * Handles nested JSON operators: config->'a'->>'b' -> config
 * e.g., config->>'settings' -> config, table.col->'key' -> table.col
 */
type ExtractBaseColumnFromJsonExpr<T extends string> =
  // Pattern: base->> or base->
  T extends `${infer Base}->>${string}`
    ? ExtractBaseColumnFromJsonExpr<Base>  // Recurse in case there are more operators
  : T extends `${infer Base}->${string}`
    ? ExtractBaseColumnFromJsonExpr<Base>
  : T extends `${infer Base}#>>${string}`
    ? ExtractBaseColumnFromJsonExpr<Base>
  : T extends `${infer Base}#>${string}`
    ? ExtractBaseColumnFromJsonExpr<Base>
  : T  // No more operators, return as-is

/**
 * Extract column name from a potentially parenthesized and/or type-casted expression
 */
type ExtractColumnFromParenExpr<T extends string> =
  // Strip outer parentheses first
  Trim<T> extends `(${infer Inner})`
    ? ExtractColumnFromParenExpr<Trim<Inner>>
  // Strip type cast (::type)
  : Trim<T> extends `${infer Col}::${string}`
    ? ExtractColumnFromParenExpr<Trim<Col>>
  // Extract from quoted identifier
  : Trim<T> extends `"${infer Col}"`
    ? Col
  // Simple identifier
  : Trim<T>

/**
 * Check if the token contains a JSON operator
 */
type HasJsonOperator<T extends string> =
  T extends `${string}->>${string}` ? true :
  T extends `${string}->${string}` ? true :
  T extends `${string}#>>${string}` ? true :
  T extends `${string}#>${string}` ? true :
  false

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
  : T extends `"${infer Col}"::${string}`
    ? UnboundColumnRef<Col>
  // Pattern: "column" followed by JSON operator
  : T extends `"${infer Col}"->>${string}`
    ? UnboundColumnRef<Col>
  : T extends `"${infer Col}"->${string}`
    ? UnboundColumnRef<Col>
  : T extends `"${infer Col}"#>>${string}`
    ? UnboundColumnRef<Col>
  : T extends `"${infer Col}"#>${string}`
    ? UnboundColumnRef<Col>
  // Pattern: "column" (quoted simple column, no cast)
  : T extends `"${infer Col}"`
    ? UnboundColumnRef<Col>
  // Pattern: table.column::type (unquoted with cast) - but NOT schema.table.column
  : T extends `${infer Table}.${infer Col}::${string}`
    ? Col extends `${string}.${string}`
      ? never  // This is schema.table.column, handled above
      : IsSimpleIdentifier<Table> extends true
        ? TableColumnRef<Table, ExtractBeforeCast<Col>, undefined>
        : never
  // Pattern: table.column with JSON operator (e.g., t.col->>'key')
  : T extends `${infer Table}.${infer Rest}`
    ? HasJsonOperator<Rest> extends true
      ? IsSimpleIdentifier<Table> extends true
        ? ExtractBaseColumnFromJsonExpr<Rest> extends infer BaseCol extends string
          ? IsSimpleIdentifier<BaseCol> extends true
            ? TableColumnRef<Table, BaseCol, undefined>
            : never
          : never
        : never
      : Rest extends `${string}.${string}`
        ? never  // This is schema.table.column, handled above
        : IsSimpleIdentifier<Table> extends true
          ? IsSimpleIdentifier<Rest> extends true
            ? TableColumnRef<Table, Rest, undefined>
            : never
          : never
  // Pattern: column with JSON operator (e.g., config->>'key') - MUST come before ::type pattern
  : HasJsonOperator<T> extends true
    ? ExtractBaseColumnFromJsonExpr<T> extends infer BaseCol extends string
      ? IsSimpleIdentifier<BaseCol> extends true
        ? IsKeywordOrOperator<BaseCol> extends true
          ? never
          : UnboundColumnRef<BaseCol>
        // Handle parenthesized/casted expressions like ("config"::json)
        : ExtractColumnFromParenExpr<BaseCol> extends infer ExtractedCol extends string
          ? IsSimpleIdentifier<ExtractedCol> extends true
            ? IsKeywordOrOperator<ExtractedCol> extends true
              ? never
              : UnboundColumnRef<ExtractedCol>
            : never
          : never
      : never
  // Pattern: column::type (unquoted simple column with cast) - after JSON check
  : T extends `${infer Col}::${string}`
    ? IsSimpleIdentifier<ExtractBeforeCast<Col>> extends true
      ? UnboundColumnRef<ExtractBeforeCast<Col>>
      : never
  // Pattern: simple unquoted identifier (unbound column)
  : IsSimpleIdentifier<T> extends true
    ? IsKeywordOrOperator<T> extends true
      ? never  // Skip SQL keywords and operators
      : UnboundColumnRef<T>
  : never

/**
 * Check if a string is a SQL keyword, operator, literal, or parameter placeholder
 * that should not be treated as a column
 */
type IsKeywordOrOperator<T extends string> =
  // String literals (single-quoted values are values, not identifiers)
  T extends `'${string}'`
    ? true
    // SQL keywords (including function-specific keywords like FOR, USING)
    : T extends "SELECT" | "FROM" | "WHERE" | "AND" | "OR" | "NOT" | "IN" | "IS" | "NULL"
      | "TRUE" | "FALSE" | "LIKE" | "ILIKE" | "BETWEEN" | "EXISTS" | "CASE" | "WHEN"
      | "THEN" | "ELSE" | "END" | "AS" | "ON" | "JOIN" | "LEFT" | "RIGHT" | "INNER"
      | "OUTER" | "FULL" | "CROSS" | "GROUP" | "BY" | "HAVING" | "ORDER" | "ASC" | "DESC"
      | "LIMIT" | "OFFSET" | "UNION" | "INTERSECT" | "EXCEPT" | "ALL" | "DISTINCT"
      | "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "COALESCE" | "NULLIF" | "CAST"
      | "FOR" | "USING" | "WITH" | "OVER" | "PARTITION" | "ROWS" | "RANGE" | "PRECEDING" | "FOLLOWING"
      ? true
      // Comparison operators
      : T extends "=" | "!=" | "<>" | "<" | ">" | "<=" | ">="
        ? true
      // Lowercase versions of keywords (after normalization some might be lowercased in certain contexts)
      : T extends "for" | "from" | "using" | "with" | "over" | "partition" | "rows" | "range"
        ? true
      // Parameter placeholders ($1, $2, etc. or :name)
      : T extends `$${number}` | `$${string}` | `:${string}`
        ? true
        // Numeric literals
        : T extends `${number}`
          ? true
          : false

/**
 * Extract the column name before the :: cast operator
 */
type ExtractBeforeCast<T extends string> =
  T extends `${infer Name}::${string}` ? Name : T

/**
 * Check if a string is a simple identifier (no spaces, not a special char)
 */
type IsSimpleIdentifier<T extends string> = 
  T extends "" ? false :
  T extends `${string} ${string}` ? false :
  T extends "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" | "<" | ">" | "!" | "||" ? false :
  // Exclude string literal parts (tokens that start or end with single quotes)
  T extends `'${string}` ? false :
  T extends `${string}'` ? false :
  // Exclude number literals
  T extends `${number}` ? false :
  true

/**
 * Extract the final type cast from an expression
 */
type ExtractFinalCastType<T extends string> =
  // Match ) ::type AS alias at the end
  Trim<T> extends `${string}) ::${infer Type} AS ${string}`
    ? ExtractTypeName<Type>
  // Match ) ::type at the end
  : Trim<T> extends `${string}) ::${infer Type}`
    ? ExtractTypeName<Type>
  // Match ::type AS alias at the end (no paren)
  : Trim<T> extends `${string}::${infer Type} AS ${string}`
    ? ExtractTypeName<Type>
  // Match ::type at the end (no paren)
  : Trim<T> extends `${string}::${infer Type}`
    ? ExtractTypeName<Type>
  : undefined

/**
 * Extract just the type name from a cast (handles things like varchar(255))
 */
type ExtractTypeName<T extends string> = 
  Trim<T> extends `${infer TypeName} ( ${string}` ? Trim<TypeName> :
  Trim<T> extends `${infer TypeName}(${string}` ? Trim<TypeName> :
  Trim<T>

/**
 * Extract column name for complex expressions (for default alias)
 * For JSON operators, extracts the last key as the alias (without quotes)
 */
type ExtractComplexColumnName<T extends string> = 
  T extends `${string} AS ${infer Alias}` ? RemoveQuotes<Alias> :
  // Extract the last JSON key from the expression
  ExtractJsonKeyForAlias<T> extends infer Key extends string
    ? Key extends "" ? "expr" : Key
    : "expr"

/**
 * Extract the JSON key from a JSON operator expression for use as alias
 */
type ExtractJsonKeyForAlias<T extends string> =
  // Strip any type cast at the end first
  StripTypeCast<T> extends infer Stripped extends string
    ? ExtractLastJsonKey<Stripped>
    : ""

/**
 * Extract the last JSON key from an expression (handles nested accessors)
 */
type ExtractLastJsonKey<T extends string> =
  // Pattern: ...->>'key' (last accessor with ->>)
  T extends `${string}->>'${infer Key}'`
    ? Key
  : T extends `${string}->>"${infer Key}"`
    ? Key
  : T extends `${string}->>${infer Key}`
    ? IsSimpleIdentifier<Key> extends true ? Key : ""
  // Pattern: ...->'key' (last accessor with ->)
  : T extends `${string}->'${infer Key}'`
    ? Key
  : T extends `${string}->"${infer Key}"`
    ? Key
  : T extends `${string}->${infer Key}`
    ? IsSimpleIdentifier<Key> extends true ? Key : ""
  // Pattern: ...#>>'key' (last accessor with #>>)
  : T extends `${string}#>>'${infer Key}'`
    ? Key
  : T extends `${string}#>>"${infer Key}"`
    ? Key
  // Pattern: ...#>'key' (last accessor with #>)
  : T extends `${string}#>'${infer Key}'`
    ? Key
  : T extends `${string}#>"${infer Key}"`
    ? Key
  : ""

/**
 * Strip PostgreSQL type cast syntax (::type) from a column reference
 */
type StripTypeCast<T extends string> = T extends `${infer Col}::${string}`
  ? Trim<Col>
  : T

/**
 * Check if this is a table.* or alias.* or schema.table.* pattern
 */
type IsTableWildcard<T extends string> = Trim<T> extends `${string}.*`
  ? true
  : Trim<T> extends `${string}. *`
  ? true
  : false

/**
 * Parse a table.* or schema.table.* wildcard into a TableWildcard type
 */
type ParseTableWildcard<T extends string> = 
  // Check for schema.table.* pattern first
  [ParseSchemaTableWildcard<Trim<T>>] extends [never]
    ? ParseSimpleTableWildcard<T>
    : ParseSchemaTableWildcard<Trim<T>> extends [infer Schema extends string, infer Table extends string]
      ? TableWildcard<Table, Schema>
      : ParseSimpleTableWildcard<T>

/**
 * Parse simple table.* pattern (no schema)
 */
type ParseSimpleTableWildcard<T extends string> =
  Trim<T> extends `${infer Table}.*`
    ? TableWildcard<RemoveQuotes<Table>, undefined>
  : Trim<T> extends `${infer Table}. *`
    ? TableWildcard<RemoveQuotes<Table>, undefined>
  : never

/**
 * Parse schema.table.* pattern, returns [schema, table] or never
 */
type ParseSchemaTableWildcard<T extends string> =
  // Pattern: "schema"."table".*
  T extends `"${infer Schema}"."${infer Table}".*`
    ? [Schema, Table]
  : T extends `"${infer Schema}"."${infer Table}". *`
    ? [Schema, Table]
  // Pattern: "schema".table.*
  : T extends `"${infer Schema}".${infer Table}.*`
    ? IsSimpleIdentifier<Table> extends true
      ? [Schema, Table]
      : never
  : T extends `"${infer Schema}".${infer Table}. *`
    ? IsSimpleIdentifier<Table> extends true
      ? [Schema, Table]
      : never
  // Pattern: schema."table".*
  : T extends `${infer Schema}."${infer Table}".*`
    ? IsSimpleIdentifier<Schema> extends true
      ? [Schema, Table]
      : never
  : T extends `${infer Schema}."${infer Table}". *`
    ? IsSimpleIdentifier<Schema> extends true
      ? [Schema, Table]
      : never
  // Pattern: schema.table.* (check it has exactly 2 dots before *)
  : T extends `${infer Part1}.${infer Part2}.*`
    ? IsSimpleIdentifier<Part1> extends true
      ? Part2 extends `${string}.${string}`
        ? never  // More than 2 parts, not schema.table.*
        : IsSimpleIdentifier<Part2> extends true
          ? [Part1, Part2]
          : never
      : never
  : T extends `${infer Part1}.${infer Part2}. *`
    ? IsSimpleIdentifier<Part1> extends true
      ? Part2 extends `${string}.${string}`
        ? never
        : IsSimpleIdentifier<Part2> extends true
          ? [Part1, Part2]
          : never
      : never
  : never

/**
 * Extract column name for default alias (removes quotes)
 */
type ExtractColumnName<T extends string> = 
  // Check for three-part: schema.table.column
  T extends `${infer _}.${infer _2}.${infer Col}`
    ? RemoveQuotes<Col>
  // Check for two-part: table.column
  : T extends `${infer _}.${infer Col}`
    ? RemoveQuotes<Col>
  // Single identifier
  : RemoveQuotes<T>

/**
 * Parse a column reference (schema.table.column, table.column, or just column)
 */
type ParseColumnRefType<T extends string> = 
  // Check for three-part identifier: schema.table.column
  [ParseThreePartIdentifier<Trim<T>>] extends [never]
    ? ParseTwoOrOnePartIdentifier<T>
    : ParseThreePartIdentifier<Trim<T>> extends [infer Schema extends string, infer Table extends string, infer Col extends string]
      ? TableColumnRef<Table, Col, Schema>
      : ParseTwoOrOnePartIdentifier<T>

/**
 * Parse two-part (table.column) or single-part (column) identifier
 */
type ParseTwoOrOnePartIdentifier<T extends string> =
  // Check for two-part identifier: table.column
  Trim<T> extends `${infer Table}.${infer Col}`
    ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Col>, undefined>
  // Single identifier: column
  : UnboundColumnRef<RemoveQuotes<T>>

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
      ? IsSimpleIdentifier<Col> extends true
        ? [Schema, Table, Col]
        : never
      : never
  // Pattern: schema."table"."column"
  : T extends `${infer Schema}."${infer Table}"."${infer Col}"`
    ? IsSimpleIdentifier<Schema> extends true
      ? [Schema, Table, Col]
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
  : never

// ============================================================================
// FROM Clause Parser
// ============================================================================

/**
 * Parse FROM clause and return table + remaining query
 * Handles both regular tables and derived tables (subqueries)
 */
type ParseFromClause<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "FROM"
    ? NextToken<Rest> extends ["(", infer AfterParen extends string]
      ? ParseDerivedTable<AfterParen>
      : ExtractUntil<Rest, FromTerminators> extends [
          infer TablePart extends string,
          infer Remaining extends string,
        ]
        ? { from: ParseTableRef<TablePart>; rest: Remaining }
        : { from: ParseTableRef<Rest>; rest: "" }
    : ParseError<`Expected FROM, got: ${First}`>
  : ParseError<"Missing FROM clause">

/**
 * Parse a derived table (subquery in FROM clause)
 * Pattern: ( SELECT ... ) AS alias
 */
type ParseDerivedTable<T extends string> = 
  ExtractUntilClosingParen<T, 1, ""> extends [infer QueryStr extends string, infer AfterParen extends string]
    ? ParseSelectQuery<Trim<QueryStr>> extends SQLSelectQuery<infer Query extends SelectClause>
      ? ParseDerivedTableAlias<Trim<AfterParen>> extends { alias: infer Alias extends string; rest: infer Rest extends string }
        ? { from: DerivedTableRef<Query, Alias>; rest: Rest }
        : ParseError<"Derived table requires an alias">
      : ParseError<"Failed to parse derived table query">
    : ParseError<"Invalid derived table syntax">

/**
 * Parse the alias after a derived table's closing parenthesis
 */
type ParseDerivedTableAlias<T extends string> = 
  NextToken<T> extends ["AS", infer AfterAS extends string]
    ? NextToken<AfterAS> extends [infer Alias extends string, infer Rest extends string]
      ? { alias: RemoveQuotes<Alias>; rest: Rest }
      : ParseError<"Expected alias after AS">
    : NextToken<T> extends [infer First extends string, infer Rest extends string]
      ? First extends FromTerminators
        ? ParseError<"Derived table requires an alias">
        : { alias: RemoveQuotes<First>; rest: Rest }
      : ParseError<"Expected alias for derived table">

/**
 * Parse a table reference with optional schema and alias
 */
type ParseTableRef<T extends string> = Trim<T> extends `${infer SchemaOrTable} AS ${infer Alias}`
  ? ParseSchemaTable<SchemaOrTable> extends [infer Schema extends string | undefined, infer Table extends string]
    ? TableRef<Table, RemoveQuotes<Alias>, Schema>
    : TableRef<RemoveQuotes<SchemaOrTable>, RemoveQuotes<Alias>, undefined>
  : Trim<T> extends `${infer SchemaOrTable} ${infer Alias}`
    ? Alias extends FromTerminators
      ? ParseSchemaTable<SchemaOrTable> extends [infer Schema extends string | undefined, infer Table extends string]
        ? TableRef<Table, Table, Schema>
        : TableRef<RemoveQuotes<SchemaOrTable>, RemoveQuotes<SchemaOrTable>, undefined>
      : ParseSchemaTable<SchemaOrTable> extends [infer Schema extends string | undefined, infer Table extends string]
        ? TableRef<Table, RemoveQuotes<Alias>, Schema>
        : TableRef<RemoveQuotes<SchemaOrTable>, RemoveQuotes<Alias>, undefined>
    : ParseSchemaTable<T> extends [infer Schema extends string | undefined, infer Table extends string]
      ? TableRef<Table, Table, Schema>
      : TableRef<RemoveQuotes<T>, RemoveQuotes<T>, undefined>

/**
 * Parse schema.table syntax, returns [schema, table] or [undefined, table]
 */
type ParseSchemaTable<T extends string> = 
  // Pattern: "schema"."table"
  Trim<T> extends `"${infer Schema}"."${infer Table}"`
    ? [Schema, Table]
  // Pattern: schema."table"
  : Trim<T> extends `${infer Schema}."${infer Table}"`
    ? IsSimpleIdentifier<Schema> extends true
      ? [Schema, Table]
      : [undefined, RemoveQuotes<T>]
  // Pattern: "schema".table
  : Trim<T> extends `"${infer Schema}".${infer Table}`
    ? IsSimpleIdentifier<Table> extends true
      ? [Schema, RemoveQuotes<Table>]
      : [undefined, RemoveQuotes<T>]
  // Pattern: schema.table (both unquoted)
  : Trim<T> extends `${infer Schema}.${infer Table}`
    ? IsSimpleIdentifier<Schema> extends true
      ? IsSimpleIdentifier<Table> extends true
        ? [Schema, Table]
        : [undefined, RemoveQuotes<T>]
      : [undefined, RemoveQuotes<T>]
  // No schema, just table
  : [undefined, RemoveQuotes<T>]

// ============================================================================
// Build Select Clause with Optional Parts
// ============================================================================

/**
 * Build the complete SELECT clause by parsing remaining optional parts (legacy - no CTEs)
 */
type BuildSelectClause<
  Columns,
  From extends TableSource,
  Rest extends string,
  Distinct extends boolean,
> = BuildSelectClauseWithCTEs<Columns, From, Rest, Distinct, undefined>

/**
 * Build the complete SELECT clause with optional CTEs
 */
type BuildSelectClauseWithCTEs<
  Columns,
  From extends TableSource,
  Rest extends string,
  Distinct extends boolean,
  CTEs extends CTEDefinition[] | undefined,
> = BuildSelectClauseWithCTEsAndRest<Columns, From, Rest, Distinct, CTEs> extends infer Result
  ? Result extends { query: infer Q extends SelectClause; rest: string }
    ? SQLSelectQuery<Q>
    : Result
  : never

/**
 * Build the complete SELECT clause with optional CTEs, returning both query and rest
 */
type BuildSelectClauseWithCTEsAndRest<
  Columns,
  From extends TableSource,
  Rest extends string,
  Distinct extends boolean,
  CTEs extends CTEDefinition[] | undefined,
> = ParseOptionalClausesWithRest<Rest> extends infer OptionalResult
  ? OptionalResult extends ParseError<string>
  ? OptionalResult
  : OptionalResult extends {
    joins: infer Joins
    where: infer Where
    groupBy: infer GroupBy
    having: infer Having
    orderBy: infer OrderBy
    limit: infer Limit
    offset: infer Offset
    rest: infer Remaining extends string
  }
  ? {
    query: SelectClause<
      Columns extends "*" ? "*" : Columns extends SelectItem[] ? Columns : never,
      From,
      Joins extends JoinClause[] ? Joins : undefined,
      Where extends WhereExpr ? Where : undefined,
      GroupBy extends ColumnRefType[] ? GroupBy : undefined,
      Having extends WhereExpr ? Having : undefined,
      OrderBy extends OrderByItem[] ? OrderBy : undefined,
      Limit extends number ? Limit : undefined,
      Offset extends number ? Offset : undefined,
      Distinct,
      CTEs
    >
    rest: Remaining
  }
  : never
  : never

/**
 * Parse all optional clauses (JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET)
 */
type ParseOptionalClauses<T extends string> = ParseOptionalClausesWithRest<T> extends infer Result
  ? Result extends { rest: string }
    ? Omit<Result, "rest">
    : Result
  : never

/**
 * Parse all optional clauses with remaining rest
 */
type ParseOptionalClausesWithRest<T extends string> = ParseJoins<T> extends infer JoinResult
  ? JoinResult extends { joins: infer Joins; rest: infer AfterJoins extends string }
  ? ParseWhereClause<AfterJoins> extends infer WhereResult
  ? WhereResult extends { where: infer Where; rest: infer AfterWhere extends string }
  ? ParseGroupBy<AfterWhere> extends infer GroupByResult
  ? GroupByResult extends {
    groupBy: infer GroupBy
    rest: infer AfterGroupBy extends string
  }
  ? ParseHaving<AfterGroupBy> extends infer HavingResult
  ? HavingResult extends {
    having: infer Having
    rest: infer AfterHaving extends string
  }
  ? ParseOrderBy<AfterHaving> extends infer OrderByResult
  ? OrderByResult extends {
    orderBy: infer OrderBy
    rest: infer AfterOrderBy extends string
  }
  ? ParseLimitOffsetWithRest<AfterOrderBy> extends infer LimitResult
  ? LimitResult extends { limit: infer Limit; offset: infer Offset; rest: infer AfterLimitOffset extends string }
  ? {
    joins: Joins
    where: Where
    groupBy: GroupBy
    having: Having
    orderBy: OrderBy
    limit: Limit
    offset: Offset
    rest: AfterLimitOffset
  }
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never
  : never

// ============================================================================
// JOIN Parser
// ============================================================================

/**
 * Parse JOIN clauses
 */
type ParseJoins<T extends string> = Trim<T> extends ""
  ? { joins: undefined; rest: "" }
  : IsJoinStart<T> extends true
  ? ParseJoinList<T, []>
  : { joins: undefined; rest: T }

/**
 * Check if string starts with a JOIN keyword
 */
type IsJoinStart<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer _,
]
  ? First extends "JOIN" | "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"
  ? true
  : false
  : false

/**
 * Parse a list of JOINs
 */
type ParseJoinList<T extends string, Acc extends JoinClause[]> = IsJoinStart<T> extends true
  ? ParseSingleJoin<T> extends infer JoinResult
  ? JoinResult extends { join: infer J extends JoinClause; rest: infer Rest extends string }
  ? ParseJoinList<Rest, [...Acc, J]>
  : JoinResult extends ParseError<string>
  ? JoinResult
  : { joins: Acc extends [] ? undefined : Acc; rest: T }
  : never
  : { joins: Acc extends [] ? undefined : Acc; rest: T }

/**
 * Parse a single JOIN clause
 */
type ParseSingleJoin<T extends string> =
  [ExtractJoinType<T>] extends [never]
  ? ParsePlainJoin<T>
  : ParseTypedJoin<T, ExtractJoinType<T>>

/**
 * Parse a plain JOIN (without INNER/LEFT/etc prefix) - treated as INNER JOIN
 */
type ParsePlainJoin<T extends string> = 
  NextToken<T> extends ["JOIN", infer AfterJoin extends string]
    ? ExtractUntil<AfterJoin, "ON" | FromTerminators> extends [
        infer TablePart extends string,
        infer OnPart extends string,
      ]
      ? StartsWith<OnPart, "ON"> extends true
        ? NextToken<OnPart> extends ["ON", infer ConditionPart extends string]
          ? ExtractUntil<ConditionPart, FromTerminators | "JOIN" | "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"> extends [
              infer Condition extends string,
              infer Rest extends string,
            ]
            ? {
                join: JoinClause<"INNER", ParseTableRef<TablePart>, ParsedCondition<ScanTokensForColumnRefs<Trim<Condition>, []>>>
                rest: Rest
              }
            : {
                join: JoinClause<"INNER", ParseTableRef<TablePart>, ParsedCondition<ScanTokensForColumnRefs<Trim<ConditionPart>, []>>>
                rest: ""
              }
          : never
        : {
            join: JoinClause<"INNER", ParseTableRef<TablePart>, undefined>
            rest: OnPart
          }
      : never
    : ParseError<"Invalid JOIN syntax">

/**
 * Parse a typed JOIN (INNER/LEFT/RIGHT/FULL/CROSS JOIN)
 */
type ParseTypedJoin<T extends string, JoinTypeResult> =
  JoinTypeResult extends [infer JType extends JoinType, infer AfterType extends string]
  ? NextToken<AfterType> extends ["JOIN", infer AfterJoin extends string]
  ? ExtractUntil<AfterJoin, "ON" | FromTerminators> extends [
    infer TablePart extends string,
    infer OnPart extends string,
  ]
  ? StartsWith<OnPart, "ON"> extends true
  ? NextToken<OnPart> extends ["ON", infer ConditionPart extends string]
  ? ExtractUntil<ConditionPart, FromTerminators | "JOIN" | "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"> extends [
    infer Condition extends string,
    infer Rest extends string,
  ]
  ? {
    join: JoinClause<JType, ParseTableRef<TablePart>, ParsedCondition<ScanTokensForColumnRefs<Trim<Condition>, []>>>
    rest: Rest
  }
  : {
    join: JoinClause<JType, ParseTableRef<TablePart>, ParsedCondition<ScanTokensForColumnRefs<Trim<ConditionPart>, []>>>
    rest: ""
  }
  : never
  : {
    join: JoinClause<JType, ParseTableRef<TablePart>, undefined>
    rest: OnPart
  }
  : {
    join: JoinClause<JType, ParseTableRef<AfterJoin>, undefined>
    rest: ""
  }
  : ParseError<"Expected JOIN keyword">
  : never

/**
 * Extract join type from the beginning of the string
 */
type ExtractJoinType<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "INNER"
  ? ["INNER", Rest]
  : First extends "LEFT"
  ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
  ? ["LEFT OUTER", AfterOuter]
  : ["LEFT", Rest]
  : First extends "RIGHT"
  ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
  ? ["RIGHT OUTER", AfterOuter]
  : ["RIGHT", Rest]
  : First extends "FULL"
  ? NextToken<Rest> extends ["OUTER", infer AfterOuter extends string]
  ? ["FULL OUTER", AfterOuter]
  : ["FULL", Rest]
  : First extends "CROSS"
  ? ["CROSS", Rest]
  : never
  : never

// ============================================================================
// WHERE Clause Parser
// ============================================================================

/**
 * Parse WHERE clause
 * Extracts column references for validation without fully parsing the expression structure.
 */
type ParseWhereClause<T extends string> = Trim<T> extends ""
  ? { where: undefined; rest: "" }
  : NextToken<T> extends ["WHERE", infer Rest extends string]
    ? ExtractUntil<Rest, WhereTerminators> extends [
        infer WherePart extends string,
        infer Remaining extends string,
      ]
      ? { where: ParsedCondition<ScanTokensForColumnRefs<Trim<WherePart>, []>>; rest: Remaining }
      : { where: ParsedCondition<ScanTokensForColumnRefs<Trim<Rest>, []>>; rest: "" }
    : { where: undefined; rest: T }

// ============================================================================
// GROUP BY Parser
// ============================================================================

/**
 * Parse GROUP BY clause
 */
type ParseGroupBy<T extends string> = Trim<T> extends ""
  ? { groupBy: undefined; rest: "" }
  : NextToken<T> extends ["GROUP", infer Rest extends string]
  ? NextToken<Rest> extends ["BY", infer AfterBy extends string]
  ? ExtractUntil<AfterBy, "HAVING" | "ORDER" | "LIMIT" | "OFFSET"> extends [
    infer GroupPart extends string,
    infer Remaining extends string,
  ]
  ? { groupBy: ParseGroupByList<GroupPart>; rest: Remaining }
  : { groupBy: ParseGroupByList<AfterBy>; rest: "" }
  : ParseError<"Expected BY after GROUP">
  : { groupBy: undefined; rest: T }

/**
 * Parse GROUP BY column list
 */
type ParseGroupByList<T extends string> = SplitByComma<Trim<T>> extends infer Parts extends string[]
  ? ParseGroupByColumns<Parts>
  : []

/**
 * Parse list of GROUP BY columns
 */
type ParseGroupByColumns<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [ParseColumnRefType<First>, ...ParseGroupByColumns<Rest>]
  : []

// ============================================================================
// HAVING Parser
// ============================================================================

/**
 * Parse HAVING clause
 * Extracts column references for validation
 */
type ParseHaving<T extends string> = Trim<T> extends ""
  ? { having: undefined; rest: "" }
  : NextToken<T> extends ["HAVING", infer Rest extends string]
  ? ExtractUntil<Rest, "ORDER" | "LIMIT" | "OFFSET"> extends [
    infer HavingPart extends string,
    infer Remaining extends string,
  ]
  ? { having: ParsedCondition<ScanTokensForColumnRefs<Trim<HavingPart>, []>>; rest: Remaining }
  : { having: ParsedCondition<ScanTokensForColumnRefs<Trim<Rest>, []>>; rest: "" }
  : { having: undefined; rest: T }

// ============================================================================
// ORDER BY Parser
// ============================================================================

/**
 * Parse ORDER BY clause
 */
type ParseOrderBy<T extends string> = Trim<T> extends ""
  ? { orderBy: undefined; rest: "" }
  : NextToken<T> extends ["ORDER", infer Rest extends string]
  ? NextToken<Rest> extends ["BY", infer AfterBy extends string]
  ? ExtractUntil<AfterBy, OrderByTerminators> extends [
    infer OrderPart extends string,
    infer Remaining extends string,
  ]
  ? { orderBy: ParseOrderByList<OrderPart>; rest: Remaining }
  : { orderBy: ParseOrderByList<AfterBy>; rest: "" }
  : ParseError<"Expected BY after ORDER">
  : { orderBy: undefined; rest: T }

/**
 * Parse ORDER BY column list
 */
type ParseOrderByList<T extends string> = SplitByComma<Trim<T>> extends infer Parts extends string[]
  ? ParseOrderByItems<Parts>
  : []

/**
 * Parse list of ORDER BY items
 */
type ParseOrderByItems<T extends string[]> = T extends [
  infer First extends string,
  ...infer Rest extends string[],
]
  ? [ParseOrderByItem<First>, ...ParseOrderByItems<Rest>]
  : []

/**
 * Parse a single ORDER BY item
 */
type ParseOrderByItem<T extends string> = Trim<T> extends `${infer Col} DESC`
  ? OrderByItem<ParseOrderByColumnRef<Col>, "DESC">
  : Trim<T> extends `${infer Col} ASC`
  ? OrderByItem<ParseOrderByColumnRef<Col>, "ASC">
  : OrderByItem<ParseOrderByColumnRef<Trim<T>>, "ASC">

/**
 * Parse column reference for ORDER BY, handling JSON accessors
 */
type ParseOrderByColumnRef<T extends string> =
  // First try to extract from JSON expression using the token-based extractor
  ExtractColumnFromToken<Trim<T>> extends infer Result extends ValidatableColumnRef
    ? Result
    : ParseColumnRefType<T>  // Fallback to regular parsing for non-JSON columns

// ============================================================================
// LIMIT/OFFSET Parser
// ============================================================================

/**
 * Parse LIMIT and OFFSET clauses
 */
type ParseLimitOffset<T extends string> = ParseLimitOffsetWithRest<T> extends infer Result
  ? Result extends { rest: string }
    ? Omit<Result, "rest">
    : Result
  : never

/**
 * Parse LIMIT and OFFSET clauses, returning remaining rest
 */
type ParseLimitOffsetWithRest<T extends string> = ParseLimit<T> extends {
  limit: infer Limit
  rest: infer AfterLimit extends string
}
  ? ParseOffset<AfterLimit> extends { offset: infer Offset; rest: infer AfterOffset extends string }
    ? { limit: Limit; offset: Offset; rest: AfterOffset }
    : { limit: Limit; offset: undefined; rest: AfterLimit }
  : ParseOffset<T> extends { offset: infer Offset; rest: infer AfterOffset extends string }
    ? ParseLimit<AfterOffset> extends { limit: infer Limit; rest: infer AfterLimit extends string }
      ? { limit: Limit; offset: Offset; rest: AfterLimit }
      : { limit: undefined; offset: Offset; rest: AfterOffset }
    : { limit: undefined; offset: undefined; rest: T }

/**
 * Parse LIMIT clause
 */
type ParseLimit<T extends string> = Trim<T> extends ""
  ? { limit: undefined; rest: "" }
  : NextToken<T> extends ["LIMIT", infer Rest extends string]
  ? NextToken<Rest> extends [infer Num extends string, infer Remaining extends string]
  ? { limit: ParseNumber<Num>; rest: Remaining }
  : { limit: undefined; rest: T }
  : { limit: undefined; rest: T }

/**
 * Parse OFFSET clause
 */
type ParseOffset<T extends string> = Trim<T> extends ""
  ? { offset: undefined; rest: "" }
  : NextToken<T> extends ["OFFSET", infer Rest extends string]
  ? NextToken<Rest> extends [infer Num extends string, infer Remaining extends string]
  ? { offset: ParseNumber<Num>; rest: Remaining }
  : { offset: undefined; rest: T }
  : { offset: undefined; rest: T }

/**
 * Parse a string as a number
 */
type ParseNumber<T extends string> = T extends `${infer N extends number}` ? N : undefined

