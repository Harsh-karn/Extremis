"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, XCircle, Rocket, Eye, RotateCw } from "lucide-react";
import axios from "axios";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Data sources
  const [lists, setLists] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  
  // Form state
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [delayMin, setDelayMin] = useState(30);
  const [delayMax, setDelayMax] = useState(90);

  // Preview state
  const [previews, setPreviews] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [campRes, listRes, tempRes, provRes] = await Promise.all([
        axios.get("http://localhost:8000/api/campaigns").catch(() => ({ data: [] })),
        // Note: For MVP we might not have a /api/recipients/lists route that returns all, assuming we do or will fake it if missing. Let's assume we can fetch them or we just skip if fails.
        axios.get("http://localhost:8000/api/recipients/lists").catch(() => ({ data: [] })), 
        axios.get("http://localhost:8000/api/templates").catch(() => ({ data: [] })),
        axios.get("http://localhost:8000/api/providers").catch(() => ({ data: [] }))
      ]);
      setCampaigns(campRes.data);
      // Fallback to fake data for dropdowns if API endpoints don't return arrays yet
      setLists(Array.isArray(listRes.data) ? listRes.data : []);
      setTemplates(Array.isArray(tempRes.data) ? tempRes.data : []);
      setProviders(Array.isArray(provRes.data) ? provRes.data : []);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateDialog = () => {
    setName("");
    setListId("");
    setTemplateId("");
    setProviderId("");
    setIsDialogOpen(true);
  };

  const handleCreate = async () => {
    try {
      await axios.post("http://localhost:8000/api/campaigns", {
        name,
        recipient_list_id: listId,
        template_id: templateId,
        provider_config_id: providerId,
        delay_min_seconds: delayMin,
        delay_max_seconds: delayMax
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to create campaign", error);
      alert("Error creating campaign.");
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await axios.post(`http://localhost:8000/api/campaigns/${id}/${action}`);
      fetchData();
    } catch (error) {
      console.error(`Failed to ${action} campaign`, error);
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const res = await axios.get(`http://localhost:8000/api/campaigns/${id}/preview`);
      setPreviews(res.data.previews);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error("Failed to load preview", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sending': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Orchestrate your email sends with templates and custom lists.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={openCreateDialog}><Rocket className="mr-2 h-4 w-4" /> New Campaign</Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>
                Configure the sending parameters for your new blast.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q4 Outreach" />
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    {templates.length === 0 && <SelectItem value="none" disabled>No templates available</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Recipient List</Label>
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger><SelectValue placeholder="Select list" /></SelectTrigger>
                  <SelectContent>
                    {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    {lists.length === 0 && <SelectItem value="none" disabled>No lists available</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {providers.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                    {providers.length === 0 && <SelectItem value="none" disabled>No providers available</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delayMin">Min Delay (sec)</Label>
                  <Input id="delayMin" type="number" value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delayMax">Max Delay (sec)</Label>
                  <Input id="delayMax" type="number" value={delayMax} onChange={e => setDelayMax(Number(e.target.value))} />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!name || !templateId || !listId || !providerId}>Save Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {campaigns.map(campaign => (
          <Card key={campaign.id} className="w-full">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{campaign.name}</CardTitle>
                  <CardDescription className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(campaign.id)}>
                    <Eye className="mr-2 h-4 w-4" /> Preview
                  </Button>
                  
                  {campaign.status === 'draft' && (
                    <Button size="sm" onClick={() => handleAction(campaign.id, 'start')}>
                      <Play className="mr-2 h-4 w-4" /> Start
                    </Button>
                  )}
                  {campaign.status === 'sending' && (
                    <Button variant="secondary" size="sm" onClick={() => handleAction(campaign.id, 'pause')}>
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </Button>
                  )}
                  {campaign.status === 'paused' && (
                    <Button size="sm" onClick={() => handleAction(campaign.id, 'resume')}>
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </Button>
                  )}
                  {['draft', 'sending', 'paused'].includes(campaign.status) && (
                    <Button variant="destructive" size="sm" onClick={() => handleAction(campaign.id, 'cancel')}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
               <div className="flex items-center text-sm text-muted-foreground pt-4 border-t">
                  <Button variant="ghost" size="sm" className="ml-auto -mr-2" onClick={fetchData}>
                    <RotateCw className="mr-2 h-3 w-3" /> Refresh Status
                  </Button>
               </div>
            </CardContent>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No campaigns found. Create one above to get started.
          </div>
        )}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Campaign Preview</DialogTitle>
            <DialogDescription>
              Showing a preview of the first few rendered emails.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {previews.map((preview, i) => (
              <Card key={i} className="border-muted bg-muted/30">
                <CardHeader className="p-4 pb-2">
                  <div className="text-sm font-medium">To: {preview.recipient_email}</div>
                  <div className="text-sm font-bold mt-1">Subject: {preview.subject}</div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="text-sm whitespace-pre-wrap font-mono bg-background p-3 rounded border">
                    {preview.body}
                  </div>
                </CardContent>
              </Card>
            ))}
            {previews.length === 0 && <p className="text-sm text-muted-foreground">No preview available.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
