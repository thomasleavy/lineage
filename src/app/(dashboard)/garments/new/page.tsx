'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { trpc } from '~/trpc/client';
import { getCsrfToken } from '~/lib/csrf';

const MAX_IMAGES = 5;

export default function NewGarmentPage() {
  const router = useRouter();
  const [houseCode, setHouseCode] = useState('');
  const [collection, setCollection] = useState('AW26');
  const [category, setCategory] = useState('coat');
  const [status, setStatus] = useState<'concept' | 'toile' | 'sample' | 'final'>('concept');
  const [summary, setSummary] = useState('New item');
  const [detail, setDetail] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const create = trpc.garments.create.useMutation();
  const createUploadUrl = trpc.assets.createUploadUrl.useMutation();
  const confirmUpload = trpc.assets.confirmUpload.useMutation();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES));
  };
  const removeFile = (index: number) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const garment = await create.mutateAsync({
        houseCode: houseCode.trim(),
        collection,
        category,
        status,
        changeSummary: summary.trim() || 'New item',
        notes: detail.trim() || undefined,
      });
      const versionId = garment.currentVersion?.id;
      const filesToUpload = selectedFiles.slice(0, MAX_IMAGES);
      if (versionId && filesToUpload.length > 0) {
        const csrf = getCsrfToken();
        const headers: Record<string, string> = {};
        if (csrf) headers['X-CSRF-Token'] = csrf;
        for (const file of filesToUpload) {
          const created = await createUploadUrl.mutateAsync({
            garmentId: garment.id,
            garmentVersionId: versionId,
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
      }
      router.push(`/garments/${garment.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link href="/garments" className="text-sm text-zinc-500 hover:text-zinc-300">← Items</Link>
      <h1 className="mt-2 text-2xl font-semibold">New item</h1>
      <form
        className="mt-6 max-w-md space-y-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block text-sm text-zinc-500">House code</label>
          <input
            type="text"
            value={houseCode}
            onChange={(e) => setHouseCode(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            placeholder="ARC-AW26-LOOK01-A"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Collection</label>
          <input
            type="text"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
          >
            <option value="coat">Coat</option>
            <option value="dress">Dress</option>
            <option value="hoodie">Hoodie</option>
            <option value="jacket">Jacket</option>
            <option value="jumper">Jumper</option>
            <option value="scarf">Scarf</option>
            <option value="shirt">Shirt</option>
            <option value="shoes">Shoes</option>
            <option value="shorts">Shorts</option>
            <option value="skirt">Skirt</option>
            <option value="t-shirt">T-shirt</option>
            <option value="trousers">Trousers</option>
            <option value="wedding dress">Wedding dress</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
          >
            <option value="concept">Concept</option>
            <option value="toile">Toile</option>
            <option value="sample">Sample</option>
            <option value="final">Final</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Summary</label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            placeholder="e.g. New item"
          />
          <p className="mt-0.5 text-xs text-zinc-500">Shown as the current version summary on the item page.</p>
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Detail (optional)</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            rows={3}
            placeholder="Version detail / notes"
          />
          <p className="mt-0.5 text-xs text-zinc-500">Same as the detail field when creating a new version later.</p>
        </div>
        <div>
          <label className="block text-sm text-zinc-500">Images (up to {MAX_IMAGES})</label>
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
        {(create.error || submitError) && (
          <p className="text-sm text-red-400">{submitError ?? create.error?.message}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-black hover:bg-amber-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <Link href="/garments" className="rounded border border-zinc-600 px-4 py-2">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
