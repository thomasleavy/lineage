import { z } from 'zod';
import { router, exportPdfProcedure } from '../trpc';
import { canExportPressPdf, canExportRunOfShowPdf } from '~/server/rbac';

export const exportPdfRouter = router({
  /** Returns the URL to call for PDF download (POST with lookId + type). Rate limit and auth are enforced on the API route. */
  getExportUrl: exportPdfProcedure
    .input(
      z.object({
        lookId: z.string().uuid(),
        type: z.enum(['run_of_show', 'press']),
      })
    )
    .query(({ ctx, input }) => {
      if (input.type === 'press' && !canExportPressPdf(ctx.user.userRoles)) {
        return { url: null, error: 'Cannot export press PDF' };
      }
      if (input.type === 'run_of_show' && !canExportRunOfShowPdf(ctx.user.userRoles)) {
        return { url: null, error: 'Cannot export run-of-show PDF' };
      }
      const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
      return {
        url: `${base}/api/export/pdf`,
        method: 'POST' as const,
        body: { lookId: input.lookId, type: input.type },
      };
    }),
});
