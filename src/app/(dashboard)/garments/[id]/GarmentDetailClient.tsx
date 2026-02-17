'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '~/trpc/client';
import { useState, useRef } from 'react';
import { getCsrfToken } from '~/lib/csrf';

const MAX_IMAGES = 5;

export default function GarmentDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: garment, isLoading } = trpc.garments.getById.useQuery({ id });
  const { data: assets } = trpc.assets.listByGarment.useQuery({ garmentId: id }, { enabled: !!id });
  const { data: tabletNotes } = trpc.garments.listTabletNotes.useQuery({ garmentId: id }, { enabled: !!id });
  const { data: looksContaining } = trpc.looks.listContainingGarment.useQuery({ garmentId: id }, { enabled: !!id });
  const { data: allLooks } = trpc.looks.list.useQuery(undefined, { enabled: !!id });
  const [addToLookOpen, setAddToLookOpen] = useState(false);
  const addToLook = trpc.looks.addItem.useMutation({
    onSuccess: () => {
      setAddToLookOpen(false);
      void utils.looks.listContainingGarment.invalidate({ garmentId: id });
      void utils.looks.list.invalidate();
    },
  });
  const [versionA, setVersionA] = useState<string | null>(null);
  const [versionB, setVersionB] = useState<string | null>(null);
  const { data: compare } = trpc.garments.compareVersions.useQuery(
    { versionA: versionA!, versionB: versionB! },
    { enabled: !!versionA && !!versionB && versionA !== versionB }
  );
  const createVersion = trpc.garments.createVersion.useMutation();
  const createUploadUrl = trpc.assets.createUploadUrl.useMutation();
  const confirmUpload = trpc.assets.confirmUpload.useMutation();
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const canArchive = (me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEAD_DESIGNER')) ?? false;
  const canDelete = me?.roles?.includes('CREATIVE_DIRECTOR') ?? false;
  const archive = trpc.garments.archive.useMutation({
    onSuccess: () => {
      void utils.garments.list.invalidate();
      router.push('/garments?archived=1');
    },
  });
  const unarchive = trpc.garments.unarchive.useMutation({
    onSuccess: () => {
      void utils.garments.list.invalidate();
      router.push('/garments?restored=1');
    },
  });
  const hardDelete = trpc.garments.hardDelete.useMutation({
    onSuccess: () => router.push('/garments'),
  });
  const rollback = trpc.garments.rollback.useMutation({
    onSuccess: () => router.refresh(),
  });
  const looksContainingIds = new Set((looksContaining ?? []).map((l) => l.id));
  const looksAvailableToAdd = (allLooks ?? []).filter((l) => !looksContainingIds.has(l.id));

  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [versionStatus, setVersionStatus] = useState<'concept' | 'toile' | 'sample' | 'final' | 'archived'>('concept');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [versionSubmitting, setVersionSubmitting] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type VersionForModal = NonNullable<typeof garment>['versions'][number];
  type AssetForModal = NonNullable<typeof assets>[number];
  const [detailModal, setDetailModal] = useState<{
    version: VersionForModal | null;
    assets: AssetForModal[];
    selectedIndex: number;
    imageZoom: number;
  } | null>(null);

  const openDetailFromAsset = (asset: AssetForModal) => {
    const version = garment?.versions?.find((v) => v.id === asset.garmentVersionId) ?? null;
    setDetailModal({
      version,
      assets: [asset],
      selectedIndex: 0,
      imageZoom: 1,
    });
  };

  const openVersionModal = () => {
    setVersionStatus(garment?.status ?? 'concept');
    setVersionModalOpen(true);
  };

  const openDetailFromVersion = (version: VersionForModal) => {
    const assetsForVersion = (assets ?? []).filter((a) => a.garmentVersionId === version.id);
    setDetailModal({
      version,
      assets: assetsForVersion,
      selectedIndex: 0,
      imageZoom: 1,
    });
  };

  if (isLoading || !garment) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  const handleCreateVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVersionError(null);
    setVersionSubmitting(true);
    try {
      const version = await createVersion.mutateAsync({
        garmentId: id,
        changeSummary: summary,
        changeDetail: detail || undefined,
        status: versionStatus,
      });
      const filesToUpload = selectedFiles.slice(0, MAX_IMAGES);
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) headers['X-CSRF-Token'] = csrf;
      for (const file of filesToUpload) {
        const created = await createUploadUrl.mutateAsync({
          garmentId: id,
          garmentVersionId: version.id,
          type: 'photo',
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetId', created.assetId);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(data.details ?? data.error ?? 'Upload failed');
        }
        await confirmUpload.mutateAsync({ assetId: created.assetId });
      }
      setVersionModalOpen(false);
      setSummary('');
      setDetail('');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await utils.garments.getById.invalidate({ id });
      await utils.assets.listByGarment.invalidate({ garmentId: id });
      router.refresh();
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setVersionSubmitting(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES));
  };
  const removeFile = (index: number) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      {versionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !versionSubmitting && setVersionModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-medium">Create new version</h2>
              <p className="text-sm text-zinc-500">Add summary, detail, and up to 5 images.</p>
            </div>
            <form onSubmit={handleCreateVersionSubmit} className="p-4 space-y-3">
              {versionError && (
                <p className="rounded bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">{versionError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-400">Summary</label>
                <input
                  type="text"
                  placeholder="Change summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Detail (optional)</label>
                <textarea
                  placeholder="Change detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Status</label>
                <select
                  value={versionStatus}
                  onChange={(e) => setVersionStatus(e.target.value as typeof versionStatus)}
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="concept">Concept</option>
                  <option value="toile">Toile</option>
                  <option value="sample">Sample</option>
                  <option value="final">Final</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400">Images (up to {MAX_IMAGES})</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onFileChange}
                  className="mt-1 block w-full text-sm text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-amber-600 file:px-3 file:py-1.5 file:text-black"
                />
                {selectedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {selectedFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-sm">
                        <span className="truncate text-zinc-300">{f.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-amber-500 hover:text-amber-400">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !versionSubmitting && setVersionModalOpen(false)}
                  disabled={versionSubmitting}
                  className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={versionSubmitting}
                  className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
                >
                  {versionSubmitting ? 'Creating…' : 'Create version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Link href="/garments" className="text-sm text-zinc-500 hover:text-zinc-300">← Items</Link>
          <h1 className="mt-1 text-2xl font-semibold">{garment.houseCode}</h1>
          <p className="text-zinc-400">{garment.collection} · {garment.category} · {garment.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tablet?garment=${id}`}
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Quick capture (Tablet)
          </Link>
          <Link href="/looks" className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800">
            Lookbook
          </Link>
        </div>
      </div>

      {(looksContaining && looksContaining.length > 0) || (looksAvailableToAdd && looksAvailableToAdd.length > 0) ? (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Lookbook</h2>
          {looksContaining && looksContaining.length > 0 && (
            <p className="mt-2 text-sm text-zinc-400">
              In looks:{' '}
              {looksContaining.map((l, i) => (
                <span key={l.id}>
                  {i > 0 ? ' · ' : null}
                  <Link href={`/looks/${l.id}`} className="text-amber-500 hover:underline">
                    {l.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {looksAvailableToAdd && looksAvailableToAdd.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setAddToLookOpen(true)}
                className="rounded border border-amber-600 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-600/10"
              >
                Add to look
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Lookbook</h2>
          <p className="mt-2 text-sm text-zinc-500">Not in any look.</p>
          {allLooks && allLooks.length > 0 && (
            <button
              type="button"
              onClick={() => setAddToLookOpen(true)}
              className="mt-2 rounded border border-amber-600 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-600/10"
            >
              Add to look
            </button>
          )}
        </section>
      )}

      {addToLookOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !addToLook.isPending && setAddToLookOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-lg font-medium">Add to look</h2>
              <p className="text-sm text-zinc-500">Choose a look to add this item to.</p>
            </div>
            <ul className="max-h-60 overflow-y-auto p-2">
              {looksAvailableToAdd?.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addToLook.mutate({
                        lookId: l.id,
                        garmentId: id,
                        orderIndex: l.lookItems?.length ?? 0,
                      });
                    }}
                    disabled={addToLook.isPending}
                    className="w-full rounded border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {l.name} <span className="text-zinc-500">· {l.collection} · {l.type}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-zinc-800 p-2">
              <button
                type="button"
                onClick={() => !addToLook.isPending && setAddToLookOpen(false)}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {assets && assets.length > 0 && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Pictures</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openDetailFromAsset(a)}
                className="flex flex-col rounded border border-zinc-700 overflow-hidden bg-zinc-800/50 text-left hover:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {a.displayUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic S3/presigned URLs
                  <img
                    src={a.displayUrl}
                    alt=""
                    className="h-32 w-40 object-cover pointer-events-none"
                  />
                ) : (
                  <div className="h-32 w-40 flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">No preview</div>
                )}
                {a.sourceCredit && (
                  <div className="px-2 py-1 text-xs text-zinc-500">{a.sourceCredit}</div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {detailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {detailModal.version ? `Version ${detailModal.version.versionNumber}` : 'Picture'}
              </h2>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {detailModal.version && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-zinc-500 font-medium">Summary</span>
                    <p className="text-zinc-200 mt-0.5">{detailModal.version.changeSummary}</p>
                  </div>
                  {detailModal.version.changeDetail && (
                    <div>
                      <span className="text-zinc-500 font-medium">Detail</span>
                      <p className="text-zinc-200 mt-0.5 whitespace-pre-wrap">{detailModal.version.changeDetail}</p>
                    </div>
                  )}
                  <p className="text-zinc-500 text-xs">
                    By {detailModal.version.createdBy?.name ?? 'Unknown'}
                  </p>
                </div>
              )}
              {detailModal.assets.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-zinc-500 font-medium block">Image{detailModal.assets.length > 1 ? 's' : ''}</span>
                  {detailModal.assets.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                      {detailModal.assets.map((a, i) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setDetailModal((m) => m ? { ...m, selectedIndex: i } : null)}
                          className={`rounded border px-2 py-1 text-xs ${
                            detailModal.selectedIndex === i
                              ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                              : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          Image {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="overflow-auto max-h-[50vh] min-h-[200px] rounded border border-zinc-700 bg-zinc-800/50 p-2 flex items-center justify-center">
                      {detailModal.assets[detailModal.selectedIndex]?.displayUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- dynamic URL + zoom transform
                        <img
                          src={detailModal.assets[detailModal.selectedIndex].displayUrl!}
                          alt=""
                          className="max-w-full max-h-[45vh] object-contain transition-transform origin-center"
                          style={{ transform: `scale(${detailModal.imageZoom})` }}
                          draggable={false}
                        />
                      ) : (
                        <span className="text-zinc-500">No preview</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-zinc-500">Zoom</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailModal((m) => m ? { ...m, imageZoom: Math.max(0.5, m.imageZoom - 0.25) } : null)}
                          className="rounded border border-zinc-600 px-2 py-1 text-sm hover:bg-zinc-800"
                        >
                          −
                        </button>
                        <span className="text-xs text-zinc-400 w-8 text-center">{Math.round(detailModal.imageZoom * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => setDetailModal((m) => m ? { ...m, imageZoom: Math.min(3, m.imageZoom + 0.25) } : null)}
                          className="rounded border border-zinc-600 px-2 py-1 text-sm hover:bg-zinc-800"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailModal.version && (
                <p className="text-zinc-500 text-sm">No images for this version.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Current version</h2>
          {garment.currentVersion ? (
            <div className="mt-2 space-y-3 text-sm">
              <div>
                <span className="text-zinc-500 font-medium">Summary</span>
                <p className="text-zinc-300 mt-0.5">{garment.currentVersion.changeSummary ?? '—'}</p>
              </div>
              {garment.currentVersion.changeDetail && (
                <div>
                  <span className="text-zinc-500 font-medium">Detail</span>
                  <p className="text-zinc-300 mt-0.5 whitespace-pre-wrap">{garment.currentVersion.changeDetail}</p>
                </div>
              )}
              {(() => {
                const currentVersionAssets = (assets ?? []).filter(
                  (a) => a.garmentVersionId === garment.currentVersionId
                );
                return currentVersionAssets.length > 0 ? (
                  <div>
                    <span className="text-zinc-500 font-medium">Images</span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {currentVersionAssets.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openDetailFromAsset(a)}
                          className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/50 text-left hover:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        >
                          {a.displayUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- dynamic S3/presigned URLs
                            <img
                              src={a.displayUrl}
                              alt=""
                              className="h-20 w-24 object-cover pointer-events-none"
                            />
                          ) : (
                            <div className="h-20 w-24 flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">No preview</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              <p className="text-xs text-zinc-500">
                Version {garment.currentVersion.versionNumber} · by {garment.currentVersion.createdBy?.name}
                {garment.currentVersionRestoredByRollback && (
                  <span className="block mt-1 text-amber-600/90">Restored by rollback — create a new version to continue.</span>
                )}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No version yet.</p>
          )}
        </section>

        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Create new version</h2>
          <p className="mt-1 text-sm text-zinc-500">Add a new version with summary, detail, and up to 5 images.</p>
          <button
            type="button"
            onClick={() => openVersionModal()}
            className="mt-3 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Create new version
          </button>
        </section>
      </div>

      {tabletNotes && tabletNotes.length > 0 && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Quick note history</h2>
          <p className="mt-1 text-sm text-zinc-500">Notes saved from Tablet for this item.</p>
          <ul className="mt-2 space-y-2">
            {tabletNotes.map((n) => {
              const versionLabel = n.garmentVersionId
                ? garment.versions?.find((v) => v.id === n.garmentVersionId)
                  ? `v${garment.versions.find((v) => v.id === n.garmentVersionId)!.versionNumber}`
                  : null
                : null;
              const summaryParts = [n.weaveType, n.tone].filter(Boolean);
              const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : (n.notes?.slice(0, 50) ?? '—');
              return (
                <li key={n.id} className="rounded border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-zinc-500 shrink-0">
                      {new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-zinc-500 shrink-0">· {n.createdBy.name}</span>
                    {versionLabel != null && (
                      <span className="text-zinc-500 shrink-0">· {versionLabel}</span>
                    )}
                    <span className="text-zinc-300 min-w-0 truncate">{summary}{n.notes && n.notes.length > 50 ? '…' : ''}</span>
                  </div>
                  <details className="mt-1.5">
                    <summary className="text-amber-500 hover:underline cursor-pointer text-xs">Show details</summary>
                    <dl className="mt-1.5 ml-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-zinc-300">
                      {n.weaveType && (
                        <>
                          <dt className="text-zinc-500">Weave</dt>
                          <dd>{n.weaveType}</dd>
                        </>
                      )}
                      {n.tone && (
                        <>
                          <dt className="text-zinc-500">Tone</dt>
                          <dd>{n.tone}</dd>
                        </>
                      )}
                      {n.notes && (
                        <>
                          <dt className="text-zinc-500">Notes</dt>
                          <dd className="whitespace-pre-wrap">{n.notes}</dd>
                        </>
                      )}
                    </dl>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rollbackConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !rollback.isPending && setRollbackConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium">Roll back to previous version?</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Current will be set to the last version created by a user (any “Rollback to v…” steps are skipped). You won’t be able to roll back again until you create a new version.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRollbackConfirmOpen(false)}
                disabled={rollback.isPending}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  rollback.mutate(
                    { garmentId: id },
                    { onSuccess: () => setRollbackConfirmOpen(false) }
                  )
                }
                disabled={rollback.isPending}
                className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
              >
                {rollback.isPending ? 'Rolling back…' : 'Yes, roll back'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Version history</h2>
          <a
            href={`/api/export/garment-version-history/${id}`}
            download
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Export version history as PDF
          </a>
        </div>
        <ul className="mt-2 space-y-2">
          {garment.versions?.map((v) => {
            const isCurrent = garment.currentVersionId === v.id;
            const canRollback =
              isCurrent &&
              !garment.currentVersionRestoredByRollback &&
              garment.currentVersion?.parentVersionId != null;
            const snap = (v as { snapshotJson?: Record<string, unknown> }).snapshotJson;
            const rawStatus = (snap?.status as string) || 'concept';
            const statusDisplay = ['concept', 'toile', 'sample', 'final', 'archived'].includes(rawStatus)
              ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)
              : rawStatus;
            return (
              <li key={v.id} className="flex items-center gap-2 text-sm flex-wrap">
                <button
                  type="button"
                  onClick={() => openDetailFromVersion(v)}
                  className="text-left hover:bg-zinc-800/50 hover:underline rounded px-1 -mx-1 py-0.5 flex items-center gap-2 min-w-0"
                >
                  <span className="text-zinc-500 shrink-0">v{v.versionNumber}</span>
                  <span className="shrink-0 rounded bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-200" title="Status">{statusDisplay}</span>
                  <span className="truncate">{v.changeSummary}</span>
                  <span className="text-zinc-500 shrink-0">· {v.createdBy?.name}</span>
                  {isCurrent && <span className="text-amber-500 shrink-0">(current)</span>}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); (versionB ? setVersionA(v.id) : setVersionB(v.id)); }}
                  className="text-amber-500 hover:underline shrink-0"
                >
                  Compare
                </button>
                {isCurrent ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRollbackConfirmOpen(true); }}
                    disabled={rollback.isPending || !canRollback}
                    title={
                      !canRollback && garment.currentVersionRestoredByRollback
                        ? 'Already restored by rollback; create a new version to continue'
                        : !canRollback
                          ? 'No previous version'
                          : undefined
                    }
                    className="text-amber-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    Rollback
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {compare && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Compare</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Version A</p>
              <pre className="mt-1 overflow-auto rounded bg-zinc-800 p-2 text-xs">
                {JSON.stringify(compare.versionA.snapshotJson, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-zinc-500">Version B</p>
              <pre className="mt-1 overflow-auto rounded bg-zinc-800 p-2 text-xs">
                {JSON.stringify(compare.versionB.snapshotJson, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {canArchive && garment.status !== 'archived' && (
          <button
            type="button"
            onClick={() => archive.mutate({ id })}
            disabled={archive.isPending}
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            Archive
          </button>
        )}
        {canArchive && garment.status === 'archived' && (
          <button
            type="button"
            onClick={() => unarchive.mutate({ id })}
            disabled={unarchive.isPending}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
          >
            {unarchive.isPending ? 'Restoring…' : 'Restore to items'}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => hardDelete.mutate({ id })}
            disabled={hardDelete.isPending}
            className="rounded border border-red-800 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50"
          >
            Hard delete (Director only)
          </button>
        )}
      </div>
    </div>
  );
}
