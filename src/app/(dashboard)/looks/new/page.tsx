'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '~/trpc/client';

export default function NewLookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromCollection = searchParams.get('fromCollection') === '1';

  const [name, setName] = useState('');
  const [collection, setCollection] = useState('');
  const [type, setType] = useState<'run_of_show' | 'press'>('run_of_show');

  const { data: collections = [] } = trpc.garments.listCollections.useQuery(undefined, {
    enabled: fromCollection,
  });
  const create = trpc.looks.create.useMutation({
    onSuccess: (l) => router.push(`/looks/${l.id}`),
  });
  const createFromCollection = trpc.looks.createFromCollection.useMutation({
    onSuccess: (l) => router.push(`/looks/${l.id}`),
  });

  const isFromCollection = fromCollection;
  const pending = create.isPending || createFromCollection.isPending;
  const error = create.error ?? createFromCollection.error;

  return (
    <div>
      <Link href="/looks" className="text-sm text-zinc-500 hover:text-zinc-300">← Lookbook</Link>
      <h1 className="mt-2 text-2xl font-semibold">
        {isFromCollection ? 'Bulk add from collection' : 'New look'}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {isFromCollection
          ? 'Create a look with all items from one collection (e.g. AW26, SS27). Choose collection, name the look, pick run of show or press, then save. You can reorder or remove items after.'
          : 'Create an empty look, then add items by house code.'}
      </p>
      <form
        className="mt-6 max-w-md space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isFromCollection) {
            createFromCollection.mutate({ name, collection, type });
          } else {
            create.mutate({ name, collection, type });
          }
        }}
      >
        <div>
          <label className="block text-sm text-zinc-500">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            required
          />
        </div>
        {isFromCollection && (
          <div>
            <label htmlFor="bulk-collection" className="block text-sm text-zinc-500">Collection</label>
            <select
              id="bulk-collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
              required={isFromCollection}
            >
              <option value="">Select a collection…</option>
              {collections.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {collections.length === 0 && (
              <p className="mt-1 text-xs text-zinc-500">No collections in archive yet. Add items first.</p>
            )}
          </div>
        )}
        {!isFromCollection && (
          <div>
            <label className="block text-sm text-zinc-500">Collection</label>
            <input
              type="text"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
              placeholder="e.g. AW26"
            />
          </div>
        )}
        <div>
          <label className="block text-sm text-zinc-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'run_of_show' | 'press')}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
          >
            <option value="run_of_show">Run of show</option>
            <option value="press">Press</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error.message}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || (isFromCollection && !collection.trim())}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            {pending ? 'Creating…' : isFromCollection ? 'Create look with all items' : 'Create'}
          </button>
          <Link href="/looks" className="rounded border border-zinc-600 px-4 py-2">Cancel</Link>
          {isFromCollection && (
            <Link href="/looks/new" className="rounded border border-zinc-600 px-4 py-2 text-zinc-400 hover:text-zinc-200">
              Empty look instead
            </Link>
          )}
          {!isFromCollection && (
            <Link href="/looks/new?fromCollection=1" className="rounded border border-amber-600 px-4 py-2 text-amber-500 hover:bg-amber-600/10">
              Bulk add from collection
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
