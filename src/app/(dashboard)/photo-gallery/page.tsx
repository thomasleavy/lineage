'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '~/trpc/client';
import { Camera } from 'lucide-react';

const PAGE_SIZE = 24;

export default function PhotoGalleryPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = trpc.assets.listLibrary.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Camera className="h-7 w-7 text-amber-500" aria-hidden />
          <h1 className="text-2xl font-semibold">Photo gallery</h1>
        </div>
        <p className="text-zinc-400">
          All photos across items, newest first. Click a photo to open its item.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-6 text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-zinc-500">No photos yet. Upload photos from an item page.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-500">
            {total} photo{total !== 1 ? 's' : ''} total
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((img) => (
              <Link
                key={img.id}
                href={`/garments/${img.garmentId}`}
                className="group flex flex-col rounded border border-zinc-700 overflow-hidden bg-zinc-800/50 hover:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {img.displayUrl ? (
                  <img
                    src={img.displayUrl}
                    alt=""
                    className="aspect-square w-full object-cover transition group-hover:opacity-90"
                  />
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">
                    No preview
                  </div>
                )}
                <div className="p-2">
                  <span className="block truncate text-xs font-medium text-amber-500 group-hover:underline">
                    {img.houseCode}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-zinc-600 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-zinc-800"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-zinc-600 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <Link href="/dashboard" className="mt-6 inline-block text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
