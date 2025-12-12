/**
 * Utility types for the matcher module
 */

/**
 * Convert union to intersection
 * Used to merge all table columns when SELECT *
 */
export type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;
