import { z } from 'zod';
import { 
  insertStoreSchema, 
  insertVendorSchema, 
  insertProductSchema,
  stores,
  vendors,
  products,
  orders,
  transactions,
  wallet,
  subscriptions
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  // Dashboard & Stats
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats',
      responses: {
        200: z.object({
          totalRevenue: z.number(),
          totalOrders: z.number(),
          activeListings: z.number(),
          walletBalance: z.number(),
          newOrders: z.number(),
          recentOrders: z.array(z.object({
            id: z.number(),
            customerName: z.string().nullable(),
            totalAmount: z.string().nullable(),
            status: z.string(),
            fulfillmentStatus: z.string().nullable(),
            createdAt: z.string().nullable(),
          })).optional(),
        }),
      },
    },
  },

  // Subscriptions
  subscription: {
    plans: {
      method: 'GET' as const,
      path: '/api/subscription/plans',
      responses: {
        200: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          priceId: z.string().nullable(),
          amount: z.number(),
          currency: z.string(),
          listingsLimit: z.number(),
          interval: z.string(),
        })),
      },
    },
    current: {
      method: 'GET' as const,
      path: '/api/subscription/current',
      responses: {
        200: z.custom<typeof subscriptions.$inferSelect>().nullable(),
      },
    },
    checkout: {
      method: 'POST' as const,
      path: '/api/subscription/checkout',
      input: z.object({
        priceId: z.string(),
      }),
      responses: {
        200: z.object({
          url: z.string(),
        }),
      },
    },
    portal: {
      method: 'POST' as const,
      path: '/api/subscription/portal',
      responses: {
        200: z.object({
          url: z.string(),
        }),
      },
    },
  },

  // Stores (Marketplaces)
  stores: {
    list: {
      method: 'GET' as const,
      path: '/api/stores',
      responses: {
        200: z.array(z.custom<typeof stores.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/stores',
      input: insertStoreSchema,
      responses: {
        201: z.custom<typeof stores.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/stores/:id',
      responses: {
        200: z.custom<typeof stores.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/stores/:id',
      input: insertStoreSchema.partial(),
      responses: {
        200: z.custom<typeof stores.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/stores/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Vendors
  vendors: {
    list: {
      method: 'GET' as const,
      path: '/api/vendors',
      responses: {
        200: z.array(z.custom<typeof vendors.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vendors',
      input: insertVendorSchema,
      responses: {
        201: z.custom<typeof vendors.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/vendors/:id',
      input: insertVendorSchema.partial(),
      responses: {
        200: z.custom<typeof vendors.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/vendors/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Products
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      input: z.object({
        search: z.string().optional(),
        vendorId: z.coerce.number().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.object({
          items: z.array(z.custom<typeof products.$inferSelect>()),
          total: z.number(),
        }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id',
      input: insertProductSchema.partial(),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Orders
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      input: z.object({
        status: z.string().optional(),
        page: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/orders/:id',
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Wallet
  wallet: {
    get: {
      method: 'GET' as const,
      path: '/api/wallet',
      responses: {
        200: z.object({
          balance: z.number(),
          currency: z.string(),
          transactions: z.array(z.custom<typeof transactions.$inferSelect>()),
        }),
      },
    },
    deposit: {
      method: 'POST' as const,
      path: '/api/wallet/deposit',
      input: z.object({
        amount: z.number().min(1),
        paymentMethodId: z.string(),
      }),
      responses: {
        200: z.object({
          success: z.boolean(),
          newBalance: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
