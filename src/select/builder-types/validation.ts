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

/**
 * Validate a builder by assembling its SQL string and running the existing
 * ValidateSQL helper over it. This runs once per builder (when the type is
 * referenced), not per method, to keep type instantiation depth manageable.
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
> ? BuilderTablesValid<Schema, Sql>
    : never;
