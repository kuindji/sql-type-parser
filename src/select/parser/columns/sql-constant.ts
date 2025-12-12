/**
 * SQL constant parsing (CURRENT_DATE, CURRENT_TIMESTAMP, etc.)
 */

import type {
    ColumnRef,
    SQLConstantExpr,
    SQLConstantName,
} from "../../ast.js";
import type { RemoveQuotes, Trim } from "../../../common/utils.js";

// ============================================================================
// SQL Constant Parsing
// ============================================================================

/**
 * Check if the expression is a SQL constant (CURRENT_DATE, CURRENT_TIMESTAMP, etc.)
 * These are special SQL keywords that return typed values without function call syntax
 */
export type IsSQLConstantExpression<T extends string> =
    // Check with alias first
    Trim<T> extends `${infer Expr} AS ${string}` ? IsSQLConstant<Trim<Expr>>
        : IsSQLConstant<Trim<T>>;

/**
 * Check if the value is a SQL constant
 */
export type IsSQLConstant<T extends string> = T extends SQLConstantName ? true
    : false;

/**
 * Parse a SQL constant column expression
 * Handles: CURRENT_DATE AS dt, CURRENT_TIMESTAMP AS ts, etc.
 */
export type ParseSQLConstantColumn<T extends string> = Trim<T> extends
    `${infer Expr} AS ${infer Alias}`
    ? ColumnRef<ParseSQLConstantExpr<Trim<Expr>>, RemoveQuotes<Alias>>
    : ColumnRef<
        ParseSQLConstantExpr<Trim<T>>,
        ExtractSQLConstantAlias<Trim<T>>
    >;

/**
 * Parse a SQL constant expression into a SQLConstantExpr AST node
 */
export type ParseSQLConstantExpr<T extends string> = T extends SQLConstantName
    ? SQLConstantExpr<T>
    : SQLConstantExpr<SQLConstantName>;

/**
 * Extract a default alias for a SQL constant (returns the lowercase name)
 */
export type ExtractSQLConstantAlias<T extends string> = T extends "CURRENT_DATE"
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
