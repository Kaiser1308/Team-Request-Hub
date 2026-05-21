import { AuthForm } from "@/components/auth/auth-form";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="grid w-full max-w-[560px] gap-6 rounded-lg bg-white p-8 shadow-[rgba(0,0,0,0.14)_0_8px_28px_0]">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#111827]">Team Request Hub</h1>
          <p className="mt-2 text-sm text-[#6b7280]">Login or register for lead approval.</p>
        </div>
        <AuthForm />
        <div className="grid gap-3 border-t border-[#e5e7eb] pt-4">
          <GoogleLoginButton />
        </div>
      </div>
    </main>
  );
}
