import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Loader2, Plus, Pencil, Trash2, Rocket, Wrench, Zap, X } from "lucide-react";
import type { ChangelogEntry } from "@shared/schema";

const CATEGORY_META: Record<string, { label: string; icon: any; className: string }> = {
  new: { label: "New", icon: Rocket, className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  improvement: { label: "Improved", icon: Zap, className: "bg-blue-500/10 text-blue-600 border border-blue-500/30" },
  fix: { label: "Fixed", icon: Wrench, className: "bg-amber-500/10 text-amber-600 border border-amber-500/30" },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.improvement;
  const Icon = meta.icon;
  return (
    <Badge className={`gap-1 ${meta.className}`} data-testid={`badge-category-${category}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

function formatDate(value: string | Date | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

type EditorState = {
  id: number | null;
  title: string;
  body: string;
  category: string;
  isPublished: boolean;
};

const EMPTY_EDITOR: EditorState = { id: null, title: "", body: "", category: "improvement", isPublished: true };

export default function WhatsNew() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === "true";

  const [editor, setEditor] = useState<EditorState | null>(null);

  const { data: entries = [], isLoading } = useQuery<ChangelogEntry[]>({
    queryKey: [isAdmin ? "/api/admin/changelog" : "/api/changelog"],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/changelog"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/changelog"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: EditorState) => {
      const payload = {
        title: data.title.trim(),
        body: data.body.trim(),
        category: data.category,
        isPublished: data.isPublished,
      };
      if (data.id) {
        return apiRequest("PATCH", `/api/admin/changelog/${data.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/changelog", payload);
    },
    onSuccess: () => {
      invalidate();
      setEditor(null);
      toast({ title: "Saved", description: "Your update is live for customers." });
    },
    onError: (err: any) => {
      toast({ title: "Could not save", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/changelog/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Deleted", description: "The update has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Could not delete", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!editor) return;
    if (!editor.title.trim() || !editor.body.trim()) {
      toast({ title: "Missing details", description: "Please add a title and description.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(editor);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="w-6 h-6 text-primary" />
            What's New
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The latest improvements and updates to your app, updated every month.
          </p>
        </div>
        {isAdmin && !editor && (
          <Button onClick={() => setEditor({ ...EMPTY_EDITOR })} data-testid="button-add-update">
            <Plus className="w-4 h-4 mr-1" />
            Post update
          </Button>
        )}
      </div>

      {isAdmin && editor && (
        <Card data-testid="card-editor">
          <CardHeader>
            <CardTitle className="text-base">{editor.id ? "Edit update" : "New update"}</CardTitle>
            <CardDescription>Customers will see this on their What's New page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="editor-title">Title</Label>
              <Input
                id="editor-title"
                value={editor.title}
                maxLength={200}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                placeholder="e.g. Faster, more reliable stock updates"
                data-testid="input-update-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editor-body">Details</Label>
              <Textarea
                id="editor-body"
                value={editor.body}
                rows={5}
                onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                placeholder="Explain what changed and how it helps sellers."
                data-testid="input-update-body"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editor.category} onValueChange={(v) => setEditor({ ...editor, category: v })}>
                  <SelectTrigger className="w-[180px]" data-testid="select-update-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="fix">Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id="editor-published"
                  checked={editor.isPublished}
                  onCheckedChange={(v) => setEditor({ ...editor, isPublished: v })}
                  data-testid="switch-update-published"
                />
                <Label htmlFor="editor-published">Visible to customers</Label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-update">
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditor(null)} data-testid="button-cancel-update">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground" data-testid="text-empty">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No updates yet. Check back soon for the latest improvements.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id} className={!entry.isPublished ? "opacity-60 border-dashed" : ""} data-testid={`card-update-${entry.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryBadge category={entry.category} />
                      {!entry.isPublished && (
                        <Badge variant="outline" className="text-muted-foreground">Hidden</Badge>
                      )}
                      <span className="text-xs text-muted-foreground" data-testid={`text-date-${entry.id}`}>
                        {formatDate(entry.publishedAt)}
                      </span>
                    </div>
                    <CardTitle className="text-lg" data-testid={`text-title-${entry.id}`}>{entry.title}</CardTitle>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditor({
                          id: entry.id,
                          title: entry.title,
                          body: entry.body,
                          category: entry.category,
                          isPublished: entry.isPublished,
                        })}
                        data-testid={`button-edit-${entry.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this update?")) deleteMutation.mutate(entry.id);
                        }}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed" data-testid={`text-body-${entry.id}`}>
                  {entry.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
