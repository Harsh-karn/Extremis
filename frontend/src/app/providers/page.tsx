"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Plus, Send, CheckCircle, XCircle } from "lucide-react";
import axios from "axios";

interface Provider {
  id: string;
  display_name: string;
  provider_type: string;
  is_active: boolean;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  
  // Form state
  const [displayName, setDisplayName] = useState("");
  const [providerType, setProviderType] = useState("smtp");
  const [credentials, setCredentials] = useState('{\n  "host": "smtp.gmail.com",\n  "port": 587,\n  "username": "your-email@gmail.com",\n  "password": "your-app-password"\n}');
  
  // Test state
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{success?: boolean, message?: string} | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/providers");
      setProviders(res.data);
    } catch (error) {
      console.error("Failed to fetch providers", error);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const openCreateDialog = () => {
    setDisplayName("");
    setProviderType("smtp");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        display_name: displayName,
        provider_type: providerType,
        credentials: credentials
      };

      await axios.post("http://localhost:8000/api/providers", payload);
      setIsDialogOpen(false);
      fetchProviders();
    } catch (error) {
      console.error("Failed to save provider", error);
      alert("Error saving provider.");
    }
  };

  const openTestDialog = (id: string) => {
    setSelectedProviderId(id);
    setTestEmail("");
    setTestResult(null);
    setIsTestDialogOpen(true);
  };

  const handleTest = async () => {
    if (!selectedProviderId || !testEmail) return;
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const res = await axios.post(`http://localhost:8000/api/providers/${selectedProviderId}/test`, {
        to_email: testEmail
      });
      setTestResult({ success: true, message: res.data.message });
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.response?.data?.detail || "Failed to send test email" 
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Providers</h1>
          <p className="text-muted-foreground">
            Connect your SMTP servers or API services to send emails.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> Add Provider</Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Email Provider</DialogTitle>
              <DialogDescription>
                Configure credentials to route your campaigns.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Primary Gmail SMTP" />
              </div>
              
              <div className="space-y-2">
                <Label>Provider Type</Label>
                <Select value={providerType} onValueChange={setProviderType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smtp">SMTP</SelectItem>
                    <SelectItem value="ses">AWS SES</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credentials">Credentials (JSON)</Label>
                <Textarea 
                  id="credentials" 
                  value={credentials} 
                  onChange={e => setCredentials(e.target.value)} 
                  className="font-mono text-sm h-32"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleSave} disabled={!displayName || !credentials}>Save Provider</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map(provider => (
          <Card key={provider.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                  <CardDescription className="mt-1 uppercase text-xs font-bold tracking-wider">{provider.provider_type}</CardDescription>
                </div>
                <Server className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mt-2 space-x-2">
                <div className={`h-2 w-2 rounded-full ${provider.is_active ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-muted-foreground">{provider.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/20 pt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => openTestDialog(provider.id)}>
                <Send className="mr-2 h-4 w-4" /> Test Connection
              </Button>
            </CardFooter>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No providers configured. Add one above to start sending.
          </div>
        )}
      </div>

      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Connection</DialogTitle>
            <DialogDescription>
              Send a test email using this provider to verify your credentials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testEmail">Recipient Email</Label>
              <Input id="testEmail" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            {testResult && (
              <div className={`p-3 rounded-md flex items-start gap-3 text-sm ${testResult.success ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
                {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
                <div>{testResult.message}</div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={handleTest} disabled={!testEmail || isTesting}>
              {isTesting ? "Sending..." : "Send Test Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
