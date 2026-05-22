"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  function handleLogout() {
    router.replace("/auth/goodbye");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1", className)}
      onClick={handleLogout}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      Sign out
    </Button>
  );
}
