import { WelcomeScreen } from '@/components/auth/welcome-screen';

function safeNext(next: string | undefined) {
  if (!next) {
    return '/dashboard';
  }

  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard';
  }

  return next;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return <WelcomeScreen nextPath={safeNext(params.next)} />;
}
