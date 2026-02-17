'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-2">
      <div className="flex justify-center">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">← Dashboard</Link>
      </div>
      <div className="mt-8 flex flex-col items-center text-center">
        <h1 className="text-5xl font-bold tracking-tight text-amber-500 sm:text-6xl md:text-7xl lg:text-8xl">
          LINEAGE
        </h1>
        <p className="mt-6 max-w-lg text-zinc-300 leading-relaxed">
          LINEAGE is the internal archive for your design house. Use it to track garments through concept, toile, sample and final; keep version history, images and notes in one place; build lookbooks for run-of-show or press; and capture quick notes from the studio or tablet.
        </p>
        <p className="mt-4 max-w-lg text-sm text-zinc-500">
          Items, photo gallery, search, lookbook and tablet are all in the menu—sign out from the top right when you’re done.
        </p>
      </div>
    </div>
  );
}
