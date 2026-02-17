'use client';

import Link from 'next/link';
import { trpc } from '~/trpc/client';
import { Camera } from 'lucide-react';

function formatLastEdited(date: Date): string {
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
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: new Date(date).getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function noteSummary(n: { weaveType: string | null; tone: string | null; notes: string | null }): string {
  const parts = [n.weaveType, n.tone].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' · ');
  return (n.notes?.slice(0, 40) ?? '—') + (n.notes && n.notes.length > 40 ? '…' : '');
}

export default function DashboardPage() {
  const { data: list } = trpc.garments.list.useQuery(
    { limit: 10, archived: false },
    { refetchOnMount: 'always' }
  );
  const { data: looks } = trpc.looks.list.useQuery();
  const { data: recentNotes } = trpc.garments.listRecentTabletNotes.useQuery({ limit: 10 });
  const { data: recentImages } = trpc.assets.listRecent.useQuery({ limit: 8 });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-zinc-400">Overview of the archive.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Recent items</h2>
          <ul className="mt-2 space-y-2">
            {list?.items.slice(0, 5).map((g) => {
              const versionCreated = g.currentVersion?.createdAt ? new Date(g.currentVersion.createdAt).getTime() : 0;
              const garmentUpdated = new Date(g.updatedAt).getTime();
              const lastActivity = new Date(Math.max(versionCreated, garmentUpdated));
              return (
                <li key={g.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link
                    href={`/garments/${g.id}`}
                    className="text-amber-500 hover:underline"
                  >
                    {g.houseCode}
                  </Link>
                  <span className="text-zinc-500">{g.collection}</span>
                  <span className="text-zinc-600 text-sm" title={lastActivity.toLocaleString()}>
                    Version edited {formatLastEdited(lastActivity)}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/garments" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            View all →
          </Link>
        </section>
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Recent quick notes</h2>
          <p className="mt-1 text-xs text-zinc-500">Notes saved from Tablet.</p>
          <ul className="mt-2 space-y-2">
            {recentNotes?.slice(0, 5).map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/garments/${n.garmentId}`}
                  className="text-amber-500 hover:underline"
                >
                  {n.houseCode}
                </Link>
                <span className="text-zinc-500 text-sm truncate max-w-[12rem]" title={noteSummary(n)}>
                  {noteSummary(n)}
                </span>
                <span className="text-zinc-600 text-sm shrink-0" title={new Date(n.createdAt).toLocaleString()}>
                  {formatLastEdited(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          {(!recentNotes || recentNotes.length === 0) && (
            <p className="mt-2 text-sm text-zinc-500">No quick notes yet.</p>
          )}
          <Link href="/garments" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            View items →
          </Link>
        </section>
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Recent images</h2>
            <Link
              href="/photo-gallery"
              className="flex items-center gap-1.5 rounded border border-zinc-600 px-2.5 py-1.5 text-sm text-zinc-300 hover:border-amber-600/50 hover:bg-zinc-800 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              title="Open photo gallery"
            >
              <Camera className="h-4 w-4" aria-hidden />
              Photo gallery
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Latest uploads across all items. Click to open the item.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {recentImages?.map((img) => (
              <Link
                key={img.id}
                href={`/garments/${img.garmentId}`}
                className="flex flex-col rounded border border-zinc-700 overflow-hidden bg-zinc-800/50 hover:border-amber-600/50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {img.displayUrl ? (
                  <img
                    src={img.displayUrl}
                    alt={img.originalFilename}
                    className="h-24 w-28 object-cover"
                  />
                ) : (
                  <div className="h-24 w-28 flex items-center justify-center bg-zinc-800 text-zinc-500 text-xs">No preview</div>
                )}
                <span className="px-2 py-1 text-xs text-zinc-400 truncate max-w-[7rem]">{img.houseCode}</span>
              </Link>
            ))}
          </div>
          {(!recentImages || recentImages.length === 0) && (
            <p className="mt-2 text-sm text-zinc-500">No images yet.</p>
          )}
          <Link href="/garments" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            View items →
          </Link>
        </section>
        <section className="rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Most recently created lookbooks</h2>
          <p className="mt-1 text-xs text-zinc-500">Latest lookbooks by creation date.</p>
          <ul className="mt-2 space-y-2">
            {looks?.slice(0, 5).map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/looks/${l.id}`}
                  className="text-amber-500 hover:underline"
                >
                  {l.name}
                </Link>
                <span className="text-zinc-500">{l.collection} · {l.type}</span>
                <span className="text-zinc-600 text-sm shrink-0" title={new Date(l.createdAt).toLocaleString()}>
                  Created {formatLastEdited(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          {(!looks || looks.length === 0) && (
            <p className="mt-2 text-sm text-zinc-500">No lookbooks yet.</p>
          )}
          <Link href="/looks" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            View all →
          </Link>
        </section>
      </div>
    </div>
  );
}
