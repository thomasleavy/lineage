import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '~/server/trpc/routers';
import { createContext } from '~/server/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req, resHeaders: new Headers() } as Parameters<typeof createContext>[0]),
  });

export { handler as GET, handler as POST };
