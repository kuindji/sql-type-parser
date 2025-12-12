import type { RuntimeSelectState } from "../builder-types/builder.js";

/**
 * Default empty runtime state corresponding to EmptyState.
 */
export const EMPTY_RUNTIME_STATE: RuntimeSelectState = {
    select: {},
    from: undefined,
    joins: [],
    where: {},
    groupBy: {},
    having: {},
    orderBy: {},
    limit: undefined,
    offset: undefined,
    ctes: {},
    distinct: false,
    union: undefined,
    params: [],
    namedParams: {},
    selectSql: {},
    fromSql: undefined,
    joinSql: {},
    whereSql: {},
    groupBySql: {},
    havingSql: {},
    orderBySql: {},
    cteSql: {},
    unionSql: undefined,
};
