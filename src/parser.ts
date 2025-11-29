/**
 * Type-level SQL SELECT parser
 */

import type {
  SelectClause,
  TableRef,
  TableSource,
  DerivedTableRef,
  CTEDefinition,
  ColumnRef,
  ColumnRefType,
  TableColumnRef,
  UnboundColumnRef,
  TableWildcard,
  ComplexExpr,
  SubqueryExpr,
  ValidatableColumnRef,
  WhereExpr,
  BinaryExpr,
  LogicalExpr,
  LogicalExprAny,
  ComparisonOp,
  LogicalOp,
  JoinClause,
  JoinType,
  OrderByItem,
  SortDirection,
  AggregateExpr,
  AggregateFunc,
  LiteralValue,
  SelectItem,
  SQLQuery,
  UnparsedExpr,
} from "./ast.js"

import type {
  NormalizeSQL,
  NextToken,
  ExtractUntil,
  SplitByComma,
  FromTerminators,
  WhereTerminators,
  OrderByTerminators,
  StartsWith,
} from "./tokenizer.js"

import type { Trim, ParseError, Flatten, RemoveQuotes, Increment, Decrement } from "./utils.js"

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Parse a SQL SELECT query string into an AST
 */
export type ParseSQL<T extends string> = ParseSelectQuery<NormalizeSQL<T>>

/**
 * Parse a normalized SELECT query (handles WITH clause if present)
 */
type ParseSelectQuery<T extends string> = NextToken<T> extends [
  infer First extends string,
  infer Rest extends string,
]
  ? First extends "WITH"
    ? ParseWithAndSelect<Rest>
    : First extends "SELECT"
      ? ParseSelectBodyWithCTEs<Rest, undefined>
      : ParseError<`Expected SELECT or WITH, got: ${First}`>
  : ParseError<"Empty query">

/**
 * Parse WITH clause followed by SELECT
 */
type ParseWithAndSelect<T extends string> = ParseCTEList<T> extends infer CTEResult
  ? CTEResult extends { ctes: infer CTEs extends CTEDefinition[]; rest: infer AfterCTEs extends string }
    ? NextToken<AfterCTEs> extends ["SELECT", infer SelectRest extends string]
      ? ParseSelectBodyWithCTEs<SelectRest, CTEs>
      : ParseError<"Expected SELECT after WITH clause">
    : CTEResult
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
        ? ParseSelectQuery<QueryStr> extends SQLQuery<infer Query extends SelectClause>
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
  ? BuildSelectClauseWithCTEs<Columns, From, Rest, IsDistinct, CTEs>
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
      // Check for complex expression (contains JSON operators or parentheses with operators)
      : IsComplexExpression<T> extends true
        ? ParseComplexColumn<T>
        // Simple column with optional alias
        : T extends `${infer Col} AS ${infer Alias}`
          ? ColumnRef<ParseColumnRefType<StripTypeCast<Trim<Col>>>, RemoveQuotes<Alias>>
          : ColumnRef<ParseColumnRefType<StripTypeCast<T>>, ExtractColumnName<StripTypeCast<T>>>

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
    ? ParseSelectQuery<Inner> extends SQLQuery<infer Query extends SelectClause>
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
 * Check if the expression is complex (contains JSON operators, function calls, nested parens, type casts, etc.)
 */
type IsComplexExpression<T extends string> = 
  T extends `${string}->${string}` ? true :
  T extends `${string}->>${string}` ? true :
  T extends `${string}#>${string}` ? true :
  T extends `${string}#>>${string}` ? true :
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
 */
type ScanTokensForColumnRefs<
  T extends string,
  Acc extends ValidatableColumnRef[]
> = Trim<T> extends ""
  ? Acc
  : NextToken<Trim<T>> extends [infer Token extends string, infer Rest extends string]
    ? ExtractColumnFromToken<Token> extends infer ColRef
      // Must check [ColRef] extends [never] first because never extends everything
      ? [ColRef] extends [never]
        ? ScanTokensForColumnRefs<Rest, Acc>
        : ColRef extends ValidatableColumnRef
          ? ScanTokensForColumnRefs<Rest, [...Acc, ColRef]>
          : ScanTokensForColumnRefs<Rest, Acc>
      : ScanTokensForColumnRefs<Rest, Acc>
    : Acc

