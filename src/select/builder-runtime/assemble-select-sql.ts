import type { RuntimeSelectState } from "../builder-types/builder.js";

// ============================================================================
// SQL Assembly Utility (runtime-only)
// ============================================================================

/**
 * Assemble a SQL string from runtime builder state.
 *
 * This utility:
 * - Uses user-provided fragments as-is (no parsing or normalization).
 * - Inserts SQL keywords (SELECT, FROM, WHERE, etc.) in uppercase.
 * - Skips empty clauses entirely.
 * - Defaults to SELECT * when no select fragments are present.
 */
export function assembleSelectSQL(state: RuntimeSelectState): string {
    const parts: string[] = [];

    // WITH clause (CTEs)
    const cteIds = Object.keys(state.cteSql);
    if (cteIds.length > 0) {
        const withParts = cteIds.map(id => state.cteSql[id]).join(", ");
        parts.push(`WITH ${withParts}`);
    }

    // SELECT clause
    const selectIds = Object.keys(state.selectSql);
    if (selectIds.length === 0) {
        parts.push("SELECT *");
    }
    else {
        const selectFragments: string[] = [];
        for (const id of selectIds) {
            const cols = state.selectSql[id];
            if (cols && cols.length > 0) {
                selectFragments.push(cols.join(", "));
            }
        }
        const selectSql = selectFragments.length > 0
            ? selectFragments.join(", ")
            : "*";
        parts.push(
            state.distinct
                ? `SELECT DISTINCT ${selectSql}`
                : `SELECT ${selectSql}`,
        );
    }

    // FROM clause
    if (state.fromSql) {
        parts.push(`FROM ${state.fromSql}`);
    }

    // JOIN clauses – in the order of joins[]
    for (const join of state.joins) {
        const sql = state.joinSql[join.id];
        if (sql) {
            parts.push(sql);
        }
    }

    // WHERE clause
    const whereIds = Object.keys(state.whereSql);
    if (whereIds.length > 0) {
        const whereParts = whereIds
            .map(id => state.whereSql[id])
            .filter(Boolean);
        if (whereParts.length > 0) {
            parts.push(`WHERE ${whereParts.join(" AND ")}`);
        }
    }

    // GROUP BY
    const groupIds = Object.keys(state.groupBySql);
    if (groupIds.length > 0) {
        const groupParts = groupIds
            .map(id => state.groupBySql[id])
            .filter(Boolean);
        if (groupParts.length > 0) {
            parts.push(`GROUP BY ${groupParts.join(", ")}`);
        }
    }

    // HAVING
    const havingIds = Object.keys(state.havingSql);
    if (havingIds.length > 0) {
        const havingParts = havingIds
            .map(id => state.havingSql[id])
            .filter(Boolean);
        if (havingParts.length > 0) {
            parts.push(`HAVING ${havingParts.join(" AND ")}`);
        }
    }

    // ORDER BY
    const orderIds = Object.keys(state.orderBySql);
    if (orderIds.length > 0) {
        const orderParts = orderIds
            .map(id => state.orderBySql[id])
            .filter(Boolean);
        if (orderParts.length > 0) {
            parts.push(`ORDER BY ${orderParts.join(", ")}`);
        }
    }

    // LIMIT / OFFSET
    if (typeof state.limit === "number") {
        parts.push(`LIMIT ${state.limit}`);
    }
    if (typeof state.offset === "number") {
        parts.push(`OFFSET ${state.offset}`);
    }

    // UNION clause – appended as-is if provided
    if (state.unionSql) {
        parts.push(state.unionSql);
    }

    let sql = parts.join(" ");

    // Replace named parameters (:name) with positional placeholders ($N)
    // Params are ordered by their first appearance in the SQL
    // Array params are expanded: :ids with [1,2,3] becomes "$1, $2, $3"
    const namedParams = state.namedParams;
    if (namedParams && Object.keys(namedParams).length > 0) {
        // Find all param references in order of appearance
        const paramRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_])/g;
        const usedParams: string[] = [];
        let match;
        while ((match = paramRegex.exec(sql)) !== null) {
            const name = match[1];
            // Only add if it's a known param and not already added
            if (name in namedParams && !usedParams.includes(name)) {
                usedParams.push(name);
            }
        }

        // Replace each param with its positional placeholder(s)
        // Track position across all params (arrays expand to multiple positions)
        let position = 1;
        for (const name of usedParams) {
            const value = namedParams[name];
            const regex = new RegExp(`:${name}(?![a-zA-Z0-9_])`, "g");

            if (Array.isArray(value)) {
                // Expand array to multiple placeholders: $1, $2, $3
                const placeholders = value.map((_, i) => `$${position + i}`).join(", ");
                sql = sql.replace(regex, placeholders);
                position += value.length;
            }
            else {
                sql = sql.replace(regex, `$${position}`);
                position++;
            }
        }
    }

    return sql;
}
