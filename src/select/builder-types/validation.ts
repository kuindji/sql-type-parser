import type { DatabaseSchema } from "../../common/schema.js";
import type {
    Flatten,
    MatchError,
    Trim,
    UnionQueryError,
} from "../../common/utils.js";
import type { SelectQueryBuilder } from "./builder.js";
import type {
    AnyBuilderSqlTag,
    AssembleBuilderSql,
    BuilderSqlTag,
    BuilderStateTag,
    ClauseList,
    ClauseListToString,
    ColumnsArrayToRow,
    ContextSqlFromTag,
    DefaultSchemaName,
    IsLiteralString,
    IsUnionSqlError,
    JoinClauseString,
    SchemaTables,
    SelectClauseString,
    SqlClausePart,
} from "./helpers.js";

// ============================================================================
// Builder-level SQL & validation helpers
// ============================================================================

/**
 * Extract the internal lightweight builder state tag from a builder type.
 */
export type BuilderStateOf<B> = B extends SelectQueryBuilder<
    any,
    infer S extends BuilderStateTag<any, any, any>,
    any
> ? S
    : never;

/**
 * Internal helper: normalize an assembled SQL string from a BuilderSqlTag
 * into a plain string type.
 */
type BuilderSqlString<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = AssembleBuilderSql<Sql> extends infer Q extends string ? Q
    : string;

/**
 * Internal helper: validate that all referenced tables in the assembled
 * SQL fragments exist in the schema. This is a shallow, table-only check
 * (no column or expression validation) to avoid hitting type recursion
 * limits while still surfacing obvious FROM/JOIN mistakes.
 */
type BuilderFromTableSpec<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = Sql["from"] extends infer F extends string
    ? F extends `${infer T} ${string}` ? T
    : F
    : never;

type BuilderJoinTablesSpec<
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = JoinClauseString<Sql> extends infer J extends string ? ExtractJoinTables<J>
    : never;

type ExtractJoinTables<S extends string> = S extends
    `${string}JOIN ${infer Rest}`
    ? Rest extends `${infer TableSpec} ${infer Tail}`
        ? TableSpec | ExtractJoinTables<Tail>
    : Rest
    : never;

/** Extract just the table reference (without alias) from a table spec */
type ExtractTableRefPart<S extends string> =
    // Pattern: something AS alias
    Trim<S> extends `${infer TablePart} AS ${string}` ? TablePart
        // Pattern: "quoted" alias (quoted identifier followed by space and alias)
        : Trim<S> extends `"${infer Quoted}" ${string}` ? `"${Quoted}"`
        // Pattern: `quoted` alias (backtick quoted identifier followed by space and alias)
        : Trim<S> extends `\`${infer Quoted}\` ${string}` ? `\`${Quoted}\``
        // Pattern: 'quoted' alias (single quoted identifier followed by space and alias)
        : Trim<S> extends `'${infer Quoted}' ${string}` ? `'${Quoted}'`
        // Pattern: schema.table alias (need to handle "schema"."table" specially)
        : Trim<S> extends `"${infer S1}"."${infer T1}" ${string}`
            ? `"${S1}"."${T1}"`
        : Trim<S> extends `${infer Schema}.${infer Rest}`
        // Rest might be "table" alias or table alias
            ? Rest extends `"${infer Quoted}" ${string}`
                ? `${Schema}."${Quoted}"`
            : Rest extends `${infer Table} ${string}` ? `${Schema}.${Table}`
            : S
        // Pattern: table alias (unquoted)
        : Trim<S> extends `${infer Table} ${string}` ? Table
        // No alias, return as-is
        : Trim<S>;

/** Parse the schema and table from a table reference (without alias) */
type ParseTableRefPart<T extends string> =
    // Pattern: "schema"."table"
    Trim<T> extends `"${infer Schema}"."${infer Table}"` ? [ Schema, Table ]
        // Pattern: schema."table"
        : Trim<T> extends `${infer Schema}."${infer Table}"` ? [ Schema, Table ]
        // Pattern: "schema".table
        : Trim<T> extends `"${infer Schema}".${infer Table}` ? [ Schema, Table ]
        // Pattern: schema.table (both unquoted)
        : Trim<T> extends `${infer Schema}.${infer Table}` ? [ Schema, Table ]
        // Pattern: "table" (just quoted)
        : Trim<T> extends `"${infer Table}"` ? [ undefined, Table ]
        // Pattern: `table` (backtick quoted)
        : Trim<T> extends `\`${infer Table}\`` ? [ undefined, Table ]
        // Pattern: 'table' (single quoted)
        : Trim<T> extends `'${infer Table}'` ? [ undefined, Table ]
        // No schema, just table
        : [ undefined, Trim<T> ];

