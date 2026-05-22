"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { animate } from "animejs";
import {
  Bell,
  Menu,
  X,
  LayoutDashboard,
  UserCheck,
  FileText,
  Inbox,
  CheckCircle2,
  Database,
  Users,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNotifications } from "@/hooks/use-notifications";
import { MOTION_DURATION, MOTION_EASE, MOTION_SCALE } from "@/lib/animation/constants";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assigned", label: "Assigned to me", icon: UserCheck },
  { href: "/requests", label: "Created by me", icon: FileText },
  { href: "/pool", label: "Pool", icon: Inbox },
  { href: "/done", label: "Done", icon: CheckCircle2 },
  { href: "/all", label: "All requests", roles: ["lead"], icon: Database },
  { href: "/admin/users", label: "Users", roles: ["lead"], icon: Users },
  { href: "/requests/new", label: "New request", icon: PlusCircle },
];

function canSeeNavItem(item: NavItem, role?: Role) {
  return !item.roles || (role ? item.roles.includes(role) : false);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/requests/new")) {
    return "New request";
  }

  if (pathname.startsWith("/requests/")) {
    return "Request detail";
  }

  const titleByPath: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/assigned": "Assigned to me",
    "/requests": "Created by me",
    "/pool": "Pool",
    "/done": "Done",
    "/all": "All requests",
    "/admin/users": "Users",
  };

  return titleByPath[pathname] ?? "Team Request Hub";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: currentUser, isLoading, isError, error } = useCurrentUser();
  const notificationsQuery = useNotifications(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const unreadRef = useRef<HTMLSpanElement | null>(null);
  const unreadCount = notificationsQuery.data?.length ?? 0;
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);
  const visibleNavItems = navItems.filter((item) =>
    canSeeNavItem(item, currentUser?.role),
  );

  useEffect(() => {
    const target = unreadRef.current;
    if (!target || unreadCount <= 0) {
      return;
    }

    const animation = animate(target, {
      scale: MOTION_SCALE.subtle,
      duration: MOTION_DURATION.medium,
      ease: MOTION_EASE.emphasis,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [unreadCount]);

  if (currentUser?.is_active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
        <div className="grid max-w-lg gap-4 rounded-lg border border-[#e5e7eb] bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold">Waiting for lead approval</h1>
          <p className="text-sm text-[#4b5563]">A lead must approve your account before you can access requests.</p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      {isMobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-[#111827]/30 lg:hidden"
        />
      ) : null}

      <aside
        id="app-shell-navigation"
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[240px] px-3 py-4 text-white transition-transform lg:translate-x-0 border-r-0 border-none",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2 px-2 lg:mb-6 lg:justify-start">
          <Link href="/dashboard" className="text-sm font-semibold text-white" onClick={() => setIsMobileNavOpen(false)}>
            Team Request Hub
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setIsMobileNavOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileNavOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#d1d5db] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40",
                  isActivePath(pathname, item.href) &&
                    "bg-[#1f2937] font-medium text-white",
                )}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#9ca3af] transition-colors group-hover:text-white",
                    isActivePath(pathname, item.href) && "text-white",
                  )}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[240px]">
        <header className="sticky top-[-1px] z-20 flex h-14 items-center border-b border-[#1e293b]/80 border-t-0 bg-gradient-to-r from-[#080b12] via-[#091530] to-[#1e3a8a] outline-none px-4 sm:h-16 sm:px-6">

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-300 hover:bg-white/10 hover:text-white"
              aria-expanded={isMobileNavOpen}
              aria-controls="app-shell-navigation"
              aria-label="Open navigation"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="hidden text-sm font-semibold text-slate-100 sm:block">{pageTitle}</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              aria-label="Open notifications"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-white"
            >
              <Bell className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              <span ref={unreadRef}>{unreadCount}</span>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate text-sm font-semibold text-slate-100">
                {isLoading
                  ? "Loading user"
                  : currentUser?.name ?? currentUser?.email ?? "User"}
              </p>
              {currentUser?.email && currentUser?.name ? (
                <p className="max-w-[220px] truncate text-xs text-slate-400">{currentUser.email}</p>
              ) : null}
            </div>
            {currentUser?.role ? (
              <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">
                {currentUser.role}
              </span>
            ) : null}
            <LogoutButton className="border-slate-700 text-slate-200 hover:bg-slate-800/80 hover:text-white" />
          </div>
        </header>

        <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
          {isError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : "Unable to load the current user."}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