/**
 * Try to extract a column reference from a single token
 * Handles: alias."col", alias."col"::type, "table"."col", "col", "col"::type
 * Also handles unquoted: table.col::type, col::type
 */
type ExtractColumnFromToken<T extends string> =
  // Pattern: alias."column"::type (with cast) - alias must be simple identifier
  T extends `${infer Alias}."${infer Col}"::${string}`
    ? IsSimpleIdentifier<Alias> extends true
      ? TableColumnRef<Alias, Col>
      : never
  // Pattern: alias."column" (no cast)
  : T extends `${infer Alias}."${infer Col}"`
    ? IsSimpleIdentifier<Alias> extends true
      ? TableColumnRef<Alias, Col>
      : never
  // Pattern: "table"."column"::type
  : T extends `"${infer Table}"."${infer Col}"::${string}`
    ? TableColumnRef<Table, Col>
  // Pattern: "table"."column"
  : T extends `"${infer Table}"."${infer Col}"`
    ? TableColumnRef<Table, Col>
  // Pattern: "column"::type (unbound column with cast)
  : T extends `"${infer Col}"::${string}`
    ? UnboundColumnRef<Col>
  // Pattern: "column" followed by JSON operator
  : T extends `"${infer Col}"->>${string}`
    ? UnboundColumnRef<Col>
  : T extends `"${infer Col}"->${string}`
    ? UnboundColumnRef<Col>
  // Pattern: table.column::type (unquoted with cast)
  : T extends `${infer Table}.${infer Col}::${string}`
    ? IsSimpleIdentifier<Table> extends true
      ? TableColumnRef<Table, ExtractBeforeCast<Col>>
      : never
  // Pattern: column::type (unquoted simple column with cast)
  : T extends `${infer Col}::${string}`
    ? IsSimpleIdentifier<ExtractBeforeCast<Col>> extends true
      ? UnboundColumnRef<ExtractBeforeCast<Col>>
      : never
  : never

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
  T extends "(" | ")" | "," | "/" | "*" | "+" | "-" | "=" ? false :
  true

/**
 * Extract the final type cast from an expression
 * Looks for ::type at the very end (after all parentheses)
 * e.g., ( expr ) ::text -> "text"
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
 */
type ExtractComplexColumnName<T extends string> = 
  T extends `${string} AS ${infer Alias}` ? RemoveQuotes<Alias> :
  "expr"

/**
 * Strip PostgreSQL type cast syntax (::type) from a column reference
 * e.g., "id::text" -> "id", "col::varchar(255)" -> "col"
 */
type StripTypeCast<T extends string> = T extends `${infer Col}::${string}`
  ? Trim<Col>
  : T

/**
 * Check if this is a table.* or alias.* pattern
 */
type IsTableWildcard<T extends string> = Trim<T> extends `${string}.*`
  ? true
  : Trim<T> extends `${string}. *`
  ? true
  : false

/**
 * Parse a table.* wildcard into a TableWildcard type
 */
type ParseTableWildcard<T extends string> = Trim<T> extends `${infer Table}.*`
  ? TableWildcard<RemoveQuotes<Table>>
  : Trim<T> extends `${infer Table}. *`
  ? TableWildcard<RemoveQuotes<Table>>
  : never

/**
 * Extract column name for default alias (removes quotes)
 */
type ExtractColumnName<T extends string> = T extends `${infer _}.${infer Col}`
  ? RemoveQuotes<Col>
  : RemoveQuotes<T>

/**
 * Parse a column reference (table.column or just column)
 * Removes quotes from both table and column names
 */
