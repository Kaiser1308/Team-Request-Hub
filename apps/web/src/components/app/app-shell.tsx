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
  FolderOpen,
  Settings,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/logout-button";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { Button } from "@/components/ui/button";
import { UnreadCountBadge } from "@/components/shared/unread-count-badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNotifications, useRouteBadgeCounts, useMarkRouteBadgeRead } from "@/hooks/use-notifications";
import { MOTION_DURATION, MOTION_EASE, MOTION_SCALE } from "@/lib/animation/constants";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";
import { translateRole } from "@/components/requests/translated-labels";

type NavLabelKey =
  | "dashboard"
  | "assigned"
  | "created"
  | "pool"
  | "done"
  | "all"
  | "users"
  | "newRequest"
  | "files"
  | "docs"
  | "notifications"
  | "settings";

interface NavItem {
  href: string;
  labelKey: NavLabelKey;
  roles?: Role[];
  icon: LucideIcon;
  notificationTypes?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/assigned", labelKey: "assigned", icon: UserCheck, notificationTypes: ["assigned", "reassigned"] },
  { href: "/requests", labelKey: "created", icon: FileText },
  { href: "/pool", labelKey: "pool", icon: Inbox, notificationTypes: ["pool_new"] },
  { href: "/done", labelKey: "done", icon: CheckCircle2 },
  { href: "/all", labelKey: "all", roles: ["lead"], icon: Database },
  { href: "/files", labelKey: "files", icon: FolderOpen },
  { href: "/docs", labelKey: "docs", icon: BookOpen },
  { href: "/admin/users", labelKey: "users", roles: ["lead"], icon: Users },
  { href: "/requests/new", labelKey: "newRequest", icon: PlusCircle },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

function canSeeNavItem(item: NavItem, role?: Role) {
  return !item.roles || (role ? item.roles.includes(role) : false);
}

function isActivePath(pathname: string, href: string) {
  if (pathname.startsWith("/requests/new")) {
    return href === "/requests/new";
  }

  if (pathname.startsWith("/requests/")) {
    return href === "/requests";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(
  pathname: string,
  tNav: (key: string) => string,
  tCommon: (key: string) => string,
) {
  if (pathname.startsWith("/requests/new")) {
    return tNav("newRequest");
  }

  if (pathname.startsWith("/requests/")) {
    return tNav("requestDetail");
  }

  const titleByKey: Record<string, NavLabelKey> = {
    "/dashboard": "dashboard",
    "/assigned": "assigned",
    "/requests": "created",
    "/pool": "pool",
    "/done": "done",
    "/all": "all",
    "/files": "files",
    "/docs": "docs",
    "/admin/users": "users",
    "/notifications": "notifications",
    "/settings": "settings",
  };

  const key = titleByKey[pathname];
  return key ? tNav(key) : tCommon("appName");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: currentUser, isLoading, isError, error } = useCurrentUser();
  const notificationsQuery = useNotifications(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const unreadRef = useRef<HTMLSpanElement | null>(null);
  const unreadCount = notificationsQuery.data?.length ?? 0;

  const badgeCounts = useRouteBadgeCounts();
  const markBadgeRead = useMarkRouteBadgeRead();

  const badgeForItem = (item: NavItem): number => {
    if (!item.notificationTypes) return 0;
    if (item.notificationTypes.includes("assigned")) return badgeCounts.data?.assigned ?? 0;
    if (item.notificationTypes.includes("pool_new")) return badgeCounts.data?.pool ?? 0;
    return 0;
  };

  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const tShell = useTranslations("appShell");

  const pageTitle = useMemo(
    () => getPageTitle(pathname, tNav, tCommon),
    [pathname, tNav, tCommon],
  );
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb]">
        <p className="text-sm text-[#6b7280]">{tCommon("loading")}</p>
      </div>
    );
  }

