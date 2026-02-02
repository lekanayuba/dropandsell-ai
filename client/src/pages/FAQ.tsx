import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqData = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I connect my marketplace store?",
        a: "Navigate to the Stores page from the sidebar, click 'Add Store', select your marketplace (Shopify, eBay, Amazon, etc.), and enter your API credentials. You can find these credentials in your marketplace's developer or settings section."
      },
      {
        q: "What marketplaces does DropFlow support?",
        a: "DropFlow currently supports Shopify, eBay, Amazon, and WooCommerce. We're continuously adding more marketplace integrations. Contact support if you need a specific marketplace."
      },
      {
        q: "How do I import products from my vendor?",
        a: "Go to Automation → Import tab. Select your vendor, upload a CSV file with product data, map the columns to the appropriate fields (title, SKU, price, etc.), preview the data, and confirm the import."
      }
    ]
  },
  {
    category: "Pricing & Automation",
    questions: [
      {
        q: "How do pricing rules work?",
        a: "Pricing rules automatically calculate selling prices from cost prices. You can set rules based on: Markup % (adds a percentage on top), Margin % (sets profit margin), or Fixed Amount (adds a fixed value). Rules can be vendor-specific or global, and higher priority rules take precedence."
      },
      {
        q: "Can I set minimum and maximum prices?",
        a: "Yes! When creating a pricing rule, you can set optional min/max price constraints. This prevents products from being priced too low (protecting margins) or too high (remaining competitive)."
      },
      {
        q: "How does the publish queue work?",
        a: "The publish queue is a staging area for products before they go live on marketplaces. Select products from Inventory, add them to the queue with pricing rules applied, review in Automation → Publish, then batch-publish to your stores."
      }
    ]
  },
  {
    category: "Orders & Fulfillment",
    questions: [
      {
        q: "How do orders sync from my stores?",
        a: "DropFlow automatically syncs orders from your connected marketplace stores. Orders appear in the Orders page with customer details, shipping address, and fulfillment status."
      },
      {
        q: "What is auto-fulfillment?",
        a: "Auto-fulfillment uses your wallet balance to automatically process orders with your vendors. When an order comes in, DropFlow can automatically place the order with your supplier and update tracking information."
      },
      {
        q: "How do I track order status?",
        a: "The Orders page shows all orders with their current status: Pending, Processing, Shipped, or Cancelled. You can view details, tracking numbers, and carrier information for each order."
      }
    ]
  },
  {
    category: "Wallet & Payments",
    questions: [
      {
        q: "How does the wallet work?",
        a: "Your DropFlow wallet is used for auto-fulfillment. Deposit funds via card payment, and the balance is used to automatically pay vendors when processing orders. You can view all transactions and current balance on the Wallet page."
      },
      {
        q: "What payment methods are accepted?",
        a: "We accept all major credit and debit cards through our secure Stripe integration. All payments are processed with bank-level encryption."
      },
      {
        q: "Can I withdraw funds from my wallet?",
        a: "Wallet funds are intended for order fulfillment. If you need a refund, please contact our support team with your request."
      }
    ]
  },
  {
    category: "Subscription & Billing",
    questions: [
      {
        q: "What subscription plans are available?",
        a: "DropFlow offers 6 tiers from Starter (£12/month) to Enterprise (£100/month). Each tier includes different product limits, connected stores, and feature access. Visit the Subscription page to compare plans."
      },
      {
        q: "Can I upgrade or downgrade my plan?",
        a: "Yes! You can change your plan at any time from the Subscription page. Upgrades take effect immediately, and downgrades apply at the end of your billing cycle."
      },
      {
        q: "Is there a free trial?",
        a: "New accounts can explore the platform with limited features. Upgrade to a paid plan to unlock full functionality and higher limits."
      }
    ]
  },
  {
    category: "Security & Data",
    questions: [
      {
        q: "Is my data secure?",
        a: "Absolutely. We use industry-standard encryption for all data at rest and in transit. Your marketplace credentials are securely encrypted and never stored in plain text."
      },
      {
        q: "How do I verify my email address?",
        a: "After signing up, you'll receive a verification email. Click the link in the email to verify your address. You must verify your email before accessing the full dashboard."
      },
      {
        q: "What is VERO compliance?",
        a: "VERO (Verified Rights Owner Program) helps prevent listing trademarked or restricted products. DropFlow scans product titles and descriptions to flag potential VERO violations before publishing."
      }
    ]
  },
  {
    category: "Support",
    questions: [
      {
        q: "How do I contact support?",
        a: "You can reach our support team via email at support@dropflow.com. We typically respond within 24 hours during business days."
      },
      {
        q: "Is there documentation available?",
        a: "Yes! This FAQ page covers common questions. We also have detailed guides available in our Help Center for step-by-step instructions on all features."
      },
      {
        q: "What if I find a bug?",
        a: "Please report any issues to support@dropflow.com with details about what happened, what you expected, and steps to reproduce. Screenshots are helpful!"
      }
    ]
  }
];

export default function FAQ() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Frequently Asked Questions</h2>
          <p className="text-muted-foreground">Find answers to common questions about DropFlow</p>
        </div>
      </div>

      <div className="space-y-6">
        {faqData.map((category, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-xl">{category.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {category.questions.map((item, qIndex) => (
                  <AccordionItem key={qIndex} value={`item-${index}-${qIndex}`}>
                    <AccordionTrigger className="text-left" data-testid={`faq-question-${index}-${qIndex}`}>
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
