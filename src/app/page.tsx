'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${basePath}/login`);
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-zinc-400">Redirecting to sign in…</p>
    </main>
  );
}
