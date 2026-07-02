import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Send, Loader2, Clock, CheckCircle2, MessageSquare, AlertCircle, ImagePlus, X } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { useAuth } from "@/hooks/use-auth";
import type { Suggestion } from "@shared/schema";

const CATEGORIES = [
  { value: "feature_request", label: "Feature Request" },
  { value: "improvement", label: "Improvement" },
  { value: "ui_feedback", label: "UI / Design Feedback" },
  { value: "integration", label: "New Integration" },
  { value: "other", label: "Other" },
];

const MAX_IMAGES = 4;
const MAX_FILE_SIZE_MB = 10;

function getStatusBadge(status: string) {
  switch (status) {
    case "new":
      return <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${status}`}><Clock className="w-3 h-3" />New</Badge>;
    case "reviewed":
      return <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600" data-testid={`badge-status-${status}`}><MessageSquare className="w-3 h-3" />Reviewed</Badge>;
    case "planned":
      return <Badge className="gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/30" data-testid={`badge-status-${status}`}><AlertCircle className="w-3 h-3" />Planned</Badge>;
    case "implemented":
      return <Badge className="gap-1 bg-green-500/10 text-green-600 border border-green-500/30" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3" />Implemented</Badge>;
    case "declined":
      return <Badge variant="destructive" className="gap-1" data-testid={`badge-status-${status}`}>Declined</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

// Small helper used by both the user and admin views to render the
// attached pictures inline. Clicking a thumbnail opens it full size in a
// new tab.
function ImageGrid({ urls, idPrefix }: { urls: string[] | null | undefined; idPrefix: string }) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
      {urls.map((u, i) => (
        <a
          key={i}
          href={u}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md overflow-hidden border hover:opacity-90 transition"
          data-testid={`${idPrefix}-image-${i}`}
        >
          <img src={u} alt={`attachment ${i + 1}`} className="w-full h-24 object-cover" />
        </a>
      ))}
    </div>
  );
}

export default function Suggestions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [category, setCategory] = useState("feature_request");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Pending image attachments. We keep both the File (for upload) and a
  // local object URL (for the preview thumbnail) so the previews work
  // without re-reading the file.
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Hold the latest preview URLs in a ref so the unmount-cleanup effect
  // can revoke whatever was pending without re-running on every change.
  const pendingPreviewsRef = useRef<string[]>([]);
  pendingPreviewsRef.current = pendingImages.map(p => p.preview);
  useEffect(() => {
    return () => {
      pendingPreviewsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  const isAdmin = user?.isAdmin === "true" || user?.email === "dropandsellauth@gmail.com";

  const { data: userSuggestionsData, isLoading } = useQuery<{ suggestions: Suggestion[] }>({
    queryKey: ["/api/suggestions"],
  });

  const { data: adminSuggestionsData, isLoading: adminLoading } = useQuery<{ suggestions: Suggestion[] }>({
    queryKey: ["/api/admin/suggestions"],
    enabled: isAdmin,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { category: string; subject: string; message: string; files: File[] }) => {
      // Use FormData so we can send files alongside text fields. We can't
      // use apiRequest here because that helper JSON-serialises the body.
      const fd = new FormData();
      fd.append('category', data.category);
      fd.append('subject', data.subject);
      fd.append('message', data.message);
      for (const f of data.files) fd.append('images', f, f.name);
      const res = await fetch('/api/suggestions', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Submit failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Suggestion Submitted", description: "Thank you for your feedback! We'll review it shortly." });
      setCategory("feature_request");
      setSubject("");
      setMessage("");
      // Release any preview blob URLs and clear the queue.
      pendingImages.forEach(p => URL.revokeObjectURL(p.preview));
      setPendingImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      if (isAdmin) queryClient.invalidateQueries({ queryKey: ["/api/admin/suggestions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit suggestion", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/suggestions/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
    },
  });

  const userSuggestions = userSuggestionsData?.suggestions || [];
  const adminSuggestions = adminSuggestionsData?.suggestions || [];

  const handleFilesPicked = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const picked = Array.from(filesList);
    const accepted: { file: File; preview: string }[] = [];
    const slotsLeft = MAX_IMAGES - pendingImages.length;
    for (const f of picked.slice(0, slotsLeft)) {
      if (!f.type.startsWith('image/')) {
        toast({ title: 'Not an image', description: `${f.name} was skipped — only image files are allowed.`, variant: 'destructive' });
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast({ title: 'File too large', description: `${f.name} is over ${MAX_FILE_SIZE_MB}MB and was skipped.`, variant: 'destructive' });
        continue;
      }
      accepted.push({ file: f, preview: URL.createObjectURL(f) });
    }
    if (picked.length > slotsLeft) {
      toast({ title: 'Limit reached', description: `You can attach up to ${MAX_IMAGES} pictures per suggestion.` });
    }
    setPendingImages(prev => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePending = (idx: number) => {
    setPendingImages(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Missing Fields", description: "Please fill in both subject and message.", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      category,
      subject: subject.trim(),
      message: message.trim(),
      files: pendingImages.map(p => p.file),
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display" data-testid="text-page-title">Suggestions</h1>
          <p className="text-muted-foreground mt-1">Suggest features you'd like to see on the platform</p>
        </div>
        <PageRefreshButton queryKeys={["/api/suggestions"]} />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">This page is for feature suggestions only</p>
          <p className="mt-0.5">For customer support issues, account problems, or urgent help, please use the support chat. This tab is strictly for suggesting new features and improvements to the platform.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Submit a Suggestion
          </CardTitle>
          <CardDescription>Tell us what features or improvements you'd like to see — a screenshot helps us understand faster.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value} data-testid={`option-category-${c.value}`}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief title for your suggestion"
                  maxLength={200}
                  data-testid="input-subject"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the feature or improvement you'd like to see in detail..."
                rows={5}
                maxLength={2000}
                data-testid="input-message"
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
            </div>

            {/* Attach pictures — optional. Up to 4 images, 10MB each.
                Screenshots are the most common use case. */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Attach pictures (optional)</label>
              <p className="text-xs text-muted-foreground">
                Add up to {MAX_IMAGES} screenshots or photos ({MAX_FILE_SIZE_MB}MB each). We'll automatically resize them so they upload quickly.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesPicked(e.target.files)}
                className="hidden"
                data-testid="input-suggestion-images"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={pendingImages.length >= MAX_IMAGES}
                className="gap-2"
                data-testid="button-add-image"
              >
                <ImagePlus className="w-4 h-4" />
                {pendingImages.length === 0 ? 'Add pictures' : `Add more (${pendingImages.length}/${MAX_IMAGES})`}
              </Button>
              {pendingImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {pendingImages.map((p, idx) => (
                    <div key={idx} className="relative group rounded-md overflow-hidden border" data-testid={`pending-image-${idx}`}>
                      <img src={p.preview} alt={p.file.name} className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remove picture"
                        data-testid={`button-remove-image-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                        {p.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" disabled={submitMutation.isPending} className="gap-2" data-testid="button-submit-suggestion">
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Suggestion
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Suggestions</CardTitle>
          <CardDescription>Track the status of your submitted suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : userSuggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No suggestions yet. Be the first to share your ideas!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userSuggestions.map((s) => (
                <div key={s.id} className="border rounded-lg p-4 space-y-2" data-testid={`suggestion-card-${s.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium" data-testid={`text-suggestion-subject-${s.id}`}>{s.subject}</h4>
                        <Badge variant="outline" className="text-xs">{CATEGORIES.find(c => c.value === s.category)?.label || s.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-suggestion-message-${s.id}`}>{s.message}</p>
                      <ImageGrid urls={(s as any).imageUrls} idPrefix={`suggestion-${s.id}`} />
                    </div>
                    {getStatusBadge(s.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              All User Suggestions (Admin)
            </CardTitle>
            <CardDescription>Review and manage suggestions from all users</CardDescription>
          </CardHeader>
          <CardContent>
            {adminLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : adminSuggestions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No suggestions yet.</p>
            ) : (
              <div className="space-y-3">
                {adminSuggestions.map((s) => (
                  <div key={s.id} className="border rounded-lg p-4 space-y-2" data-testid={`admin-suggestion-card-${s.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{s.subject}</h4>
                          <Badge variant="outline" className="text-xs">{CATEGORIES.find(c => c.value === s.category)?.label || s.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{s.message}</p>
                        <ImageGrid urls={(s as any).imageUrls} idPrefix={`admin-suggestion-${s.id}`} />
                        <p className="text-xs text-muted-foreground mt-1">
                          From: <span className="font-medium">{s.userName || 'Unknown'}</span> ({s.userEmail}) — {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={s.status}
                          onValueChange={(val) => statusMutation.mutate({ id: s.id, status: val })}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-admin-status-${s.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="implemented">Implemented</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
