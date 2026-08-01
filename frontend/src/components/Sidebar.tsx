import Link from "next/link";
import { LayoutDashboard, Users, FileText, Settings, Send } from "lucide-react";

export function Sidebar() {
  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card text-card-foreground">
      <div className="p-6">
        <h2 className="text-2xl font-bold tracking-tight">MailForge</h2>
      </div>
      <nav className="flex-1 space-y-2 p-4">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link href="/campaigns" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <Send className="h-4 w-4" />
          Campaigns
        </Link>
        <Link href="/recipients" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <Users className="h-4 w-4" />
          Recipients
        </Link>
        <Link href="/templates" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <FileText className="h-4 w-4" />
          Templates
        </Link>
        <Link href="/providers" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
          <Settings className="h-4 w-4" />
          Providers
        </Link>
      </nav>
    </div>
  );
}