type NormalizeTableSpec<
    TableSpec extends string,
> = ParseTableRefPart<ExtractTableRefPart<TableSpec>>;

type BuilderCheckTable<
    Schema extends DatabaseSchema,
    TableSpec extends string,
> = IsLiteralString<TableSpec> extends false ? true
    : NormalizeTableSpec<TableSpec> extends [
        infer SchemaName extends string | undefined,
        infer TableName extends string,
    ]
    // Check for undefined explicitly first (due to TypeScript inference quirk)
        ? [ SchemaName ] extends [ undefined ]
            ? TableName extends keyof SchemaTables<Schema> ? true
            : `Table '${TableName}' not found in default schema '${DefaultSchemaName<
                Schema
            >}'`
        : SchemaName extends keyof Schema["schemas"]
            ? TableName extends keyof Schema["schemas"][SchemaName] ? true
            : `Table '${TableName}' not found in schema '${
                & SchemaName
                & string}'`
        : `Schema '${SchemaName & string}' not found`
    : true;

type BuilderCheckTables<
    Schema extends DatabaseSchema,
    Specs extends string,
> = [ Specs ] extends [ never ] ? true
    : true extends {
        [K in Specs]: BuilderCheckTable<Schema, K> extends true ? true
            : never;
    }[Specs] ? true
    : {
        [K in Specs]: BuilderCheckTable<Schema, K> extends true ? never
            : BuilderCheckTable<Schema, K>;
    }[Specs];

export type BuilderTablesValid<
    Schema extends DatabaseSchema,
    Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >,
> = BuilderCheckTable<
    Schema,
    BuilderFromTableSpec<Sql>
> extends infer FromResult ? FromResult extends true ? BuilderCheckTables<
            Schema,
            BuilderJoinTablesSpec<Sql> & string
        >
    : FromResult
    : true;

/**
 * Lightweight table validation that only uses from/joins from the Sql tag.
 * Avoids needing to fully instantiate complex union Sql types.
 */
export type LightweightTablesValid<
    Schema extends DatabaseSchema,
    From,
    Joins,
> = BuilderCheckTable<
    Schema,
    From extends string ? From extends `${infer T} ${string}` ? T : From
        : never
> extends infer FromResult
    ? FromResult extends true
        ? Joins extends string
            ? BuilderCheckTables<Schema, ExtractJoinTables<Joins> & string>
        : Joins extends ClauseList ? BuilderCheckTables<
                Schema,
                ExtractJoinTables<ClauseListToString<Joins, " ">> & string
            >
        : true
    : FromResult
    : true;

// ============================================================================
// Column Validation
// ============================================================================

/**
 * Extract base expression from a column (strips AS alias).
 * Handles function calls with spaces inside correctly.
 */
type ColumnBaseExpr<S extends string> =
    // Pattern: expr AS alias (case insensitive)
    Lowercase<S> extends `${string} as ${string}`
        ? S extends `${infer Base} AS ${string}` ? Base
        : S extends `${infer Base} As ${string}` ? Base
        : S extends `${infer Base} aS ${string}` ? Base
        : S extends `${infer Base} as ${string}` ? Base
        : S
    // Pattern: expr "alias" (no AS keyword, just space before quoted alias)
    : S extends `${infer Base} "${string}"` ? Base
    // Pattern: simple expression without alias
    : S;

/**
 * Strip double quotes from an identifier.
 */
type StripQuotes<S extends string> = S extends `"${infer Inner}"` ? Inner : S;

/**
 * Extract the table name from a FROM clause (strips alias).
 * "users u" → "users", "users AS u" → "users", "users" → "users"
 */
type ExtractFromTableName<S extends string> =
    Lowercase<S> extends `${string} as ${string}`
        ? S extends `${infer Table} AS ${string}` ? Trim<Table>
        : S extends `${infer Table} As ${string}` ? Trim<Table>
        : S extends `${infer Table} aS ${string}` ? Trim<Table>
        : S extends `${infer Table} as ${string}` ? Trim<Table>
        : S
    : S extends `${infer Table} ${string}` ? Trim<Table>
    : S;

/**
 * Extract the alias from a FROM clause.
 * "users u" → "u", "users AS u" → "u", "users" → ""
 */
