/**
 * SELECT Builder Examples
 *
 * Demonstrates runtime builder usage alongside type-level helpers for
 * extracting SQL strings and inferred row shapes.
 */

import { createConditionTree, createSelectQuery } from "../../src/index.js";
import type {
    BuilderReturnType,
    BuilderSQL,
    BuilderStateOf,
    RuntimeSelectState,
} from "../../src/index.js";
import type { BlogSchema, ECommerceSchema } from "../schema.js";

// Basic builder usage with explicit column selection and WHERE clause
const ActiveUsersBuilder = createSelectQuery<ECommerceSchema>()
    .select([ "id", "email" ])
    .from("users")
    .where("is_active = TRUE");

type ActiveUsersSQL = BuilderSQL<typeof ActiveUsersBuilder>;
type ActiveUsersRow = BuilderReturnType<typeof ActiveUsersBuilder>;
type ActiveUsersState = BuilderStateOf<typeof ActiveUsersBuilder>;

// Join fragments plus condition trees for composable predicates
const PaidOrdersBuilder = createSelectQuery<ECommerceSchema>()
    .select([ "orders.id", "orders.total_amount" ])
    .from("orders")
    .join(
        "LEFT JOIN payments ON payments.order_id = orders.id",
        "payments",
    )
    .where(
        createConditionTree("or")
            .add("orders.status = 'paid'")
            .add("payments.status != 'failed'"),
    )
    .select("payments.status AS payment_status", "payment_status");

type PaidOrdersSQL = BuilderSQL<typeof PaidOrdersBuilder>;
type PaidOrdersRow = BuilderReturnType<typeof PaidOrdersBuilder>;
type PaidOrdersRuntime = RuntimeSelectState;

// Conditional fragments with .when() mark added columns as optional
const BlogMetricsBuilder = createSelectQuery<BlogSchema>()
    .select([ "posts.id", "posts.title" ])
    .from("posts")
    .when(true, b =>
        b
            .join(
                "LEFT JOIN comments ON comments.post_id = posts.id",
                "comments",
            )
            .select("COUNT(comments.id) AS comment_count")
            .where("comments.is_approved = TRUE"));

type BlogMetricsSQL = BuilderSQL<typeof BlogMetricsBuilder>;
type BlogMetricsRow = BuilderReturnType<typeof BlogMetricsBuilder>;
type BlogMetricsState = BuilderStateOf<typeof BlogMetricsBuilder>;
