/**
 * Validator Utility Types
 *
 * Helper types used across validator modules.
 */

/**
 * Convert union to intersection
 */
export type UnionToIntersection<U> = (
    U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void ? I
    : never;
