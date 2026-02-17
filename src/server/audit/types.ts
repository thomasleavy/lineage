export const AUDIT_ACTION_TYPES = [
  'VIEW_GARMENT',
  'CREATE_GARMENT',
  'CREATE_VERSION',
  'EDIT_GARMENT',
  'ARCHIVE_GARMENT',
  'HARD_DELETE_GARMENT',
  'ROLLBACK',
  'EXPORT_PDF_RUN_OF_SHOW',
  'EXPORT_PDF_PRESS',
  'EXPORT_GARMENT_VERSION_HISTORY_PDF',
  'UPLOAD_ASSET',
  'DELETE_ASSET',
  'CREATE_LOOK',
  'UPDATE_LOOK',
  'DELETE_LOOK',
  'SAVE_TABLET_NOTE',
  'LOGIN',
  'LOGOUT',
] as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export const AUDIT_ENTITY_TYPES = ['GARMENT', 'VERSION', 'LOOK', 'ASSET', 'USER', 'GARMENT_NOTE'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditEntryInput {
  actorId: string | null;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  traceId?: string | null;
}
