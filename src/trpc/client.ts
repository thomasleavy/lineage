'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '~/server/trpc/routers';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
};

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
        transformer: superjson,
      }),
    ],
  });
}