type ExtractFromAlias<S extends string> =
    Lowercase<S> extends `${string} as ${string}`
        ? S extends `${string} AS ${infer Alias}` ? Trim<Alias>
        : S extends `${string} As ${infer Alias}` ? Trim<Alias>
        : S extends `${string} aS ${infer Alias}` ? Trim<Alias>
        : S extends `${string} as ${infer Alias}` ? Trim<Alias>
        : ""
    : S extends `${string} ${infer Alias}` ? Trim<Alias>
    : "";

/**
 * Validate a single column expression against the schema and from table.
 * Handles:
 * - Unqualified columns: "id", `"id"`
 * - Table-qualified: "users.id", `users."id"`
 * - Schema-qualified: "public.users.id", `public.users."id"`
 * - Table aliases: "u.id" where FROM users u
 * - Wildcards: "*", "users.*"
 * - Expressions with casts, functions: treated as valid (skip validation)
 */
type ValidateColumnExpr<
    Schema extends DatabaseSchema,
    FromTable extends string,
    Expr extends string,
    ActualTable extends string = ExtractFromTableName<FromTable>,
    TableAlias extends string = ExtractFromAlias<FromTable>,
> =
    // Wildcard - always valid
    Expr extends "*" ? true
        // Table wildcard - validate table exists
        : Expr extends `${infer Table}.*`
            ? Table extends ActualTable ? true
            : Table extends TableAlias ? true
            : Table extends keyof SchemaTables<Schema> ? true
            : `Column '${Expr}' references unknown table '${Table}'`
        // Expressions with casts (id::text, func(...)::type) - skip validation
        : Expr extends `${string}::${string}` ? true
        // Function calls (COUNT(...), etc.) - skip validation
        : Expr extends `${string}(${string})${string}` ? true
        // schema.table."column" - validate against schema with quoted column
        : Expr extends
            `${infer SchemaName}.${infer TableName}."${infer QuotedCol}"`
            ? SchemaName extends keyof Schema["schemas"]
                ? TableName extends keyof Schema["schemas"][SchemaName]
                    ? QuotedCol extends
                        keyof Schema["schemas"][SchemaName][TableName]
                        ? true
                    : `Column '${QuotedCol}' not found in '${SchemaName}.${TableName}'`
                : `Table '${TableName}' not found in schema '${SchemaName}'`
            : `Schema '${SchemaName}' not found`
        // schema.table.column - validate against schema (unquoted)
        : Expr extends `${infer SchemaName}.${infer TableName}.${infer ColName}`
            ? SchemaName extends keyof Schema["schemas"]
                ? TableName extends keyof Schema["schemas"][SchemaName]
                    ? ColName extends keyof Schema["schemas"][SchemaName][TableName]
                        ? true
                    : `Column '${ColName}' not found in '${SchemaName}.${TableName}'`
                : `Table '${TableName}' not found in schema '${SchemaName}'`
            : `Schema '${SchemaName}' not found`
        // table."column" or alias."column" - validate against actual table
        : Expr extends `${infer Qualifier}."${infer QuotedCol}"`
            // Check if qualifier matches alias or actual table name
            ? Qualifier extends TableAlias
                ? ActualTable extends keyof SchemaTables<Schema>
                    ? QuotedCol extends keyof SchemaTables<Schema>[ActualTable]
                        ? true
                    : `Column '${QuotedCol}' not found in table '${ActualTable}'`
                : true
            : Qualifier extends ActualTable
                ? ActualTable extends keyof SchemaTables<Schema>
                    ? QuotedCol extends keyof SchemaTables<Schema>[ActualTable]
                        ? true
                    : `Column '${QuotedCol}' not found in table '${ActualTable}'`
                : true
            : Qualifier extends keyof SchemaTables<Schema>
                ? QuotedCol extends keyof SchemaTables<Schema>[Qualifier]
                    ? true
                : `Column '${QuotedCol}' not found in table '${Qualifier}'`
            : true // Unknown table alias - skip (might be join alias)
        // table.column or alias.column - validate against actual table (unquoted)
        : Expr extends `${infer Qualifier}.${infer ColName}`
            // Check if qualifier matches alias or actual table name
            ? Qualifier extends TableAlias
                ? ActualTable extends keyof SchemaTables<Schema>
                    ? ColName extends keyof SchemaTables<Schema>[ActualTable]
                        ? true
                    : `Column '${ColName}' not found in table '${ActualTable}'`
                : true
            : Qualifier extends ActualTable
                ? ActualTable extends keyof SchemaTables<Schema>
                    ? ColName extends keyof SchemaTables<Schema>[ActualTable]
                        ? true
                    : `Column '${ColName}' not found in table '${ActualTable}'`
                : true
            : Qualifier extends keyof SchemaTables<Schema>
                ? ColName extends keyof SchemaTables<Schema>[Qualifier]
                    ? true
                : `Column '${ColName}' not found in table '${Qualifier}'`
            : true // Unknown table alias - skip (might be join alias)
        // Simple quoted column "column" - validate against actual table
        : Expr extends `"${infer QuotedCol}"`
            ? ActualTable extends keyof SchemaTables<Schema>
                ? QuotedCol extends keyof SchemaTables<Schema>[ActualTable]
                    ? true
                : `Column '${QuotedCol}' not found in table '${ActualTable}'`
            : true
        // Unqualified column - validate against actual table
        : ActualTable extends keyof SchemaTables<Schema>
            ? Expr extends keyof SchemaTables<Schema>[ActualTable]
                ? true
            : `Column '${Expr}' not found in table '${ActualTable}'`
        : true;

