"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="px-4 py-2 border border-[#cfc4c5]/50 text-[#86868b] rounded-xl text-sm font-semibold hover:bg-[#f3f3f3] transition-colors"
      onClick={handleLogout}
    >
      Sign out
    </button>
  );
}
