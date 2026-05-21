import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4 py-8">
      <div className="grid w-full max-w-[460px] gap-5 rounded-lg border border-[#e5e7eb] bg-white p-6 shadow-[rgba(17,24,39,0.08)_0_6px_20px_0] sm:p-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#111827]">Team Request Hub</h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Internal request workflow for FE, BE, and lead teams.
          </p>
        </div>
        <div className="grid gap-3 border-t border-[#e5e7eb] pt-4">
          <p className="text-center text-sm text-[#6b7280]">Sign in with your company Google account.</p>
          <GoogleLoginButton />
        </div>
      </div>
    </main>
  );
}
