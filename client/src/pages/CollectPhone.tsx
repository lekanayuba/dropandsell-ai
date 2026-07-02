import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Loader2 } from "lucide-react";

export default function CollectPhone() {
  const [phone, setPhone] = useState("");
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/phone", { phone });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Phone number saved", description: "Thanks! You're all set." });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save your number",
        description: err?.message || "Please check your number and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number to continue.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-5">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <CardTitle data-testid="text-collect-phone-title">Add your phone number</CardTitle>
          <CardDescription>
            We need your phone number before you continue. It's saved to your profile straight away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collect-phone">Phone number</Label>
              <Input
                id="collect-phone"
                type="tel"
                placeholder="+44 7000 000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                data-testid="input-collect-phone"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={saveMutation.isPending}
              data-testid="button-save-phone"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save and continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
