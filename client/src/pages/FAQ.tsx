import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import { faqData } from "@/lib/faq-data";
import { PageRefreshButton } from "@/components/PageRefreshButton";

export default function FAQ() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Find answers to common questions about DropandSell Automation App</p>
          </div>
        </div>
        <PageRefreshButton />
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
