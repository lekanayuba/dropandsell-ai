import OpenAI from "openai";

interface PriceRecommendation {
  productId: number;
  title: string;
  currentPrice: number;
  costPrice: number;
  recommendedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  reasoning: string;
  marketTrend: "rising" | "stable" | "declining";
}

interface ProductData {
  id: number;
  title: string;
  description: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  category?: string;
  vendorName?: string;
}

export async function getPriceRecommendations(
  products: ProductData[],
  apiKey: string
): Promise<PriceRecommendation[]> {
  if (!apiKey || products.length === 0) return [];

  const openai = new OpenAI({ apiKey });

  const batchSize = 10;
  const batches: PriceRecommendation[] = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const prompt = buildPrompt(batch);
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a pricing optimization AI for a dropshipping platform. 
Analyze each product and recommend optimal selling prices based on:
1. Cost-to-price ratio (typical margin: 30-100% markup)
2. Product category pricing trends
3. Competitive positioning
4. Market demand signals

Return valid JSON array only. Each object must have: productId, recommendedPrice, confidence (0-1), reasoning, marketTrend.`
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations ?? [];
        batches.push(...recommendations.map((r: any, idx: number) => {
          const p = batch[idx] || batch[0];
          return {
            productId: p.id,
            title: p.title,
            currentPrice: p.sellingPrice,
            costPrice: p.costPrice,
            recommendedPrice: r.recommendedPrice ?? p.sellingPrice,
            minPrice: p.costPrice * 1.1,
            maxPrice: p.costPrice * 3,
            confidence: r.confidence ?? 0.5,
            reasoning: r.reasoning ?? "",
            marketTrend: r.marketTrend ?? "stable",
          } satisfies PriceRecommendation;
        }));
      }
    } catch (err) {
      console.error("[AI Price Optimizer] Batch failed:", err);
    }
  }

  return batches;
}

function buildPrompt(products: ProductData[]): string {
  const items = products.map(p => ({
    id: p.id,
    title: p.title,
    costPrice: p.costPrice,
    currentPrice: p.sellingPrice,
    quantity: p.quantity,
    category: p.category || "general",
  }));

  return JSON.stringify({ products: items });
}
