import fileinput, re, sys

# Fix 1: Add is_new column migration to db.ts
with fileinput.FileInput('server/db.ts', inplace=True, backup='.bak') as f:
    for line in f:
        print(line, end='')
        if 'ADD COLUMN IF NOT EXISTS image text' in line:
            print('      await client.query(`ALTER TABLE addon_catalog ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT false`);')

# Fix 2: Fix bulk publish endpoint to preserve quantity/postage
with fileinput.FileInput('server/routes.ts', inplace=True, backup='.bak') as f:
    for line in f:
        if "const queueItems = items.map((item: any) => ({":
            print('      const queueItems = items.map((item: any) => ({')
            print('        userId,')
            print('        productId: item.productId,')
            print('        storeId: item.storeId,')
            print('        calculatedPrice: item.calculatedPrice?.toString() || \'0\',')
            print('        pricingRuleId: item.pricingRuleId,')
            print('        quantity: item.quantity ?? 1,')
            print('        postageType: item.postageType || \'store_default\',')
            print('        postageCost: item.postageCost?.toString(),')
            print('        status: \'pending\',')
            print('      }));')
            # skip the next 7 lines (old code)
            for _ in range(7): next(f)
        elif "const { items } = req.body; // Array of":
            print('      const { items } = req.body;')
        elif 'let sellingPrice = Number(item.calculatedPrice) || Number(product.costPrice) || 0;':
            print('          const rawPrice = Number(item.calculatedPrice);')
            print('          let sellingPrice = Number.isFinite(rawPrice) ? rawPrice : (Number(product.costPrice) || Number(product.sellingPrice) || 0);')
            print('          if (sellingPrice < 0) sellingPrice = 0;')
        elif "if (!sellingPrice) {":
            print('          // skipped - handled above')
            next(f)  # skip next line
        elif "sellingPrice = Number(product.sellingPrice) || 0;" in line:
            pass  # skip this line
        elif 'quantity: Number(product.quantity) || 1,' in line:
            print('              quantity: listingQuantity,')
        else:
            print(line, end='')

# Fix 3: Add userId check to PUT publish-queue
print("\nFix 3: add userId check...")
# This one is harder to do with sed, let me use a simpler approach
with open('server/routes.ts', 'r') as f:
    content = f.read()

old_put = '''  protectedApi.put('/publish-queue/:id', async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      if (updates.calculatedPrice !== undefined) {
        updates.calculatedPrice = updates.calculatedPrice.toString();
      }
      const item = await storage.updatePublishQueueItem(id, updates);
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update queue item' });
    }
  });'''

new_put = '''  protectedApi.put('/publish-queue/:id', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const existing = await storage.getPublishQueueItem(id, userId);
      if (!existing) return res.status(404).json({ message: 'Queue item not found' });
      const updates = req.body;
      if (updates.calculatedPrice !== undefined) {
        updates.calculatedPrice = updates.calculatedPrice.toString();
      }
      const item = await storage.updatePublishQueueItem(id, updates);
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update queue item' });
    }
  });'''

content = content.replace(old_put, new_put)

# Fix 4: Add listingQuantity variable before platform blocks
old_price_block = '''          const rawPrice = Number(item.calculatedPrice);
          let sellingPrice = Number.isFinite(rawPrice) ? rawPrice : (Number(product.costPrice) || Number(product.sellingPrice) || 0);
          if (sellingPrice < 0) sellingPrice = 0;

          let externalId: string;'''

if old_price_block in content:
    content = content.replace(
        old_price_block,
        '''          const rawPrice = Number(item.calculatedPrice);
          let sellingPrice = Number.isFinite(rawPrice) ? rawPrice : (Number(product.costPrice) || Number(product.sellingPrice) || 0);
          if (sellingPrice < 0) sellingPrice = 0;

          const listingQuantity = Number(item.quantity ?? product.quantity) || 1;

          let externalId: string;'''
    )

with open('server/routes.ts', 'w') as f:
    f.write(content)

# Fix 5: Fix SelectItem empty values in client files
for filepath in ['client/src/pages/Inventory.tsx', 'client/src/pages/Automation.tsx']:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix SelectItem value="" to value="none" or value="all"
    if 'Inventory.tsx' in filepath:
        content = content.replace(
            '<SelectItem value="">No supplier</SelectItem>',
            '<SelectItem value="none">No supplier</SelectItem>'
        )
    
    if 'Automation.tsx' in filepath:
        content = content.replace(
            '<SelectItem value="">No vendor</SelectItem>',
            '<SelectItem value="none">No vendor</SelectItem>'
        )
        content = content.replace(
            '<SelectItem value="">All vendors</SelectItem>',
            '<SelectItem value="all">All vendors</SelectItem>'
        )
        content = content.replace(
            '<SelectItem value="">All platforms</SelectItem>',
            '<SelectItem value="all">All platforms</SelectItem>'
        )
    
    with open(filepath, 'w') as f:
        f.write(content)

# Fix 6: Fix price falsy bug in Inventory.tsx
with open('client/src/pages/Inventory.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'let calculatedPrice = Number(product?.sellingPrice || costPrice);',
    'const sellingPrice = Number(product?.sellingPrice); let calculatedPrice = Number.isFinite(sellingPrice) ? sellingPrice : costPrice;'
)

with open('client/src/pages/Inventory.tsx', 'w') as f:
    f.write(content)

# Fix 7: Fix use-automation.ts update hook to include calculatedPrice
with open('client/src/hooks/use-automation.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'mutationFn: async ({ id, ...data }: { id: number; quantity?: number; postageType?: string; postageCost?: string })',
    'mutationFn: async ({ id, ...data }: { id: number; quantity?: number; calculatedPrice?: number; postageType?: string; postageCost?: string })'
)

with open('client/src/hooks/use-automation.ts', 'w') as f:
    f.write(content)

print("All fixes applied!")
print("Run: pkill -f tsx 2>/dev/null; npm run dev")
