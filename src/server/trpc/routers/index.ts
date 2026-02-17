import { router } from '../trpc';
import { authRouter } from './auth';
import { garmentsRouter } from './garments';
import { searchRouter } from './search';
import { looksRouter } from './looks';
import { assetsRouter } from './assets';
import { auditRouter } from './audit';
import { adminRouter } from './admin';
import { exportPdfRouter } from './exportPdf';

export const appRouter = router({
  auth: authRouter,
  garments: garmentsRouter,
  search: searchRouter,
  looks: looksRouter,
  assets: assetsRouter,
  audit: auditRouter,
  admin: adminRouter,
  exportPdf: exportPdfRouter,
});

export type AppRouter = typeof appRouter;
