'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '~/trpc/client';
import { getCsrfToken } from '~/lib/csrf';

export default function LookDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: look, isLoading } = trpc.looks.getById.useQuery({ id });
  const { data: exportInfo } = trpc.exportPdf.getExportUrl.useQuery(
    { lookId: id, type: 'run_of_show' },
    { enabled: !!look }
  );
  const { data: pressExportInfo } = trpc.exportPdf.getExportUrl.useQuery(
    { lookId: id, type: 'press' },
    { enabled: !!look }
  );
  const [houseCodeOrId, setHouseCodeOrId] = useState('');
  const [selectedGarmentId, setSelectedGarmentId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const { data: garmentsData } = trpc.garments.list.useQuery(
    { limit: 100, offset: 0 },
    { enabled: !!look }
  );
  const utils = trpc.useUtils();
  const addItem = trpc.looks.addItem.useMutation({
    onSuccess: () => {
      setHouseCodeOrId('');
      setSelectedGarmentId('');
      setAddError(null);
      void utils.looks.getById.invalidate({ id });
      void utils.looks.list.invalidate();
    },
    onError: (e) => {
      setAddError(e.message);
    },
  });
  const reorder = trpc.looks.reorderItems.useMutation({
    onSuccess: () => utils.looks.getById.invalidate({ id }),
  });
  const removeItem = trpc.looks.removeItem.useMutation({
    onSuccess: () => {
      void utils.looks.getById.invalidate({ id });
      void utils.looks.list.invalidate();
    },
  });
  const duplicateLook = trpc.looks.duplicate.useMutation({
    onSuccess: (l) => {
      window.location.href = `/looks/${l.id}`;
    },
  });
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const updateLook = trpc.looks.update.useMutation({
    onSuccess: () => {
      setEditingName(false);
      void utils.looks.getById.invalidate({ id });
      void utils.looks.list.invalidate();
    },
  });

  const [exportStatus, setExportStatus] = useState<{ jobId: string; type: string; status: string; downloadUrl?: string; error?: string } | null>(null);

  const handleExport = async (type: 'run_of_show' | 'press', asyncExport = false) => {
    const info = type === 'press' ? pressExportInfo : exportInfo;
    if (!info?.url || !info.body) return;
    const csrf = getCsrfToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const body = asyncExport ? { ...info.body, async: true } : info.body;
    const res = await fetch(info.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;
    if (!res.ok) {
      alert((data as { error?: string })?.error ?? 'Export failed');
      return;
    }
    if (asyncExport && data && (data as { exportJobId?: string }).exportJobId) {
      const jobId = (data as { exportJobId: string }).exportJobId;
      setExportStatus({ jobId, type, status: 'queued' });
      const poll = async () => {
        const s = await fetch(`/api/export/status/${jobId}`, { credentials: 'include' });
        const j = await s.json();
        setExportStatus((prev) => (prev?.jobId === jobId ? { ...prev, ...j } : prev));
        if (j.status === 'ready' && j.downloadUrl) {
          window.open(j.downloadUrl, '_blank');
          setExportStatus(null);
          return;
        }
        if (j.status === 'failed') return;
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 2000);
      return;
    }
    const blob = await res.blob();
    if (blob.size === 0) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage-lookbook-${id.slice(0, 8)}-${type}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !look) return <p className="text-zinc-500">Loading…</p>;

  const itemIds = look.lookItems.map((i) => i.id);
  const alreadyInLook = new Set(look.lookItems.map((li) => li.garment.id));
  const availableGarments = (garmentsData?.items ?? []).filter((g) => !alreadyInLook.has(g.id));

  return (
    <div>
      <Link href="/looks" className="text-sm text-zinc-500 hover:text-zinc-300">← Lookbook</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {editingName ? (
            <>
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xl font-semibold min-w-[200px]"
                placeholder="Look name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editNameValue.trim()) updateLook.mutate({ id, name: editNameValue.trim() });
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
              <button
                type="button"
                onClick={() => editNameValue.trim() && updateLook.mutate({ id, name: editNameValue.trim() })}
                disabled={updateLook.isPending || !editNameValue.trim()}
                className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500 disabled:opacity-50"
              >
                {updateLook.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                disabled={updateLook.isPending}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">{look.name}</h1>
              <button
                type="button"
                onClick={() => {
                  setEditNameValue(look.name);
                  setEditingName(true);
                }}
                className="rounded border border-zinc-600 px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Edit name
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => duplicateLook.mutate({ lookId: id })}
            disabled={duplicateLook.isPending}
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {duplicateLook.isPending ? 'Duplicating…' : 'Duplicate look'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('run_of_show')}
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Export run-of-show PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('press')}
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Export press PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('run_of_show', true)}
            className="rounded border border-amber-600 px-3 py-2 text-sm text-amber-500 hover:bg-amber-600/10"
          >
            Queue run-of-show (background)
          </button>
          <button
            type="button"
            onClick={() => handleExport('press', true)}
            className="rounded border border-amber-600 px-3 py-2 text-sm text-amber-500 hover:bg-amber-600/10"
          >
            Queue press (background)
          </button>
          {exportStatus && (
            <span className="text-sm text-zinc-400">
              {exportStatus.status === 'queued' || exportStatus.status === 'processing'
                ? `Export ${exportStatus.status}…`
                : exportStatus.status === 'failed'
                  ? `Failed: ${typeof exportStatus.error === 'string' ? exportStatus.error : 'unknown'}`
                  : 'Ready'}
            </span>
          )}
        </div>
      </div>
      <p className="text-zinc-400">{look.collection} · {look.type}</p>

      <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-lg font-medium">Items (run order)</h2>
        <ul className="mt-2 space-y-2">
          {look.lookItems.map((li, idx) => (
            <li key={li.id} className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-6">{idx + 1}.</span>
              <Link href={`/garments/${li.garment.id}`} className="text-amber-500 hover:underline">
                {li.garment.houseCode}
              </Link>
              <span className="text-zinc-500">{li.modelName ?? '—'}</span>
              <button
                type="button"
                onClick={() => {
                  const newOrder = itemIds.filter((x) => x !== li.id);
                  const from = itemIds.indexOf(li.id);
                  newOrder.splice(Math.max(0, from - 1), 0, li.id);
                  reorder.mutate({ lookId: id, itemIds: newOrder.length ? newOrder : [li.id] });
                }}
                className="text-zinc-500 hover:text-zinc-300"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => {
                  const newOrder = itemIds.filter((x) => x !== li.id);
                  const from = itemIds.indexOf(li.id);
                  newOrder.splice(Math.min(newOrder.length, from + 2), 0, li.id);
                  reorder.mutate({ lookId: id, itemIds: newOrder.length ? newOrder : [li.id] });
                }}
                className="text-zinc-500 hover:text-zinc-300"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem.mutate({ lookItemId: li.id })}
                disabled={removeItem.isPending}
                className="ml-1 text-red-400 hover:text-red-300 disabled:opacity-50"
                title="Remove from look"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="add-item-select" className="sr-only">
              Add item to look by selecting from list
            </label>
            <select
              id="add-item-select"
              value={selectedGarmentId}
              onChange={(e) => {
                const garmentId = e.target.value;
                if (!garmentId) return;
                addItem.mutate({
                  lookId: id,
                  garmentId,
                  orderIndex: look.lookItems.length,
                });
                setSelectedGarmentId('');
              }}
              disabled={addItem.isPending || availableGarments.length === 0}
              className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm min-w-[240px] text-zinc-100 disabled:opacity-50"
              aria-describedby="add-item-hint"
            >
              <option value="">
                {availableGarments.length === 0
                  ? (look.lookItems.length === 0 ? 'No items in archive yet' : 'All items already in look')
                  : 'Select an item to add…'}
              </option>
              {availableGarments.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.houseCode} · {g.collection}
                </option>
              ))}
            </select>
          </div>
          <p id="add-item-hint" className="text-xs text-zinc-500">
            Or type house code below and add.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="add-item-housecode" className="sr-only">
              House code to add
            </label>
            <input
              id="add-item-housecode"
              type="text"
              placeholder="House code (e.g. ARC-AW26-LOOK12-A)"
              value={houseCodeOrId}
              onChange={(e) => {
                setHouseCodeOrId(e.target.value);
                setAddError(null);
              }}
              className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => {
                const v = houseCodeOrId.trim();
                if (!v) return;
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                addItem.mutate({
                  lookId: id,
                  ...(isUuid ? { garmentId: v } : { houseCode: v }),
                  orderIndex: look.lookItems.length,
                });
              }}
              disabled={addItem.isPending}
              className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              Add by house code
            </button>
          </div>
          {addError && <span className="text-sm text-red-400">{addError}</span>}
        </div>
      </section>
    </div>
  );
}
