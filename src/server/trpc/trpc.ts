import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';
import {
  canViewGarments,
  canEditGarments,
  canExportAnyPdf,
  canUploadAssets,
  canArchiveGarment,
  canHardDelete,
  canAccessAuditLog,
} from '~/server/rbac';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not logged in' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireAuth);

const requireViewGarments = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canViewGarments(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot view garments' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireEditGarments = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canEditGarments(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit garments' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireExportPdf = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canExportAnyPdf(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot export PDF' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireUploadAssets = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canUploadAssets(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot upload assets' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireArchive = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canArchiveGarment(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot archive' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireHardDelete = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canHardDelete(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only Creative Director can hard-delete' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAuditAccess = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!canAccessAuditLog(ctx.user.userRoles)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot access audit log' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const garmentViewProcedure = t.procedure.use(requireAuth).use(requireViewGarments);
export const garmentEditProcedure = t.procedure.use(requireAuth).use(requireEditGarments);
export const exportPdfProcedure = t.procedure.use(requireAuth).use(requireExportPdf);
export const uploadAssetProcedure = t.procedure.use(requireAuth).use(requireUploadAssets);
export const archiveProcedure = t.procedure.use(requireAuth).use(requireArchive);
export const hardDeleteProcedure = t.procedure.use(requireAuth).use(requireHardDelete);
export const auditLogProcedure = t.procedure.use(requireAuth).use(requireAuditAccess);
