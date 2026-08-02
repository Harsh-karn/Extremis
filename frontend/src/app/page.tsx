"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, AlertCircle, CheckCircle2, Loader2, Send, Eye, EyeOff, PlayCircle, Trash2, PauseCircle } from "lucide-react";

export default function MailSenderWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [gmailEmail, setGmailEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  
  // Data State
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  
  // Batching State
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [hasActiveCampaign, setHasActiveCampaign] = useState(false);

  // Results State
  const [results, setResults] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('mailforge_campaign');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGmailEmail(data.gmailEmail || "");
        setAllRecords(data.allRecords || []);
        
        if (data.allRecords && data.allRecords.length > 0) {
          setPreview(data.allRecords.slice(0, 5));
        }
        
        setColumns(data.columns || []);
        setEmailColumn(data.emailColumn || "");
        setSubject(data.subject || "");
        setBody(data.body || "");
        setSentEmails(new Set(data.sentEmails || []));
        setTotalRows(data.allRecords?.length || 0);
        
        if (data.allRecords?.length > 0 && data.sentEmails?.length < data.allRecords?.length) {
          setHasActiveCampaign(true);
        }
      } catch (e) {
        console.error("Failed to load campaign", e);
      }
    }
  }, []);

  const saveCampaign = (newSentEmails?: Set<string>) => {
    const emailsToSave = newSentEmails || sentEmails;
    const data = {
      gmailEmail,
      allRecords,
      columns,
      emailColumn,
      subject,
      body,
      sentEmails: Array.from(emailsToSave)
    };
    localStorage.setItem('mailforge_campaign', JSON.stringify(data));
  };

  const clearCampaign = () => {
    localStorage.removeItem('mailforge_campaign');
    setHasActiveCampaign(false);
    setAllRecords([]);
    setTotalRows(0);
    setSentEmails(new Set());
    setPreview([]);
    setColumns([]);
    setSubject("");
    setBody("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";

      const res = await fetch(`${apiUrl}/api/sender/parse-csv`, {
        method: "POST",
        headers: {
            "X-API-Key": apiKey
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to upload file");
      
      setColumns(data.columns);
      setPreview(data.preview);
      setAllRecords(data.all_rows);
      setTotalRows(data.total_rows);
      setSentEmails(new Set());
      setHasActiveCampaign(false);
      
      // Auto-guess email column safely handling non-string column names
      const guessedEmail = data.columns.find((c: any) => String(c).toLowerCase().includes("email"));
      if (guessedEmail) setEmailColumn(String(guessedEmail));
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!gmailEmail || !appPassword || !emailColumn || !subject || !body || allRecords.length === 0) {
      alert("Please fill out all fields.");
      return;
    }
    
    // Check pending records
    const pendingRecords = allRecords.filter(r => !sentEmails.has(r[emailColumn]));
    if (pendingRecords.length === 0) {
      alert("All emails in this campaign have already been sent!");
      return;
    }
    
    // Batch up to 500 emails
    const batch = pendingRecords.slice(0, 500);

    // Save initial state if starting
    saveCampaign();

    setIsSending(true);
    setResults([]);
    
    try {
      const payload = {
        gmail_email: gmailEmail,
        gmail_app_password: appPassword,
        subject_template: subject,
        body_template: body,
        recipients: batch,
        email_column: emailColumn
      };
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
      
      abortControllerRef.current = new AbortController();
      
      const res = await fetch(`${apiUrl}/api/sender/send`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "X-API-Key": apiKey
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });
      
      if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Failed to send emails");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream not available");
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                if (data.error && !data.email) {
                    throw new Error(data.error);
                }
                setResults(prev => [...prev, data]);
                if (data.status === 'success') {
                    setSentEmails(prev => {
                        const next = new Set(prev);
                        next.add(data.email);
                        saveCampaign(next);
                        return next;
                    });
                }
            } catch (e: any) {
                if (e.message !== "Unexpected end of JSON input") {
                    throw e; 
                }
            }
        }
      }
      setStep(4);
      setHasActiveCampaign(true); // show banner next time if incomplete
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Paused by user
        setStep(4);
        setHasActiveCampaign(true);
      } else {
        alert(err.message);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 flex justify-center items-center gap-3">
          <img src="/logo.png" alt="extremis logo" className="h-12 w-auto object-contain" />
          extremis
        </h1>
        <p className="text-gray-500">Send personalized bulk emails directly from your Gmail.</p>
      </div>

      {hasActiveCampaign && step === 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex justify-between items-center animate-in fade-in slide-in-from-top-4">
          <div>
            <h3 className="font-medium text-amber-800">You have a paused campaign</h3>
            <p className="text-sm text-amber-700">{sentEmails.size} out of {totalRows} emails sent.</p>
          </div>
          <div className="space-x-3 flex">
             <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={clearCampaign}>
               <Trash2 className="h-4 w-4 mr-2"/> Clear 
             </Button>
             <Button 
               onClick={() => {
                 if (!appPassword) { alert("Please enter your App Password below before resuming."); return; }
                 const pending = allRecords.filter(r => !sentEmails.has(r[emailColumn]));
                 if (pending.length > 0) setPreview([pending[0]]);
                 setStep(3);
               }} 
               className="bg-amber-600 hover:bg-amber-700 text-white"
             >
               <PlayCircle className="h-4 w-4 mr-2"/> Resume
             </Button>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex justify-between items-center px-8 text-sm font-medium mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
              step >= s ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-400"
            }`}>
              {s}
            </div>
            {s < 4 && <div className={`w-24 h-1 mx-2 rounded ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Credentials */}
      {step === 1 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle>1. Connect Gmail</CardTitle>
            <CardDescription>Enter your Gmail address and App Password. Your credentials are only used to send this specific batch and are not saved anywhere.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Gmail Address</Label>
              <Input id="email" type="email" placeholder="you@gmail.com" value={gmailEmail} onChange={e => setGmailEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">App Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="16-character app password" 
                  value={appPassword} 
                  onChange={e => setAppPassword(e.target.value.replace(/[\s\xa0]/g, ''))} 
                  className="pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">You must use a Google App Password, not your regular login password. <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-blue-500 hover:underline">Get one here</a>.</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!gmailEmail || !appPassword}>Next Step</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Audience */}
      {step === 2 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle>2. Upload Audience</CardTitle>
            <CardDescription>Upload an Excel or CSV file containing your recipients.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
              {loading ? (
                <Loader2 className="h-10 w-10 text-gray-400 animate-spin mb-4" />
              ) : (
                <UploadCloud className="h-10 w-10 text-gray-400 mb-4" />
              )}
              <h3 className="text-sm font-semibold text-gray-900">Click or drag file to upload</h3>
              <p className="text-xs text-gray-500 mt-1">CSV, XLS, or XLSX up to 5MB</p>
            </div>

            {columns.length > 0 && (
              <div className="space-y-4 bg-green-50/50 p-4 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">File loaded successfully</span>
                  <span className="text-sm ml-auto">{totalRows} rows found</span>
                </div>
                
                <div className="space-y-2">
                  <Label>Which column contains the email address?</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={emailColumn}
                    onChange={(e) => setEmailColumn(e.target.value)}
                  >
                    <option value="">Select a column...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                
                <div className="mt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Available Columns (Variables)</Label>
                  <div className="flex flex-wrap gap-2">
                    {columns.map(col => (
                      <span key={col} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">
                        {`{{${col}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={columns.length === 0 || !emailColumn}>Next Step</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Compose Email */}
      {step === 3 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <CardTitle>3. Compose Email</CardTitle>
            <CardDescription>Write your message. Use the variables shown below to personalize each email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {columns.map(col => (
                  <button 
                    key={col} 
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded text-xs font-mono cursor-copy transition-colors"
                    onClick={() => navigator.clipboard.writeText(`{{${col}}}`)}
                  >
                    {`{{${col}}}`}
                  </button>
                ))}
                <span className="text-xs text-gray-500 italic ml-2 mt-1">(Click to copy)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="Hello {{Name}}" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <Textarea 
                id="body" 
                placeholder="Hi {{Name}},&#10;&#10;I noticed you work at {{Company}}. I'd love to chat!"
                rows={10} 
                value={body} 
                onChange={e => setBody(e.target.value)} 
                className="resize-y"
              />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Preview (Next Recipient)</h4>
              {preview.length > 0 && (
                <div className="text-sm text-blue-800 bg-white p-3 rounded border border-blue-100 whitespace-pre-wrap">
                  <div className="font-medium border-b border-blue-100 pb-2 mb-2">
                    Subject: {columns.reduce((s, col) => s.replace(new RegExp(`\\{\\{\\s*${col}\\s*\\}\\}`, 'gi'), preview[0][col]), subject || "Subject")}
                  </div>
                  <div>
                    {columns.reduce((s, col) => s.replace(new RegExp(`\\{\\{\\s*${col}\\s*\\}\\}`, 'gi'), preview[0][col]), body || "Body content...")}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setStep(hasActiveCampaign ? 1 : 2)}>Back</Button>
            <div className="flex items-center gap-4">
              {isSending && (
                <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  Batch {results.length} / {Math.min(500, allRecords.length - sentEmails.size)}
                </div>
              )}
              {isSending ? (
                <Button onClick={() => abortControllerRef.current?.abort()} variant="destructive" className="min-w-[150px]">
                  <PauseCircle className="mr-2 h-4 w-4" /> Pause
                </Button>
              ) : (
                <Button onClick={handleSend} disabled={!subject || !body || isSending} className="min-w-[150px]">
                  <Send className="mr-2 h-4 w-4" /> Start Sending Batch
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && (
        <Card className="animate-in fade-in slide-in-from-bottom-4">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>{sentEmails.size >= totalRows ? "Campaign Complete!" : "Batch Complete!"}</CardTitle>
            <CardDescription>
              {sentEmails.size >= totalRows 
                ? "All emails in your campaign have been sent." 
                : `You've sent ${sentEmails.size} of ${totalRows} total emails. Return tomorrow to send the next batch!`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium border-b pb-2">
                <span>Email</span>
                <span>Status</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {results.map((res, i) => (
                  <div key={i} className="flex justify-between text-sm items-center py-1">
                    <span className="truncate max-w-[250px]">{res.email}</span>
                    <div className="flex items-center gap-2">
                      {res.status === 'success' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Sent</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title={res.error}>Failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">Overall Campaign Progress</span>
                <span className="font-medium text-gray-700">{sentEmails.size} / {totalRows}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (sentEmails.size / totalRows) * 100)}%` }}></div>
              </div>
            </div>
            
          </CardContent>
          <CardFooter className="flex justify-between mt-4">
            {sentEmails.size < totalRows ? (
              <>
                 <Button variant="outline" onClick={() => {
                   setStep(1);
                   setResults([]);
                 }}>Pause for Today</Button>
                 <Button variant="destructive" onClick={() => {
                   clearCampaign();
                   setStep(1);
                 }}>Clear Campaign</Button>
              </>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => {
                clearCampaign();
                setStep(1);
              }}>Start New Campaign</Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
