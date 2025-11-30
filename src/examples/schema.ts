/**
 * Example Database Schema
 * 
 * Comprehensive schema covering various data types, relationships,
 * and use cases for demonstrating the type-parser capabilities.
 */

// ============================================================================
// Basic Type Definitions
// ============================================================================

/** UUID type alias */
type UUID = string

/** Timestamp type alias */
type Timestamp = string

/** JSON object type */
type JSONObject = Record<string, unknown>

// ============================================================================
// Example Database Schema
// ============================================================================

/**
 * E-commerce database schema with users, products, orders, etc.
 * Now with schema support - all tables are in the 'public' schema by default
 */
export type ECommerceSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
    // -------------------------------------------------------------------------
    // User Management
    // -------------------------------------------------------------------------
    
    /** User accounts */
    users: {
      id: number
      uuid: UUID
      email: string
      username: string
      password_hash: string
      first_name: string | null
      last_name: string | null
      role: "admin" | "moderator" | "customer"
      status: "active" | "suspended" | "deleted"
      created_at: Timestamp
      updated_at: Timestamp
      last_login_at: Timestamp | null
      email_verified: boolean
      preferences: JSONObject | null
    }

    /** User profile information */
    user_profiles: {
      id: number
      user_id: number
      avatar_url: string | null
      bio: string | null
      phone: string | null
      birth_date: string | null
      country: string | null
      city: string | null
      timezone: string
    }

    /** User addresses */
    addresses: {
      id: number
      user_id: number
      type: "billing" | "shipping"
      is_default: boolean
      line1: string
      line2: string | null
      city: string
      state: string | null
      postal_code: string
      country: string
      created_at: Timestamp
    }

    // -------------------------------------------------------------------------
    // Product Catalog
    // -------------------------------------------------------------------------

    /** Product categories (hierarchical) */
    categories: {
      id: number
      parent_id: number | null
      name: string
      slug: string
      description: string | null
      image_url: string | null
      sort_order: number
      is_active: boolean
    }

    /** Products */
    products: {
      id: number
      sku: string
      name: string
      slug: string
      description: string | null
      short_description: string | null
      price: number
      compare_at_price: number | null
      cost_price: number | null
      category_id: number
      brand_id: number | null
      status: "draft" | "active" | "archived"
      is_featured: boolean
      weight: number | null
      dimensions: JSONObject | null
      attributes: JSONObject | null
      metadata: JSONObject | null
      created_at: Timestamp
      updated_at: Timestamp
      published_at: Timestamp | null
    }

    /** Product brands */
    brands: {
      id: number
      name: string
      slug: string
      logo_url: string | null
      website: string | null
      description: string | null
      is_active: boolean
    }

    /** Product images */
    product_images: {
      id: number
      product_id: number
      url: string
      alt_text: string | null
      sort_order: number
      is_primary: boolean
    }

    /** Product inventory */
    inventory: {
      id: number
      product_id: number
      warehouse_id: number
      quantity: number
      reserved_quantity: number
      reorder_level: number | null
      last_counted_at: Timestamp | null
    }

    /** Warehouses */
    warehouses: {
      id: number
      name: string
      code: string
      address_line1: string
      city: string
      country: string
      is_active: boolean
    }

    /** Product tags (many-to-many junction) */
    product_tags: {
      product_id: number
      tag_id: number
    }

    /** Tags */
    tags: {
      id: number
      name: string
      slug: string
    }

    // -------------------------------------------------------------------------
    // Orders & Transactions
    // -------------------------------------------------------------------------

    /** Orders */
    orders: {
      id: number
      order_number: string
      user_id: number
      status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      subtotal: number
      tax_amount: number
      shipping_amount: number
      discount_amount: number
      total_amount: number
      currency: string
      shipping_address_id: number
      billing_address_id: number
      notes: string | null
      created_at: Timestamp
      updated_at: Timestamp
      shipped_at: Timestamp | null
      delivered_at: Timestamp | null
    }

    /** Order line items */
    order_items: {
      id: number
      order_id: number
      product_id: number
      quantity: number
      unit_price: number
      total_price: number
      discount_amount: number
    }

    /** Payments */
    payments: {
      id: number
      order_id: number
      amount: number
      currency: string
      method: "credit_card" | "paypal" | "bank_transfer" | "crypto"
      status: "pending" | "completed" | "failed" | "refunded"
      provider_transaction_id: string | null
      metadata: JSONObject | null
      created_at: Timestamp
    }

    // -------------------------------------------------------------------------
    // Reviews & Ratings
    // -------------------------------------------------------------------------

    /** Product reviews */
    reviews: {
      id: number
      product_id: number
      user_id: number
      rating: number
      title: string | null
      content: string | null
      is_verified_purchase: boolean
      is_approved: boolean
      helpful_count: number
      created_at: Timestamp
      updated_at: Timestamp
    }

    // -------------------------------------------------------------------------
    // Cart & Wishlist
    // -------------------------------------------------------------------------

    /** Shopping cart items */
    cart_items: {
      id: number
      user_id: number
      product_id: number
      quantity: number
      added_at: Timestamp
    }

    /** Wishlist items */
    wishlist_items: {
      id: number
      user_id: number
      product_id: number
      added_at: Timestamp
    }

    // -------------------------------------------------------------------------
    // Marketing & Discounts
    // -------------------------------------------------------------------------

    /** Discount coupons */
    coupons: {
      id: number
      code: string
      type: "percentage" | "fixed" | "free_shipping"
      value: number
      min_purchase: number | null
      max_uses: number | null
      used_count: number
      starts_at: Timestamp
      expires_at: Timestamp | null
      is_active: boolean
    }

    // -------------------------------------------------------------------------
    // Audit & Logs
    // -------------------------------------------------------------------------

    /** Audit logs */
    audit_logs: {
      id: number
      user_id: number | null
      action: string
      entity_type: string
      entity_id: number
      old_values: JSONObject | null
      new_values: JSONObject | null
      ip_address: string | null
      user_agent: string | null
      created_at: Timestamp
    }
  }
  }
}

