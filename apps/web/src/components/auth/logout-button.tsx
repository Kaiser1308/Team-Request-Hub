"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("auth");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1"
      onClick={() => void handleLogout()}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      {t("signOut")}
    </Button>
  );
}
