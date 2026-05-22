import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { PageSkeleton } from "@/components/app/page-skeleton";
import { PageTransition } from "@/components/app/page-transition";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <PageTransition>{children}</PageTransition>
      </Suspense>
    </AppShell>
  );
}
