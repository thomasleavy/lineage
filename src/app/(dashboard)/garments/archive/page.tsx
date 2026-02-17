'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '~/trpc/client';

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
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(date).getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export default function GarmentsArchivePage() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const canArchive = (me?.roles?.includes('CREATIVE_DIRECTOR') || me?.roles?.includes('LEAD_DESIGNER')) ?? false;

  const { data, isLoading, error } = trpc.garments.list.useQuery(
    { archived: true, limit, offset: page * limit },
    { retry: false, enabled: canArchive }
  );

  if (!canArchive) {
    return (
      <div>
        <Link href="/garments" className="text-sm text-zinc-500 hover:text-zinc-300">← Items</Link>
        <p className="mt-4 text-zinc-400">Only lead designer and director can view the archive.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link href="/garments" className="text-sm text-zinc-500 hover:text-zinc-300">← Items</Link>
        <p className="mt-4 text-red-400">{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link href="/garments" className="text-sm text-zinc-500 hover:text-zinc-300">← Items</Link>
          <h1 className="mt-2 text-2xl font-semibold">Archive</h1>
          <p className="mt-1 text-zinc-400">Archived pieces. Open one to view details or restore it to the items list.</p>
        </div>
      </div>
      {isLoading ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : !data?.items.length ? (
        <p className="mt-6 text-zinc-500">No archived items.</p>
      ) : (
        <>
          <table className="mt-6 w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-sm text-zinc-400">
                <th className="pb-2 pr-4">House code</th>
                <th className="pb-2 pr-4">Collection</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2 pr-4">Last worked on</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((g) => (
                <tr key={g.id} className="border-b border-zinc-800">
                  <td className="py-3 pr-4">
                    <Link href={`/garments/${g.id}`} className="text-amber-500 hover:underline">
                      {g.houseCode}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{g.collection}</td>
                  <td className="py-3 pr-4">{g.category}</td>
                  <td className="py-3 pr-4 text-zinc-500">{g.designerOwner?.name ?? '—'}</td>
                  <td className="py-3 pr-4 text-zinc-400 text-sm" title={g.updatedAt ? new Date(g.updatedAt).toLocaleString() : ''}>
                    {g.updatedAt ? formatLastWorked(g.updatedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between text-sm text-zinc-500">
            <span>Total: {data.total ?? 0}</span>
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
                disabled={!data.items.length || data.items.length < limit}
                onClick={() => setPage((p) => p + 1)}
                className="ml-2 rounded px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
