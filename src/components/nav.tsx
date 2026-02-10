"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Discover" },
  { href: "/pipeline", label: "Pipeline" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-lg font-bold text-black dark:text-white">
            DonorMatch
          </a>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-zinc-100 text-black dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session?.user?.name && (
            <span className="text-sm text-zinc-500">{session.user.name}</span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