type ParseColumnRefType<T extends string> = Trim<T> extends `${infer Table}.${infer Col}`
  ? TableColumnRef<RemoveQuotes<Table>, RemoveQuotes<Col>>
  : UnboundColumnRef<RemoveQuotes<T>>

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
    ? ParseSelectQuery<Trim<QueryStr>> extends SQLQuery<infer Query extends SelectClause>
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
 * Parse a table reference with optional alias
 * Removes quotes from both table name and alias
 */
type ParseTableRef<T extends string> = Trim<T> extends `${infer Table} AS ${infer Alias}`
  ? TableRef<RemoveQuotes<Table>, RemoveQuotes<Alias>>
  : Trim<T> extends `${infer Table} ${infer Alias}`
  ? Alias extends FromTerminators
  ? TableRef<RemoveQuotes<Table>, RemoveQuotes<Table>>
  : TableRef<RemoveQuotes<Table>, RemoveQuotes<Alias>>
  : TableRef<RemoveQuotes<T>, RemoveQuotes<T>>

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
> = ParseOptionalClauses<Rest> extends infer OptionalResult
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
  }
  ? SQLQuery<
    SelectClause<
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
  >
  : never
  : never

/**
 * Parse all optional clauses (JOIN, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET)
 */
type ParseOptionalClauses<T extends string> = ParseJoins<T> extends infer JoinResult
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
  ? ParseLimitOffset<AfterOrderBy> extends infer LimitResult
  ? LimitResult extends { limit: infer Limit; offset: infer Offset }
  ? {
    joins: Joins
    where: Where
    groupBy: GroupBy
    having: Having
    orderBy: OrderBy
    limit: Limit
    offset: Offset
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
 * Note: We check [ExtractJoinType<T>] extends [never] first to detect plain JOIN vs INNER/LEFT/etc JOIN
 */
type ParseSingleJoin<T extends string> =
  [ExtractJoinType<T>] extends [never]
  ? ParsePlainJoin<T>
  : ParseTypedJoin<T, ExtractJoinType<T>>

/**
 * Parse a plain JOIN (without INNER/LEFT/etc prefix) - treated as INNER JOIN
 * Note: ON conditions are not fully parsed since they don't affect type inference
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
              infer _Condition extends string,
              infer Rest extends string,
            ]
            ? {
                join: JoinClause<"INNER", ParseTableRef<TablePart>, UnparsedExpr>
                rest: Rest
              }
            : {
                join: JoinClause<"INNER", ParseTableRef<TablePart>, UnparsedExpr>
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
 * Note: ON conditions are not fully parsed since they don't affect type inference
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
    infer _Condition extends string,
    infer Rest extends string,
  ]
  ? {
    join: JoinClause<JType, ParseTableRef<TablePart>, UnparsedExpr>
    rest: Rest
  }
  : {
    join: JoinClause<JType, ParseTableRef<TablePart>, UnparsedExpr>
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
 * Note: We don't fully parse WHERE expressions since they're not used for type inference.
 * This significantly reduces recursion depth for complex queries.
 */
type ParseWhereClause<T extends string> = Trim<T> extends ""
  ? { where: undefined; rest: "" }
  : NextToken<T> extends ["WHERE", infer Rest extends string]
    ? ExtractUntil<Rest, WhereTerminators> extends [
        infer _WherePart extends string,
        infer Remaining extends string,
      ]
      ? { where: UnparsedExpr; rest: Remaining }
      : { where: UnparsedExpr; rest: "" }
    : { where: undefined; rest: T }


/**
 * Parse a WHERE expression (handles AND/OR)
 * Simplified version that doesn't recurse deeply
 */
type ParseWhereExpr<T extends string> = ParseSimpleWhereExpr<Trim<T>>

/**
 * Simplified WHERE expression parser - creates a simple comparison
 * without recursively parsing complex AND/OR trees
 */
type ParseSimpleWhereExpr<T extends string> = 
  // Just create a simple binary expression for the first comparison found
  T extends `${infer Left} = ${infer Right}`
    ? BinaryExpr<ParseOperand<Left>, "=", ParseOperand<Right>>
    : BinaryExpr<LiteralValue<true>, "=", LiteralValue<true>>

/**
 * Split by a logical operator (simple version without parenthesis handling)
 */
type SplitByLogicalOp<T extends string, Op extends string> =
  T extends `${infer L} ${Op} ${infer R}` ? [Trim<L>, Trim<R>] : never

/**
 * Parse a comparison expression
 */
type ParseComparison<T extends string> = Trim<T> extends `${infer L} = ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "=", ParseOperand<R>>
  : Trim<T> extends `${infer L} != ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "!=", ParseOperand<R>>
  : Trim<T> extends `${infer L} <> ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "<>", ParseOperand<R>>
  : Trim<T> extends `${infer L} >= ${infer R}`
  ? BinaryExpr<ParseOperand<L>, ">=", ParseOperand<R>>
  : Trim<T> extends `${infer L} <= ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "<=", ParseOperand<R>>
  : Trim<T> extends `${infer L} > ${infer R}`
  ? BinaryExpr<ParseOperand<L>, ">", ParseOperand<R>>
  : Trim<T> extends `${infer L} < ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "<", ParseOperand<R>>
  : Trim<T> extends `${infer L} LIKE ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "LIKE", ParseOperand<R>>
  : Trim<T> extends `${infer L} ILIKE ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "ILIKE", ParseOperand<R>>
  : Trim<T> extends `${infer L} IS NOT ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "IS NOT", ParseOperand<R>>
  : Trim<T> extends `${infer L} IS ${infer R}`
  ? BinaryExpr<ParseOperand<L>, "IS", ParseOperand<R>>
  : BinaryExpr<ParseOperand<T>, "=", LiteralValue<true>>

/**
 * Parse an operand (column reference or literal)
 */
type ParseOperand<T extends string> = Trim<T> extends `'${infer Val}'`
  ? LiteralValue<Val>
  : Trim<T> extends `"${infer Val}"`
  ? LiteralValue<Val>
  : Trim<T> extends "NULL"
  ? LiteralValue<null>
  : Trim<T> extends "TRUE"
  ? LiteralValue<true>
  : Trim<T> extends "FALSE"
  ? LiteralValue<false>
  : IsNumericString<Trim<T>> extends true
  ? LiteralValue<Trim<T>>
  : ParseColumnRefType<Trim<T>>

/**
 * Check if a string looks like a number
 */
type IsNumericString<T extends string> = T extends `${number}` ? true : false

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
 */
type ParseHaving<T extends string> = Trim<T> extends ""
  ? { having: undefined; rest: "" }
  : NextToken<T> extends ["HAVING", infer Rest extends string]
  ? ExtractUntil<Rest, "ORDER" | "LIMIT" | "OFFSET"> extends [
    infer HavingPart extends string,
    infer Remaining extends string,
  ]
  ? { having: ParseWhereExpr<HavingPart>; rest: Remaining }
  : { having: ParseWhereExpr<Rest>; rest: "" }
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
  ? OrderByItem<ParseColumnRefType<Col>, "DESC">
  : Trim<T> extends `${infer Col} ASC`
  ? OrderByItem<ParseColumnRefType<Col>, "ASC">
  : OrderByItem<ParseColumnRefType<Trim<T>>, "ASC">

// ============================================================================
// LIMIT/OFFSET Parser
// ============================================================================

/**
 * Parse LIMIT and OFFSET clauses
 */
type ParseLimitOffset<T extends string> = ParseLimit<T> extends {
  limit: infer Limit
  rest: infer AfterLimit extends string
}
  ? ParseOffset<AfterLimit> extends { offset: infer Offset }
  ? { limit: Limit; offset: Offset }
  : { limit: Limit; offset: undefined }
  : ParseOffset<T> extends { offset: infer Offset; rest: infer AfterOffset extends string }
  ? ParseLimit<AfterOffset> extends { limit: infer Limit }
  ? { limit: Limit; offset: Offset }
  : { limit: undefined; offset: Offset }
  : { limit: undefined; offset: undefined }

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