// ============================================================================
// Simplified Schema for Basic Examples
// ============================================================================

/**
 * Simple blog schema for basic examples
 * Now with schema support - all tables are in the 'public' schema by default
 */
export type BlogSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
      users: {
        id: number
        name: string
        email: string
        role: "admin" | "author" | "reader"
        is_active: boolean
        created_at: string
      }
      
      posts: {
        id: number
        author_id: number
        title: string
        slug: string
        content: string
        status: "draft" | "published" | "archived"
        views: number
        created_at: string
        published_at: string | null
      }
      
      comments: {
        id: number
        post_id: number
        user_id: number
        content: string
        is_approved: boolean
        created_at: string
      }
      
      categories: {
        id: number
        name: string
        parent_id: number | null
      }
      
      post_categories: {
        post_id: number
        category_id: number
      }
    }
  }
}

// ============================================================================
// Schema with JSONB for Complex Expressions
// ============================================================================

/**
 * Schema with JSON/JSONB columns for testing complex expressions
 * Now with schema support - all tables are in the 'public' schema by default
 */
export type JsonSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
      documents: {
        id: number
        data: JSONObject
        metadata: JSONObject | null
        tags: string[]
        created_at: string
      }
      
      events: {
        id: number
        type: string
        payload: JSONObject
        context: JSONObject | null
        occurred_at: string
      }
      
      settings: {
        id: number
        user_id: number
        preferences: JSONObject
        notifications: JSONObject
      }
    }
  }
}

// ============================================================================
// Schema with camelCase and Mixed_Case Identifiers
// ============================================================================

/**
 * Schema with camelCased and Mixed_Case column/table names
 * Tests identifier case preservation
 * Now with schema support - all tables are in the 'public' schema by default
 */
export type CamelCaseSchema = {
  defaultSchema: "public"
  schemas: {
    public: {
      // camelCase table name
      userAccounts: {
        id: number
        
        // camelCased columns
        firstName: string
        lastName: string
        emailAddress: string
        phoneNumber: string | null
        createdAt: string
        updatedAt: string
        isActive: boolean
        
        // Mixed_Case columns
        Account_Status: "active" | "suspended" | "deleted"
        Last_Login_Date: string | null
      }
      
      // PascalCase table name
      OrderItems: {
        id: number
        orderId: number
        productId: number
        
        // camelCased
        unitPrice: number
        totalPrice: number
        discountAmount: number
        
        // Mixed_Case
        Item_Status: "pending" | "shipped" | "delivered"
        Created_At: string
      }
      
      // Mixed_Case table name
      Product_Categories: {
        id: number
        
        // camelCased
        categoryName: string
        parentId: number | null
        sortOrder: number
        
        // Mixed_Case
        Is_Active: boolean
        Display_Name: string
      }
      
      // Table with special characters (needs quoting)
      "user-sessions": {
        id: number
        userId: number
        sessionToken: string
        expiresAt: string
        "ip-address": string
        "user-agent": string | null
      }
      
      // Table with underscores in quoted form
      "audit_logs": {
        id: number
        "user_id": number | null
        action: string
        "entity_type": string
        "created_at": string
      }
    }
  }
}

// Note: Quoted identifiers with spaces (e.g., "audit logs", "user id") are not supported
// because the SQL tokenizer splits on spaces. Use hyphens or underscores instead.

// ============================================================================
// Multi-Schema Example
// ============================================================================

/**
 * Example schema demonstrating multiple database schemas
 * Shows how to organize tables across different schemas (public, audit, analytics)
 */
export type MultiSchemaExample = {
  defaultSchema: "public"
  schemas: {
    /** Main application tables */
    public: {
      users: {
        id: number
        email: string
        name: string
        created_at: string
      }
      posts: {
        id: number
        user_id: number
        title: string
        content: string
        created_at: string
      }
    }
    /** Audit/logging tables */
    audit: {
      logs: {
        id: number
        user_id: number | null
        action: string
        table_name: string
        record_id: number
        old_data: JSONObject | null
        new_data: JSONObject | null
        created_at: string
      }
      sessions: {
        id: number
        user_id: number
        ip_address: string
        user_agent: string | null
        started_at: string
        ended_at: string | null
      }
    }
    /** Analytics/reporting tables */
    analytics: {
      page_views: {
        id: number
        page: string
        user_id: number | null
        referrer: string | null
        viewed_at: string
      }
      events: {
        id: number
        event_type: string
        user_id: number | null
        properties: JSONObject
        occurred_at: string
      }
    }
  }
}

// ============================================================================
// Type Exports for Testing
// ============================================================================

export type { UUID, Timestamp, JSONObject }

