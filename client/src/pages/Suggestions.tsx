import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lightbulb, Send, ThumbsUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const suggestions = [
  { title: "Multi-currency support", votes: 24, status: "Under Review" },
  { title: "Bulk product editing", votes: 18, status: "Planned" },
  { title: "Advanced analytics dashboard", votes: 15, status: "In Development" },
  { title: "Social media integration", votes: 12, status: "Under Review" },
];

export default function Suggestions() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Suggestion submitted", description: "Thank you for your feedback!" });
    setTitle("");
    setDesc("");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">Suggestions</h1>
        <p className="text-muted-foreground mt-1">Share your ideas to help improve the platform</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Submit an Idea</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suggestion-title">Title</Label>
                <Input id="suggestion-title" placeholder="A short description of your idea" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suggestion-desc">Details</Label>
                <Textarea id="suggestion-desc" placeholder="Describe your suggestion in detail..." value={desc} onChange={e => setDesc(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full"><Send className="h-4 w-4 mr-2" />Submit Suggestion</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Recent Suggestions</h3>
          {suggestions.map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm">{s.title}</h4>
                  <span className="text-xs text-muted-foreground">{s.status}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ThumbsUp className="h-3.5 w-3.5" /> {s.votes}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}