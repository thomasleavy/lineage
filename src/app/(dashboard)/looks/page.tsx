'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '~/trpc/client';

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function formatRelative(date: Date): string {
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
  return formatDate(date);
}

export default function LooksPage() {
  const router = useRouter();
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const canCreateLookbooks = (me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEAD_DESIGNER') || me?.roles?.includes('ATELIER')) ?? false;
  const canDeleteLookbooks = (me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEAD_DESIGNER')) ?? false;
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: looks, isLoading } = trpc.looks.list.useQuery();
  const duplicate = trpc.looks.duplicate.useMutation({
    onSuccess: (l) => router.push(`/looks/${l.id}`),
  });
  const deleteLook = trpc.looks.delete.useMutation({
    onSuccess: () => {
      setDeleteConfirm(null);
      void utils.looks.list.invalidate();
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lookbook</h1>
          <p className="mt-1 text-zinc-400">Compose items into run order and export PDF.</p>
        </div>
        {canCreateLookbooks && (
          <div className="flex items-center gap-2">
            <Link
              href="/looks/new"
              className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              New look
            </Link>
            <Link
              href="/looks/new?fromCollection=1"
              className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              Bulk add from collection
            </Link>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : !looks?.length ? (
        <div className="mt-8 rounded border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-400">Looks are lineups of garments for run-of-show or press. {canCreateLookbooks ? 'Create one to export a PDF.' : 'Only atelier, lead designer and director can create lookbooks.'}</p>
          {canCreateLookbooks && (
            <Link
              href="/looks/new"
              className="mt-4 inline-block rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500"
            >
              New look
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {looks.map((l) => (
            <li key={l.id} className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/looks/${l.id}`} className="font-medium text-amber-500 hover:underline">
                    {l.name}
                  </Link>
                  <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {l.collection}
                  </span>
                  <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                    {l.type === 'run_of_show' ? 'Run of show' : 'Press'}
                  </span>
                  <span className="text-zinc-500 text-sm">{l.lookItems?.length ?? 0} items</span>
                  {l.createdBy && (
                    <span className="text-zinc-500 text-sm">by {l.createdBy.name ?? l.createdBy.email}</span>
                  )}
                  <span className="text-zinc-500 text-xs" title={formatDate(l.createdAt)}>
                    Created {formatRelative(l.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/looks/${l.id}`}
                    className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-black hover:bg-amber-500"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => duplicate.mutate({ lookId: l.id })}
                    disabled={duplicate.isPending}
                    className="rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {duplicate.isPending ? '…' : 'Duplicate'}
                  </button>
                  <Link
                    href={`/looks/${l.id}`}
                    className="rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
                  >
                    Export PDF
                  </Link>
                  {canDeleteLookbooks && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ id: l.id, name: l.name })}
                      className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !deleteLook.isPending && setDeleteConfirm(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-look-title"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-look-title" className="text-lg font-medium">Delete lookbook</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to delete <strong className="text-zinc-200">{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLook.isPending}
                className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteLook.mutate({ id: deleteConfirm.id })}
                disabled={deleteLook.isPending}
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteLook.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
