import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Users, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/stats", { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  } catch (error) {
    console.error(error);
    return {
      total_campaigns: 0,
      total_recipients: 0,
      delivery_rate: 0,
      total_failed: 0,
      recent_campaigns: []
    };
  }
}

export default async function Dashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your MailForge campaigns and metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_campaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_recipients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delivery_rate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounces/Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_failed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>
              Your latest campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent campaigns.</p>
              ) : (
                stats.recent_campaigns.map((campaign: any) => (
                  <div key={campaign.id} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Sent to {campaign.recipient_count} recipients
                      </p>
                    </div>
                    <div className="ml-auto font-medium capitalize">
                      {campaign.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Start sending emails quickly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full justify-start text-left bg-secondary p-3 rounded-md hover:bg-secondary/80 transition-colors">
              <span className="font-semibold block">New Campaign</span>
              <span className="text-sm text-muted-foreground">Create and schedule a new blast.</span>
            </button>
            <button className="w-full justify-start text-left bg-secondary p-3 rounded-md hover:bg-secondary/80 transition-colors">
              <span className="font-semibold block">Upload Recipients</span>
              <span className="text-sm text-muted-foreground">Import a new CSV or Excel list.</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
