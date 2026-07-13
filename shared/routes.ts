import { z } from 'zod';
import { 
  insertStoreSchema, 
  insertVendorSchema, 
  insertProductSchema,
  stores,
  vendors,
  products,
  productStockRules,
  productVendorSources,
  stockSyncEvents,
  orders,
  transactions,
  referralWithdrawals,
  wallet,
  subscriptions,
  notifications,
  addonCatalog,
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
          outOfStockProducts: z.number(),
        }),
      },
    },
  },

  // Add-on Catalog
  addonCatalog: {
    list: {
      method: 'GET' as const,
      path: '/api/addon-catalog',
      responses: {
        200: z.object({
          items: z.array(z.custom<typeof addonCatalog.$inferSelect>()),
          lastRefreshed: z.string().nullable(),
          newThisMonth: z.number(),
        }),
      },
    },
    refresh: {
      method: 'POST' as const,
      path: '/api/addon-catalog/refresh',
      responses: {
        200: z.object({
          refreshed: z.boolean(),
          itemsAdded: z.number(),
          itemsUpdated: z.number(),
          lastRefreshedAt: z.date().nullable(),
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
    sync: {
      method: 'POST' as const,
      path: '/api/stores/:id/sync',
      responses: {
        200: z.object({
          synced: z.boolean(),
          platform: z.string(),
          syncedAt: z.string(),
          totalListings: z.number(),
          outOfStockCount: z.number(),
          inStockCount: z.number(),
          message: z.string(),
        }),
      },
    },
    syncAll: {
      method: 'POST' as const,
      path: '/api/stores/sync-all',
      responses: {
        200: z.object({
          synced: z.boolean(),
          storesSynced: z.number(),
          storesFailed: z.number(),
          totalStores: z.number(),
          syncedAt: z.string(),
        }),
      },
    },
    syncStatus: {
      method: 'GET' as const,
      path: '/api/stores/:id/sync-status',
      responses: {
        200: z.object({
          storeId: z.number(),
          syncing: z.boolean(),
          lastSync: z.string().nullable(),
        }),
      },
    },
    autoSettings: {
      method: 'PUT' as const,
      path: '/api/stores/:id/auto-settings',
      input: z.object({
        autoRestock: z.boolean().optional(),
        autoPauseListings: z.boolean().optional(),
        autoMarkOutOfStock: z.boolean().optional(),
        autoSwitchSupplier: z.boolean().optional(),
        threshold: z.number().optional(),
      }),
      responses: {
        200: z.custom<typeof stores.$inferSelect>(),
        400: errorSchemas.validation,
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
        200: z.array(z.any()),
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
    calculateHealth: {
      method: 'POST' as const,
      path: '/api/vendors/calculate-health',
      responses: {
        200: z.object({
          calculated: z.boolean(),
          count: z.number(),
          vendors: z.array(z.any()),
        }),
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/vendors/import',
      input: z.object({
        vendors: z.array(z.object({
          name: z.string(),
          website: z.string().optional(),
          contactPerson: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          category: z.string().optional(),
          tags: z.string().optional(),
          country: z.string().optional(),
          leadTime: z.string().optional(),
          paymentTerms: z.string().optional(),
          minOrderAmount: z.string().optional(),
          notes: z.string().optional(),
          integrationType: z.string().optional(),
          status: z.string().optional(),
        })),
      }),
      responses: {
        201: z.object({
          imported: z.number(),
          vendors: z.array(z.any()),
        }),
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
    stockSources: {
      list: {
        method: 'GET' as const,
        path: '/api/products/:id/stock-sources',
        responses: {
          200: z.array(z.custom<typeof productVendorSources.$inferSelect>()),
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/products/:id/stock-sources',
        input: z.object({
          vendorId: z.coerce.number(),
          vendorSku: z.string().optional().nullable(),
          sourceUrl: z.string().optional().nullable(),
          isPrimary: z.boolean().optional(),
          isEnabled: z.boolean().optional(),
          priority: z.coerce.number().optional(),
          stockQuantity: z.coerce.number().optional(),
          stockStatus: z.enum(['in_stock', 'out_of_stock', 'unknown']).optional(),
          metadata: z.record(z.unknown()).optional().nullable(),
        }),
        responses: {
          201: z.object({
            source: z.custom<typeof productVendorSources.$inferSelect>(),
            evaluation: z.any(),
            productStockUpdated: z.boolean(),
          }),
        },
      },
      update: {
        method: 'PUT' as const,
        path: '/api/products/:id/stock-sources/:sourceId',
        input: z.object({
          vendorSku: z.string().optional().nullable(),
          sourceUrl: z.string().optional().nullable(),
          isPrimary: z.boolean().optional(),
          isEnabled: z.boolean().optional(),
          priority: z.coerce.number().optional(),
          stockQuantity: z.coerce.number().optional(),
          stockStatus: z.enum(['in_stock', 'out_of_stock', 'unknown']).optional(),
          metadata: z.record(z.unknown()).optional().nullable(),
        }),
        responses: {
          200: z.object({
            source: z.custom<typeof productVendorSources.$inferSelect>(),
            evaluation: z.any(),
            productStockUpdated: z.boolean(),
          }),
        },
      },
    },
    stockRule: {
      get: {
        method: 'GET' as const,
        path: '/api/products/:id/stock-rule',
        responses: {
          200: z.custom<typeof productStockRules.$inferSelect>().or(z.any()),
        },
      },
      update: {
        method: 'PUT' as const,
        path: '/api/products/:id/stock-rule',
        input: z.object({
          oosThreshold: z.coerce.number().optional(),
          oosAutomationEnabled: z.boolean().optional(),
          autoSwitchSupplier: z.boolean().optional(),
          restockAutomationEnabled: z.boolean().optional(),
          restockThreshold: z.coerce.number().optional(),
          restockQuantity: z.coerce.number().optional(),
          restockMode: z.enum(['fixed', 'top_up_to']).optional(),
          pinnedVendorSourceId: z.coerce.number().optional().nullable(),
        }),
        responses: {
          200: z.object({
            rule: z.custom<typeof productStockRules.$inferSelect>(),
            evaluation: z.any(),
            productStockUpdated: z.boolean(),
          }),
        },
      },
    },
    stockEvaluation: {
      method: 'GET' as const,
      path: '/api/products/:id/stock-evaluation',
      responses: {
        200: z.object({
          productId: z.number(),
          userId: z.string(),
          effectiveQuantity: z.number(),
          stockStatus: z.enum(['in_stock', 'out_of_stock', 'unknown']),
          rawOutOfStock: z.boolean(),
          shouldMarkOutOfStock: z.boolean(),
          shouldRestock: z.boolean(),
          oosThreshold: z.number(),
          restockThreshold: z.number(),
          restockQuantity: z.number(),
          sourceCount: z.number(),
          activeSourceCount: z.number(),
          reason: z.string(),
        }),
      },
    },
    stockEvents: {
      method: 'GET' as const,
      path: '/api/products/:id/stock-events',
      responses: {
        200: z.array(z.custom<typeof stockSyncEvents.$inferSelect>()),
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
    undoDelete: {
      method: 'POST' as const,
      path: '/api/products/:id/undo-delete',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    findSimilarImages: {
      method: 'POST' as const,
      path: '/api/products/:id/find-similar-images',
      responses: {
        200: z.object({
          sourceImage: z.string(),
          sourceTitle: z.string(),
          results: z.array(z.object({
            productId: z.number(),
            productTitle: z.string(),
            imageUrl: z.string(),
            matchScore: z.number(),
            matchReason: z.string(),
          })),
        }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    autoReplaceSupplier: {
      method: 'POST' as const,
      path: '/api/products/:id/auto-replace-supplier',
      responses: {
        200: z.object({
          replaced: z.boolean(),
          newVendorId: z.number().nullable(),
          newVendorName: z.string().nullable(),
          reason: z.string(),
        }),
      },
    },
    batchAutoReplaceSuppliers: {
      method: 'POST' as const,
      path: '/api/products/auto-replace-suppliers',
      responses: {
        200: z.object({
          total: z.number(),
          replaced: z.number(),
          failed: z.number(),
          results: z.array(z.any()),
        }),
      },
    },
    replacementLogs: {
      method: 'GET' as const,
      path: '/api/products/replacement-logs',
      responses: {
        200: z.array(z.any()),
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

  // Notifications
  notification: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications',
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
      },
    },
    unreadCount: {
      method: 'GET' as const,
      path: '/api/notifications/unread-count',
      responses: {
        200: z.object({ count: z.number() }),
      },
    },
    markRead: {
      method: 'PUT' as const,
      path: '/api/notifications/:id/read',
      responses: {
        200: z.custom<typeof notifications.$inferSelect>(),
      },
    },
    readAll: {
      method: 'PUT' as const,
      path: '/api/notifications/read-all',
      responses: {
        200: z.object({ success: z.boolean() }),
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
    full: {
      method: 'GET' as const,
      path: '/api/wallet/full',
      responses: {
        200: z.object({
          balance: z.number(),
          referralBalance: z.number(),
          points: z.number(),
          currency: z.string(),
        }),
      },
    },
    referralWithdrawals: {
      method: 'GET' as const,
      path: '/api/wallet/referral-withdrawals',
      responses: {
        200: z.array(z.custom<Omit<typeof referralWithdrawals.$inferSelect, 'bankDetails'>>()),
      },
    },
    withdrawReferral: {
      method: 'POST' as const,
      path: '/api/wallet/withdraw-referral',
      input: z.object({
        amount: z.number().positive(),
        accountHolderName: z.string().min(2),
        bankName: z.string().min(2),
        bankCountry: z.string().min(2),
        accountNumber: z.string().min(4),
        sortCode: z.string().optional(),
        iban: z.string().optional(),
        swift: z.string().optional(),
        payoutNotes: z.string().optional(),
      }),
      responses: {
        200: z.object({
          success: z.boolean(),
          transaction: z.custom<typeof transactions.$inferSelect>(),
          withdrawal: z.custom<Omit<typeof referralWithdrawals.$inferSelect, 'bankDetails'>>(),
        }),
      },
    },
  },

  // Temu Integration
  temu: {
    import: {
      method: 'POST' as const,
      path: '/api/platforms/temu/import',
      input: z.object({
        url: z.string(),
      }),
      responses: {
        201: z.object({
          imported: z.boolean(),
          message: z.string(),
          product: z.any(),
          variations: z.array(z.any()),
        }),
      },
    },
    syncPrices: {
      method: 'POST' as const,
      path: '/api/platforms/temu/sync-prices',
      responses: {
        200: z.object({
          synced: z.boolean(),
          totalTemuProducts: z.number(),
          pricesUpdated: z.number(),
          failed: z.number(),
        }),
      },
    },
    syncStock: {
      method: 'POST' as const,
      path: '/api/platforms/temu/sync-stock',
      responses: {
        200: z.object({
          synced: z.boolean(),
          totalTemuProducts: z.number(),
          backInStock: z.array(z.number()),
          wentOutOfStock: z.array(z.number()),
          failed: z.number(),
        }),
      },
    },
    products: {
      method: 'GET' as const,
      path: '/api/platforms/temu/products',
      responses: {
        200: z.array(z.any()),
      },
    },
    upscaleImage: {
      method: 'POST' as const,
      path: '/api/platforms/temu/upscale-image',
      input: z.object({ imageUrl: z.string() }),
      responses: {
        200: z.object({
          originalUrl: z.string(),
          upscaledUrl: z.string(),
        }),
      },
    },
    similarImages: {
      method: 'POST' as const,
      path: '/api/platforms/temu/similar-images',
      input: z.object({ productId: z.number() }),
      responses: {
        200: z.array(z.any()),
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
