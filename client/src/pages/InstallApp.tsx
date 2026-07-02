import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Monitor, Download, CheckCircle2, Zap, Globe, Bell, ArrowRight } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallApp() {
  const [, navigate] = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4">Optional</Badge>
          <h1 className="text-3xl font-bold mb-2">Install DropandSell Automation App</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Get the full app experience on your desktop or smartphone for faster access and automation.
          </p>
        </div>

        {isInstalled ? (
          <Card className="mb-8 border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 text-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <div>
                  <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">
                    App Installed Successfully!
                  </h3>
                  <p className="text-muted-foreground">
                    You can now access DropandSell Automation App from your home screen or app launcher.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Desktop App
                </CardTitle>
                <CardDescription>
                  Install on Windows, Mac, or Linux
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" />
                    Faster performance
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-primary" />
                    Works offline
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Bell className="h-4 w-4 text-primary" />
                    Desktop notifications
                  </li>
                </ul>
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall} 
                    className="w-full"
                    data-testid="button-install-desktop"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install Desktop App
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium mb-1">How to install:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Click the install icon in your browser's address bar</li>
                      <li>Or use menu → "Install DropandSell Automation App"</li>
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Mobile App
                </CardTitle>
                <CardDescription>
                  Install on iOS or Android
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" />
                    Quick access from home screen
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-primary" />
                    Manage on the go
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Bell className="h-4 w-4 text-primary" />
                    Push notifications
                  </li>
                </ul>
                {isIOS ? (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium mb-1">iOS Installation:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Tap the Share button in Safari</li>
                      <li>Select "Add to Home Screen"</li>
                      <li>Tap "Add" to confirm</li>
                    </ol>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium mb-1">Android Installation:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Tap the browser menu (three dots)</li>
                      <li>Select "Add to Home Screen"</li>
                      <li>Tap "Add" to confirm</li>
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Benefits of Installing the App</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4">
                <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Faster Access</h4>
                <p className="text-sm text-muted-foreground">
                  Launch instantly from your desktop or home screen
                </p>
              </div>
              <div className="text-center p-4">
                <Bell className="h-8 w-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Get alerts for orders, stock updates, and more
                </p>
              </div>
              <div className="text-center p-4">
                <Download className="h-8 w-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Auto-Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically sync listings from vendors
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={() => navigate('/')} 
            data-testid="button-go-to-dashboard"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
