import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState("");

  const handleSave = async () => {
    try {
      await apiRequest("PATCH", "/api/user/profile", { firstName, lastName, phone });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-lg">{firstName?.[0]}{lastName?.[0]}</AvatarFallback>
              </Avatar>
              <Button size="icon" variant="outline" className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full">
                <Camera className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div>
              <p className="font-medium">{firstName} {lastName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {user?.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
            </div>
          </div>

          <Button onClick={handleSave} className="w-full sm:w-auto">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}