import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <section className="mx-auto grid min-h-screen max-w-5xl content-center gap-8 px-4 py-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">Team Request Hub</h1>
          <p className="mt-4 text-base leading-7 text-[#4b5563]">
            Internal requests, ownership, status updates, and approvals in one focused workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login?mode=register">Register</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