/**
 * Check if a string contains an unmatched opening parenthesis.
 * Used to detect if we're in the middle of a function call.
 */
type HasUnmatchedParen<
    S extends string,
    Depth extends unknown[] = [],
> = S extends `${infer _}(${infer Rest}`
    ? HasUnmatchedParen<Rest, [ ...Depth, 1 ]>
    : S extends `${infer _})${infer Rest}`
        ? Depth extends [ unknown, ...infer RestDepth ]
            ? HasUnmatchedParen<Rest, RestDepth>
        : false
    : Depth["length"] extends 0 ? false
    : true;

/**
 * Split columns by comma, but skip commas inside function calls.
 * Returns the first complete column expression and the rest.
 */
type SplitColumnSafe<
    S extends string,
    Acc extends string = "",
> = S extends `${infer Char}${infer Rest}`
    ? Char extends ","
        ? HasUnmatchedParen<Acc> extends true
            ? SplitColumnSafe<Rest, `${Acc},`>
        : Rest extends ` ${infer Trimmed}` ? [ Acc, Trimmed ]
        : [ Acc, Rest ]
    : SplitColumnSafe<Rest, `${Acc}${Char}`>
    : [ Acc, "" ];

/**
 * Validate a single column from a ClauseList part.
 * Splits comma-separated columns and validates each.
 * Handles commas inside function calls correctly.
 */
type ValidateClausePartColumns<
    Schema extends DatabaseSchema,
    FromTable extends string,
    Sql extends string,
> = SplitColumnSafe<Sql> extends [ infer Col extends string, infer Rest extends string ]
    ? Rest extends ""
        ? ValidateColumnExpr<Schema, FromTable, ColumnBaseExpr<Trim<Col>>>
    : ValidateColumnExpr<
        Schema,
        FromTable,
        ColumnBaseExpr<Trim<Col>>
    > extends infer R
        ? R extends true
            ? ValidateClausePartColumns<Schema, FromTable, Rest>
        : R
        : true
    : ValidateColumnExpr<Schema, FromTable, ColumnBaseExpr<Trim<Sql>>>;

/**
 * Iterate over ClauseList and validate all columns.
 */
type ValidateClauseListColumns<
    Schema extends DatabaseSchema,
    FromTable extends string,
    List extends ClauseList,
> = List extends readonly [ infer First extends SqlClausePart, ...infer Rest ]
    ? ValidateClausePartColumns<
        Schema,
        FromTable,
        First["sql"]
    > extends infer R
        ? R extends true
            ? Rest extends ClauseList
                ? ValidateClauseListColumns<Schema, FromTable, Rest>
            : true
        : R
        : true
    : true;

/**
 * Validate all columns in the SELECT clause against the schema.
 * Passes the full FROM clause (including alias) to enable alias resolution.
 */
type BuilderColumnsValid<
    Schema extends DatabaseSchema,
    Sql extends AnyBuilderSqlTag,
> = Sql["from"] extends infer F extends string
    ? Sql["select"] extends ClauseList
        ? ValidateClauseListColumns<Schema, F, Sql["select"]>
    : Sql["select"] extends string
        ? ValidateClausePartColumns<Schema, F, Sql["select"]>
    : true
    : true;

/**
 * Validate a builder by checking both tables and columns.
 * This runs once per builder (when the type is referenced), not per method,
 * to keep type instantiation depth manageable.
 */
export type ValidateBuilder<
    B,
> = B extends SelectQueryBuilder<
    infer Schema extends DatabaseSchema,
    any,
    infer Sql extends BuilderSqlTag<
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any,
        any
    >
> ? BuilderTablesValid<Schema, Sql> extends infer TableResult
    ? TableResult extends true
        ? BuilderColumnsValid<Schema, Sql>
    : TableResult
    : true
    : never;
