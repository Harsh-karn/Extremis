"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Trash2, Edit } from "lucide-react";
import axios from "axios";

interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body_markdown?: string;
  body_html?: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const fetchTemplates = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/templates");
      setTemplates(res.data);
    } catch (error) {
      console.error("Failed to fetch templates", error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setName("");
    setCategory("");
    setSubject("");
    setBody("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (t: Template) => {
    setEditingTemplate(t);
    setName(t.name);
    setCategory(t.category || "");
    setSubject(t.subject);
    setBody(t.body_markdown || t.body_html || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name,
        category,
        subject,
        body_markdown: body,
        body_html: body // In a real app we might compile markdown to HTML here
      };

      if (editingTemplate) {
        await axios.put(`http://localhost:8000/api/templates/${editingTemplate.id}`, payload);
      } else {
        await axios.post("http://localhost:8000/api/templates", payload);
      }
      
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error("Failed to save template", error);
      alert("Error saving template.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await axios.delete(`http://localhost:8000/api/templates/${id}`);
      fetchTemplates();
    } catch (error) {
      console.error("Failed to delete template", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Create and manage email templates with dynamic merge fields.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> New Template</Button>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>
                Use {"{{field}}"} tags to insert dynamic data (e.g., {"{{name}}"}, {"{{company}}"}).
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Intro Email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Sales, Recruiting" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Opportunity at {{company}}" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Email Body (Markdown)</Label>
                  <span className="text-xs text-muted-foreground">Supported fields: {"{{name}}"}, {"{{email}}"}, {"{{company}}"}, {"{{role}}"}</span>
                </div>
                <Textarea 
                  id="body" 
                  value={body} 
                  onChange={e => setBody(e.target.value)} 
                  className="min-h-[250px] font-mono text-sm"
                  placeholder="Hi {{name}},\n\nI saw you are working at {{company}}..." 
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={handleSave} disabled={!name || !subject || !body}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <Card key={template.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="mt-1">{template.category || "Uncategorized"}</CardDescription>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium mt-2 mb-1">Subject:</div>
              <div className="text-sm text-muted-foreground truncate bg-secondary/50 p-2 rounded-md">
                {template.subject}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(template.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No templates found. Create your first one above!
          </div>
        )}
      </div>
    </div>
  );
}
