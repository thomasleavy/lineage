'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '~/trpc/client';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [houseCode, setHouseCode] = useState('');
  const [collection, setCollection] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<string>('');
  const [revisedMoreThan, setRevisedMoreThan] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, isFetching } = trpc.search.garments.useQuery({
    q: q || undefined,
    houseCode: houseCode || undefined,
    collection: collection || undefined,
    category: category || undefined,
    status: (status || undefined) as 'concept' | 'toile' | 'sample' | 'final' | 'archived' | undefined,
    revisedMoreThan: revisedMoreThan ? parseInt(revisedMoreThan, 10) : undefined,
    limit,
    offset: page * limit,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Search</h1>
      <p className="mt-1 text-zinc-400">Full-text and filters. Try &quot;revised more than N times&quot;.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search notes, house code, change detail…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          className="min-w-[200px] rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="House code"
          value={houseCode}
          onChange={(e) => { setHouseCode(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Collection"
          value={collection}
          onChange={(e) => { setCollection(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
        >
          <option value="">Status</option>
          <option value="concept">Concept</option>
          <option value="toile">Toile</option>
          <option value="sample">Sample</option>
          <option value="final">Final</option>
          <option value="archived">Archived</option>
        </select>
        <input
          type="number"
          placeholder="Revised more than"
          value={revisedMoreThan}
          onChange={(e) => { setRevisedMoreThan(e.target.value); setPage(0); }}
          className="w-24 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm"
          min={0}
        />
      </div>
      {isLoading || isFetching ? (
        <p className="mt-6 text-zinc-500">Searching…</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-500">Found: {data?.total ?? 0}</p>
          <ul className="mt-2 space-y-2">
            {data?.items.map((g) => (
              <li key={g.id} className="rounded border border-zinc-800 p-3">
                <Link href={`/garments/${g.id}`} className="font-medium text-amber-500 hover:underline">
                  {g.houseCode}
                </Link>
                <span className="ml-2 text-zinc-500">{g.collection} · {g.category} · {g.status}</span>
                {g._count && <span className="ml-2 text-zinc-500">· {g._count.versions} versions</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between text-sm">
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
              className="rounded px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
