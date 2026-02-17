'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '~/trpc/client';

type GarmentForDelete = { id: string; houseCode: string };

function formatLastWorked(date: Date): string {
  const now = new Date();
  const ms = now.getTime() - new Date(date).getTime();
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function GarmentsPage() {
  const searchParams = useSearchParams();
  const [houseCode, setHouseCode] = useState<string>('');
  const [collection, setCollection] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<GarmentForDelete | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const limit = 20;

  const showArchivedBanner = searchParams.get('archived') === '1' && !bannerDismissed;
  const showRestoredBanner = searchParams.get('restored') === '1' && !bannerDismissed;

  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const canDelete = me?.roles?.includes('CREATIVE_DIRECTOR') ?? false;
  const canArchive = (me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEAD_DESIGNER')) ?? false;
  const utils = trpc.useUtils();
  const hardDelete = trpc.garments.hardDelete.useMutation({
    onSuccess: () => {
      setDeleteConfirm(null);
      void utils.garments.list.invalidate();
    },
  });

  const { data, isLoading } = trpc.garments.list.useQuery({
    houseCode: houseCode.trim() || undefined,
    collection: collection || undefined,
    status: status || undefined,
    archived: false,
    limit,
    offset: page * limit,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Items</h1>
        <div className="flex items-center gap-2">
          {canArchive && (
            <Link
              href="/garments/archive"
              className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Archive
            </Link>
          )}
          <Link
            href="/garments/new"
            className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            New item
          </Link>
        </div>
      </div>
      {(showArchivedBanner || showRestoredBanner) && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-4 rounded border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-emerald-200"
        >
          <span>
            {showArchivedBanner && 'Item archived. It has been removed from the list.'}
            {showRestoredBanner && 'Item restored. It is back in the items list and will appear in recent items on the dashboard.'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {showArchivedBanner && canArchive && (
              <Link
                href="/garments/archive"
                className="rounded border border-emerald-600 px-2 py-1 text-sm hover:bg-emerald-800/50"
              >
                View archive
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setBannerDismissed(true);
                window.history.replaceState(null, '', '/garments');
              }}
              className="rounded px-2 py-1 text-sm hover:bg-emerald-800/50"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="House code"
          value={houseCode}
          onChange={(e) => { setHouseCode(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm min-w-[180px]"
          aria-label="Search by house code"
        />
        <input
          type="text"
          placeholder="Collection"
          value={collection}
          onChange={(e) => { setCollection(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="concept">Concept</option>
          <option value="toile">Toile</option>
          <option value="sample">Sample</option>
          <option value="final">Final</option>
        </select>
      </div>
      {isLoading ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : (
        <>
          <table className="mt-6 w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-sm text-zinc-400">
                <th className="pb-2 pr-4">House code</th>
                <th className="pb-2 pr-4">Collection</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created by</th>
                <th className="pb-2 pr-4">Last worked on</th>
                {canDelete && <th className="pb-2 pr-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((g) => (
                <tr key={g.id} className="border-b border-zinc-800">
                  <td className="py-3 pr-4">
                    <Link href={`/garments/${g.id}`} className="text-amber-500 hover:underline">
                      {g.houseCode}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{g.collection}</td>
                  <td className="py-3 pr-4">{g.category}</td>
                  <td className="py-3 pr-4">{g.status}</td>
                  <td className="py-3 pr-4 text-zinc-500">{g.createdBy?.name ?? '—'}</td>
                  <td className="py-3 pr-4 text-zinc-400 text-sm" title={g.updatedAt ? new Date(g.updatedAt).toLocaleString() : ''}>
                    {g.updatedAt ? formatLastWorked(g.updatedAt) : '—'}
                  </td>
                  {canDelete && (
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ id: g.id, houseCode: g.houseCode })}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between text-sm text-zinc-500">
            <span>Total: {data?.total ?? 0}</span>
            <div className="gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded px-2 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!data?.items.length || data.items.length < limit}
                onClick={() => setPage((p) => p + 1)}
                className="ml-2 rounded px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !hardDelete.isPending && setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-title" className="text-lg font-medium">Delete item</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to delete <strong className="text-zinc-200">{deleteConfirm.houseCode}</strong>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={hardDelete.isPending}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => hardDelete.mutate({ id: deleteConfirm.id })}
                disabled={hardDelete.isPending}
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {hardDelete.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