  if (isError || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
        <div className="grid max-w-lg gap-4 app-surface rounded-lg p-8 text-center">
          <h1 className="text-2xl font-semibold">{tShell("unableToLoadUser")}</h1>
          <p className="text-body text-[#4b5563]">
            {error instanceof Error ? error.message : tShell("unableToLoadUser")}
          </p>
          <LogoutButton />
        </div>
      </div>
    );
  }

  if (currentUser?.is_active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
        <div className="grid max-w-lg gap-4 app-surface rounded-lg p-8 text-center">
          <h1 className="text-2xl font-semibold">{tShell("waitingApprovalTitle")}</h1>
          <p className="text-body text-[#4b5563]">{tShell("waitingApprovalDescription")}</p>
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
          aria-label={tShell("closeNavigation")}
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-[#111827]/30 lg:hidden"
        />
      ) : null}

      <aside
        id="app-shell-navigation"
        aria-label={tShell("primaryNavigation")}
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[min(82vw,240px)] px-3 py-4 text-white transition-transform lg:w-[240px] lg:translate-x-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2 px-2 lg:mb-6 lg:justify-start">
          <Link href="/dashboard" className="text-sm font-semibold text-white" onClick={() => setIsMobileNavOpen(false)}>
            {tCommon("appName")}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={tShell("closeNavigation")}
            onClick={() => setIsMobileNavOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1" aria-label={tShell("mainNavigation")}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const badge = badgeForItem(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.href === "/docs" ? "_blank" : undefined}
                rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
                onClick={() => {
                  setIsMobileNavOpen(false);
                  if (item.notificationTypes && item.notificationTypes.length > 0) {
                    markBadgeRead.mutate(item.notificationTypes);
                  }
                }}
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
                <span className="flex-1">{tNav(item.labelKey)}</span>
                <UnreadCountBadge count={badge} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-[240px]">
        <header className="sticky top-[-1px] z-20 flex min-h-14 items-center border-b border-white/10 border-t-0 bg-gradient-to-r from-[#030303] via-[#111827] to-[#1e293b] px-3 py-2 outline-none sm:min-h-16 sm:px-6">

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-300 hover:bg-white/10 hover:text-white"
              aria-expanded={isMobileNavOpen}
              aria-controls="app-shell-navigation"
              aria-label={tShell("openNavigation")}
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="hidden text-sm font-semibold text-slate-100 sm:block">{pageTitle}</p>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-3">
            <Link
              href="/notifications"
              aria-label={tShell("openNotifications")}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 text-xs text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-white"
            >
              <Bell className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
              <span ref={unreadRef}>
                <UnreadCountBadge count={unreadCount} showZero />
              </span>
            </Link>
            <LanguageSwitcher />
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate text-sm font-semibold text-slate-100">
                {isLoading
                  ? tCommon("loadingUser")
                  : currentUser?.name ?? currentUser?.email ?? tCommon("user")}
              </p>
              {currentUser?.email && currentUser?.name ? (
                <p className="max-w-[220px] truncate text-xs text-slate-400">{currentUser.email}</p>
              ) : null}
            </div>
            {currentUser?.role ? (
              <span className="hidden max-w-[88px] truncate rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-200 min-[390px]:inline-block sm:max-w-none">
                {tShell("roleLabel", { role: translateRole(currentUser.role) })}
                {currentUser.role === "lead" ? ` — ${tShell("leadAccessEnabled")}` : ""}
              </span>
            ) : (
              <span className="hidden max-w-[88px] truncate rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-200 min-[390px]:inline-block sm:max-w-none">
                {tShell("rolePending")}
              </span>
            )}
            <LogoutButton className="h-9 shrink-0 border-slate-700 px-2 text-xs text-slate-200 hover:bg-slate-800/80 hover:text-white sm:px-3" />
          </div>
        </header>

        <main className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
          {isError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(error as Error) instanceof Error
                ? (error as Error).message
                : tShell("unableToLoadUser")}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
