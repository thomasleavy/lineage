'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '~/trpc/client';
import { getCsrfToken } from '~/lib/csrf';

export default function TabletPage() {
  const searchParams = useSearchParams();
  const garmentFromUrl = searchParams.get('garment') ?? '';
  const [garmentId, setGarmentId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [notes, setNotes] = useState('');
  const [weaveType, setWeaveType] = useState('');
  const [tone, setTone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lastUploadedGarmentId, setLastUploadedGarmentId] = useState<string | null>(null);

  const { data: garments } = trpc.garments.list.useQuery({ limit: 100 });
  const { data: garment } = trpc.garments.getById.useQuery(
    { id: garmentId },
    { enabled: !!garmentId }
  );

  // Pre-select garment when opened from item page (e.g. /tablet?garment=id)
  useEffect(() => {
    if (garmentFromUrl && !garmentId) {
      setGarmentId(garmentFromUrl);
    }
  }, [garmentFromUrl, garmentId]);

  // Default to current version when a garment is selected so uploads show in "Current version" on the item page
  useEffect(() => {
    if (!garment) return;
    if (garment.currentVersionId) {
      setVersionId(garment.currentVersionId);
    } else {
      setVersionId('');
    }
  }, [garment, garment?.id, garment?.currentVersionId]);

  const createUploadUrl = trpc.assets.createUploadUrl.useMutation();
  const confirmUpload = trpc.assets.confirmUpload.useMutation();
  const saveTabletNote = trpc.garments.saveTabletNote.useMutation();
  const utils = trpc.useUtils();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPendingFile(file ?? null);
    e.target.value = '';
  };

  const handleSaveNote = async () => {
    if (!garmentId) return;
    const hasNote = !!(weaveType?.trim() || tone?.trim() || notes?.trim());
    if (!hasNote && !pendingFile) return;
    const targetVersionId = versionId === ITEM_ONLY ? undefined : (versionId || garment?.currentVersionId || undefined);
    setUploading(true);
    try {
      if (hasNote) {
        await saveTabletNote.mutateAsync({
          garmentId,
          garmentVersionId: targetVersionId ?? null,
          weaveType: weaveType?.trim() || null,
          tone: tone?.trim() || null,
          notes: notes?.trim() || null,
        });
      }
      if (pendingFile) {
        const created = await createUploadUrl.mutateAsync({
          garmentId,
          garmentVersionId: targetVersionId,
          type: 'scan',
          filename: pendingFile.name,
          contentType: pendingFile.type,
          sizeBytes: pendingFile.size,
        });
        const formData = new FormData();
        formData.append('file', pendingFile);
        formData.append('assetId', created.assetId);
        const csrf = getCsrfToken();
        const headers: Record<string, string> = {};
        if (csrf) headers['X-CSRF-Token'] = csrf;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = (await res.json()) as { assetId?: string };
        if (data.assetId) {
          await confirmUpload.mutateAsync({
            assetId: data.assetId,
            notes: notes?.trim() || undefined,
            weaveType: weaveType?.trim() || undefined,
            tone: tone?.trim() || undefined,
          });
        }
        setPendingFile(null);
      }
      setNotes('');
      setWeaveType('');
      setTone('');
      setLastUploadedGarmentId(garmentId);
      if (garmentId) void utils.garments.getById.invalidate({ id: garmentId });
      if (garmentId) void utils.garments.listTabletNotes.invalidate({ garmentId });
    } finally {
      setUploading(false);
    }
  };

  const ITEM_ONLY = '__item_only__';
  const effectiveVersionId = versionId === ITEM_ONLY ? '' : (versionId || garment?.currentVersionId || '');
  const isAttachingToCurrentVersion = !!garment?.currentVersionId && effectiveVersionId === garment.currentVersionId;

  const pendingPreviewUrl = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : null), [pendingFile]);
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  return (
    <div className="min-h-screen">
      <Link href="/dashboard" className="block py-2 text-sm text-zinc-500 hover:text-zinc-300">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">Tablet mode</h1>
      <p className="mt-1 text-zinc-400">
        Quick capture in the studio: upload scans/photos and notes. They attach to the selected item and version, and appear in the item&apos;s Pictures and in the current version on the item page.
      </p>

      {lastUploadedGarmentId && (
        <div className="mt-4 rounded border border-amber-800/50 bg-amber-900/20 px-4 py-3 text-sm">
          <span className="text-amber-200">Saved.</span>{' '}
          <Link
            href={`/garments/${lastUploadedGarmentId}`}
            className="font-medium text-amber-400 hover:text-amber-300 underline"
          >
            View this item →
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium">Select item</h2>
          <select
            value={garmentId}
            onChange={(e) => { setGarmentId(e.target.value); setVersionId(''); setLastUploadedGarmentId(null); }}
            className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-lg"
            suppressHydrationWarning
          >
            <option value="">— Select garment —</option>
            {garments?.items.map((g) => (
              <option key={g.id} value={g.id}>{g.houseCode}</option>
            ))}
          </select>
          {garmentId && (
            <Link
              href={`/garments/${garmentId}`}
              className="mt-2 inline-block text-sm text-amber-500 hover:text-amber-400"
            >
              View this item on full page →
            </Link>
          )}
          {garment?.versions?.length ? (
            <div className="mt-3">
              <label className="block text-sm font-medium text-zinc-400">Attach to version</label>
              <select
                value={versionId === ITEM_ONLY ? ITEM_ONLY : effectiveVersionId}
                onChange={(e) => setVersionId(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-lg"
                suppressHydrationWarning
              >
                <option value={ITEM_ONLY}>— Item only (no version) —</option>
                {garment.currentVersionId && (
                  <option value={garment.currentVersionId}>
                    Current (v{garment.currentVersion?.versionNumber}) · {garment.currentVersion?.changeSummary}
                  </option>
                )}
                {garment.versions
                  .filter((v) => v.id !== garment.currentVersionId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>v{v.versionNumber} · {v.changeSummary}</option>
                  ))}
              </select>
              {isAttachingToCurrentVersion && (
                <p className="mt-1 text-xs text-zinc-500">
                  Uploads will appear in &quot;Current version&quot; and Pictures on the item page.
                </p>
              )}
            </div>
          ) : garment ? (
            <p className="mt-2 text-sm text-zinc-500">No versions yet; upload will attach to item.</p>
          ) : null}
        </section>

        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium">Quick notes</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Weave, tone and notes. Select an image below if you want to attach one. Nothing is saved or uploaded until you click &quot;Save note&quot;.
          </p>
          <input
            type="text"
            placeholder="Weave type"
            value={weaveType}
            onChange={(e) => setWeaveType(e.target.value)}
            className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-lg"
            suppressHydrationWarning
          />
          <input
            type="text"
            placeholder="Tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-lg"
            suppressHydrationWarning
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-3 text-lg"
            rows={3}
            suppressHydrationWarning
          />
          <button
            type="button"
            disabled={
              uploading ||
              !garmentId ||
              (!weaveType?.trim() && !tone?.trim() && !notes?.trim() && !pendingFile)
            }
            onClick={handleSaveNote}
            className="mt-3 w-full rounded bg-amber-600 px-4 py-3 text-lg font-medium text-black hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Saving…' : 'Save note' + (pendingFile ? ' & upload image' : '')}
          </button>
          {saveTabletNote.isError && (
            <p className="mt-2 text-sm text-red-400">{saveTabletNote.error?.message}</p>
          )}
        </section>
      </div>

      <section className="mt-8 rounded border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-medium">Image (optional)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Select an image to attach; it will upload when you click &quot;Save note&quot; above.
        </p>
        {pendingPreviewUrl ? (
          <div className="mt-4 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL for local preview */}
            <img
              src={pendingPreviewUrl}
              alt="Preview"
              className="max-h-64 w-auto max-w-full rounded border border-zinc-700 object-contain"
            />
            <p className="mt-2 text-sm text-zinc-400">{pendingFile?.name} · will upload on Save note</p>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="mt-2 text-sm text-amber-500 hover:text-amber-400"
            >
              Remove image
            </button>
          </div>
        ) : (
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-600 py-12 hover:border-amber-500">
            <span className="text-xl font-medium text-amber-500">Choose image</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={!garmentId}
              suppressHydrationWarning
            />
          </label>
        )}
      </section>
    </div>
  );
}
