import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-[560px] bg-white rounded-xl shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-12 md:p-16 flex flex-col items-center text-center">
        <div className="mb-10">
          <div className="w-16 h-16 bg-black text-white rounded-xl flex items-center justify-center mb-8 mx-auto shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px]">
            <span className="text-[32px] font-light">⬡</span>
          </div>
          <h1 className="text-[32px] md:text-[56px] font-semibold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
            Team Request Hub
          </h1>
          <p className="text-base text-[#86868b] max-w-sm mx-auto leading-relaxed">
            Internal request workflow for team coordination
          </p>
        </div>
        <div className="w-full space-y-6">
          <GoogleLoginButton />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-[#cfc4c5]/30" />
            <span className="text-xs text-[#86868b] uppercase tracking-widest">
              Enterprise SSO
            </span>
            <div className="h-px flex-1 bg-[#cfc4c5]/30" />
          </div>
        </div>
      </div>
      <footer className="absolute bottom-8">
        <p className="text-sm text-[#86868b]">
          © 2026 Team Request Hub. All systems operational.
        </p>
      </footer>
    </main>
  );
}
