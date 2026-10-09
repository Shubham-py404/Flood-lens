import type { Metadata } from "next";
import "./globals.css";
import { Map as MapIcon, Activity, ShieldAlert, Settings, CloudRain, Bell, UserCircle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FloodLens | AI Flood Intelligence",
  description: "Real-time flood monitoring and citizen intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
        
        {/* SIDEBAR - Dark Command Center Theme */}
        <aside className="w-64 bg-slate-900 flex flex-col border-r border-slate-800 shrink-0 z-20">
          <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
            <CloudRain className="w-6 h-6 text-blue-400 mr-3" />
            <span className="text-lg font-bold text-white tracking-wide">FloodLens</span>
          </div>
          
          <nav className="flex-1 py-6 px-4 space-y-2">
            <Link href="/" className="flex items-center px-4 py-3 bg-blue-600/20 text-blue-400 rounded-lg font-medium transition-colors border border-blue-500/20">
              <MapIcon className="w-5 h-5 mr-3" />
              Live Map
            </Link>
            <Link href="#" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors">
              <Activity className="w-5 h-5 mr-3" />
              Citizen Reports
            </Link>
            <Link href="/admin" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors">
              <ShieldAlert className="w-5 h-5 mr-3" />
              Admin Dashboard
            </Link>
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg font-medium transition-colors cursor-pointer">
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* TOP HEADER */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
            <div className="flex items-center">
              <div className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                SYSTEM ACTIVE
              </div>
              <span className="ml-4 text-sm font-medium text-slate-500 hidden md:block">
                Monitoring Region: Delhi NCR
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
              <div className="h-8 w-px bg-slate-200"></div>
              <button className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors">
                <UserCircle className="w-8 h-8 text-slate-400" />
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-bold leading-none">Dispatcher 01</div>
                  <div className="text-xs text-slate-500 mt-1">Command Center</div>
                </div>
              </button>
            </div>
          </header>

          {/* DYNAMIC PAGE CONTENT (Where MapView lives) */}
          <main className="flex-1 relative overflow-hidden bg-slate-50">
            {children}
          </main>
        </div>
        
      </body>
    </html>
  );
}