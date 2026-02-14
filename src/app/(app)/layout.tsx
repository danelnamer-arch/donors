import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      <Sidebar />
      {/* Main content area — offset by sidebar width on desktop, offset by mobile topbar on mobile */}
      <main className="flex-1 overflow-y-auto pt-14 md:ml-60 md:pt-0">
        {children}
      </main>
    </div>
  );
}
