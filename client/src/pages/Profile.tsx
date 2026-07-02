import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { User, Pencil, Shield, Loader2, Mail, Phone, Check, KeyRound, AlertTriangle, Lock, Eye, EyeOff } from "lucide-react";
import { PageRefreshButton } from "@/components/PageRefreshButton";

export default function Profile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictEmail, setConflictEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPasswordField] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: (user as any).phone || "",
      });
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone: string; password: string }) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        const err: any = new Error(json.message || "Failed to update profile");
        err.canDelete = json.canDelete;
        err.status = res.status;
        throw err;
      }
      return json;
    },
    onSuccess: (data) => {
      if (data.requiresVerification) {
        setShowPasswordDialog(false);
        setConfirmPassword("");
        setOtpMessage(data.message);
        setOtpCode("");
        setShowOTPDialog(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setEditMode(false);
        setShowPasswordDialog(false);
        setConfirmPassword("");
        toast({
          title: "Profile Updated",
          description: "Your profile information has been saved successfully.",
        });
      }
    },
    onError: (error: any) => {
      if (error?.canDelete && error?.status === 409) {
        setConflictEmail(profileForm.email);
        setShowConflictDialog(true);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to update profile",
          variant: "destructive",
        });
      }
    },
  });

  const deleteConflictMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/user/profile/delete-conflicting", data);
      return response.json();
    },
    onSuccess: () => {
      setShowConflictDialog(false);
      toast({
        title: "Account Removed",
        description: "The conflicting account has been deleted. Try saving your profile again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete conflicting account",
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/user/profile/verify-code", { code });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setEditMode(false);
      setShowOTPDialog(false);
      setOtpCode("");
      toast({
        title: "Profile Updated",
        description: "Your profile changes have been verified and saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error?.message || "Invalid or expired verification code",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    setShowPasswordDialog(true);
  };

  const handleConfirmSave = () => {
    if (!confirmPassword) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm changes",
        variant: "destructive",
      });
      return;
    }
    profileMutation.mutate({
      ...profileForm,
      password: confirmPassword,
    });
  };

  const handleVerifyOTP = () => {
    if (otpCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the full 6-digit verification code",
        variant: "destructive",
      });
      return;
    }
    verifyCodeMutation.mutate(otpCode);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: (user as any).phone || "",
      });
    }
  };

  const hasChanges = user && (
    profileForm.firstName !== (user.firstName || "") ||
    profileForm.lastName !== (user.lastName || "") ||
    profileForm.email !== (user.email || "") ||
    profileForm.phone !== ((user as any).phone || "")
  );

  const emailChanged = user && profileForm.email !== (user.email || "");
  const phoneChanged = user && profileForm.phone !== ((user as any).phone || "");

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6" data-testid="page-profile">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Profile</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">Manage your personal information</p>
        </div>
        <PageRefreshButton />
      </div>

      <Card data-testid="card-profile">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle data-testid="text-profile-title">Personal Information</CardTitle>
                <CardDescription data-testid="text-profile-description">
                  {editMode ? "Edit your details below" : "Your account details"}
                </CardDescription>
              </div>
            </div>
            {!editMode ? (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)} data-testid="button-edit-profile">
                <Pencil className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveProfile} disabled={!hasChanges} data-testid="button-save-profile">
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                readOnly={!editMode}
                className={!editMode ? "bg-muted" : ""}
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                readOnly={!editMode}
                className={!editMode ? "bg-muted" : ""}
                data-testid="input-last-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
              {editMode && emailChanged && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Requires email verification
                </span>
              )}
            </Label>
            <Input
              id="email"
              type="email"
              value={profileForm.email}
              readOnly
              className="bg-muted"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
              {editMode && phoneChanged && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  Requires email verification
                </span>
              )}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder={editMode ? "+44 7000 000000" : "Not set"}
              value={profileForm.phone}
              onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
              readOnly={!editMode}
              className={!editMode ? "bg-muted" : ""}
              data-testid="input-phone"
            />
          </div>

          {editMode && (emailChanged || phoneChanged) && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Email verification required
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Changing your {emailChanged && phoneChanged ? "email or phone number" : emailChanged ? "email address" : "phone number"} requires a 6-digit verification code sent to your current email address.
                </p>
              </div>
            </div>
          )}

          {editMode && !emailChanged && !phoneChanged && hasChanges && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You'll need to enter your current password to confirm changes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-account-info">
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Account ID</span>
              <span className="font-mono text-xs" data-testid="text-account-id">{user?.id?.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Email Status</span>
              <span className="flex items-center gap-1 text-green-600" data-testid="text-email-status">
                <Check className="h-3 w-3" /> Verified
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Subscription</span>
              <span data-testid="text-subscription">{(user as any)?.subscriptionPlan || "Free"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Referral Code</span>
              <span className="font-mono text-xs" data-testid="text-referral-code">{(user as any)?.referralCode || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-change-password">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base" data-testid="text-change-password-title">Change Password</CardTitle>
                <CardDescription data-testid="text-change-password-description">
                  Update your account password
                </CardDescription>
              </div>
            </div>
            {!showChangePassword && (
              <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)} data-testid="button-change-password">
                <Pencil className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            )}
          </div>
        </CardHeader>
        {showChangePassword && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPasswordField(e.target.value)}
                  placeholder="Enter current password"
                  className="pl-10 pr-10"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-current-password"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="pl-10 pr-10"
                  minLength={8}
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmNewPassword"
                  type={showConfirmNewPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10"
                  minLength={8}
                  data-testid="input-confirm-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-confirm-new-password"
                >
                  {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowChangePassword(false);
                  setCurrentPasswordField("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmNewPassword(false);
                }}
                data-testid="button-cancel-change-password"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                onClick={async () => {
                  if (newPassword !== confirmNewPassword) {
                    toast({
                      title: "Error",
                      description: "New passwords do not match",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (newPassword.length < 8) {
                    toast({
                      title: "Error",
                      description: "New password must be at least 8 characters",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsChangingPassword(true);
                  try {
                    const res = await fetch("/api/auth/change-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ currentPassword, newPassword }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.message || "Failed to change password");
                    }
                    toast({
                      title: "Password Changed",
                      description: "Your password has been updated successfully.",
                    });
                    setShowChangePassword(false);
                    setCurrentPasswordField("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmNewPassword(false);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to change password",
                      variant: "destructive",
                    });
                  } finally {
                    setIsChangingPassword(false);
                  }
                }}
                data-testid="button-save-new-password"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        setShowPasswordDialog(open);
        if (!open) setConfirmPassword("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Confirm Your Identity
            </DialogTitle>
            <DialogDescription>
              Enter your current password to confirm the profile changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Current Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => e.key === "Enter" && handleConfirmSave()}
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setConfirmPassword(""); }} data-testid="button-cancel-confirm">
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} disabled={profileMutation.isPending || !confirmPassword} data-testid="button-confirm-save">
              {profileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOTPDialog} onOpenChange={(open) => {
        setShowOTPDialog(open);
        if (!open) setOtpCode("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email Verification
            </DialogTitle>
            <DialogDescription>
              {otpMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} data-testid="input-otp-code">
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground text-center">
              The code expires in 10 minutes. Check your inbox and spam folder.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowOTPDialog(false); setOtpCode(""); }} data-testid="button-cancel-otp">
              Cancel
            </Button>
            <Button onClick={handleVerifyOTP} disabled={verifyCodeMutation.isPending || otpCode.length !== 6} data-testid="button-verify-otp">
              {verifyCodeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Verify & Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConflictDialog} onOpenChange={(open) => {
        setShowConflictDialog(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Email Already In Use
            </DialogTitle>
            <DialogDescription>
              Another account is registered with <strong>{conflictEmail}</strong>. Would you like to delete that account so you can use this email for your current account?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              This will permanently delete the other account and all its data. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConflictDialog(false)} data-testid="button-cancel-conflict">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConflictMutation.mutate({ email: conflictEmail, password: confirmPassword })}
              disabled={deleteConflictMutation.isPending}
              data-testid="button-delete-conflict"
            >
              {deleteConflictMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete & Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
