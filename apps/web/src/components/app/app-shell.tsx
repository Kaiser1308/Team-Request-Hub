"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assigned", label: "Assigned to me", roles: ["be", "lead"] },
  { href: "/requests", label: "Created by me" },
  { href: "/pool", label: "Pool", roles: ["be", "lead"] },
  { href: "/done", label: "Done" },
  { href: "/all", label: "All requests", roles: ["lead"] },
  { href: "/admin/users", label: "Users", roles: ["lead"] },
];

function canSeeNavItem(item: NavItem, role?: Role) {
  return !item.roles || (role ? item.roles.includes(role) : false);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: currentUser, isLoading, isError, error } = useCurrentUser();
  const visibleNavItems = navItems.filter((item) =>
    canSeeNavItem(item, currentUser?.role),
  );

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="font-semibold">
            Team Request Hub
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {isLoading
                  ? "Loading user"
                  : currentUser?.name ?? currentUser?.email ?? "User"}
              </p>
              <p className="text-xs text-[#6b7280]">
                {currentUser?.role ? `Role: ${currentUser.role}` : "Session"}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white p-2 lg:flex-col lg:overflow-visible">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm text-[#4b5563]",
                  isActivePath(pathname, item.href) &&
                    "bg-[#f3f4f6] font-medium text-[#111827]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild className="mt-0 lg:mt-2">
              <Link href="/requests/new">New request</Link>
            </Button>
          </nav>
        </aside>

        <section className="min-w-0">
          {isError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : "Unable to load the current user."}
            </div>
          ) : null}
          {children}
        </section>
      </div>
    </div>
  );
}
