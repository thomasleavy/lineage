'use client';

import Link from 'next/link';
import { trpc } from '~/trpc/client';
import { useState } from 'react';

export default function AdminPage() {
  const { data: users, isLoading: usersLoading } = trpc.admin.listUsers.useQuery();
  const { data: roles } = trpc.admin.listRoles.useQuery();
  const { data: audit, isLoading: auditLoading } = trpc.audit.list.useQuery(
    { limit: 30 },
    { retry: false }
  );
  const utils = trpc.useUtils();
  const { data: chain } = trpc.audit.verifyChain.useQuery(undefined, { retry: false });
  const repairChain = trpc.audit.repairChain.useMutation({
    onSuccess: () => {
      void utils.audit.verifyChain.invalidate();
    },
  });
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([]);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: (_, variables) => {
      setCreateEmail('');
      setCreateName('');
      setCreatePassword('');
      setCreateRoleIds([]);
      setCreateSuccess(variables.email);
      void utils.admin.listUsers.invalidate();
      setTimeout(() => setCreateSuccess(null), 8000);
    },
  });

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">← Dashboard</Link>
      <h1 className="mt-2 text-2xl font-semibold">Admin</h1>
      <p className="text-zinc-400">Users, roles, audit log (Creative Director / Legal Audit).</p>

      {usersLoading && <p className="mt-4 text-zinc-500">Loading users…</p>}
      {users && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Users</h2>
          <ul className="mt-2 space-y-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{u.email}</span>
                <span className="text-zinc-500">{u.name ?? '—'}</span>
                <span className="text-zinc-500">
                  [{u.userRoles.map((ur) => ur.role.name).join(', ')}]
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-lg font-medium">Create user</h2>
        {createSuccess && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-4 rounded border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-emerald-200"
          >
            <span className="font-medium">User created successfully: {createSuccess}</span>
            <button
              type="button"
              onClick={() => setCreateSuccess(null)}
              className="shrink-0 rounded px-2 py-1 text-sm hover:bg-emerald-800/50"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createUser.mutate({
              email: createEmail,
              name: createName || undefined,
              password: createPassword,
              roleIds: createRoleIds,
            });
          }}
        >
          <input
            type="email"
            placeholder="Email"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2"
            required
          />
          <div className="flex flex-wrap gap-2">
            {roles?.map((r) => (
              <label key={r.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={createRoleIds.includes(r.id)}
                  onChange={(e) =>
                    setCreateRoleIds((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={createUser.isPending}
            className="rounded bg-amber-600 px-3 py-2 text-sm text-black disabled:opacity-50"
          >
            Create user
          </button>
        </form>
        {createUser.error && <p className="mt-2 text-sm text-red-400">{createUser.error.message}</p>}
      </section>

      {chain && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Audit log hash chain</h2>
          <p className={chain.valid ? 'text-green-500' : 'text-red-400'}>
            {chain.valid ? 'Valid' : `Invalid (first broken: ${chain.firstBrokenId})`}
          </p>
          {!chain.valid && (
            <p className="mt-2 text-sm text-zinc-400">
              The chain can break if entries were written in the same millisecond or data was edited. Ordering is now deterministic; you can repair existing hashes once.
            </p>
          )}
          {!chain.valid && (
            <button
              type="button"
              onClick={() => repairChain.mutate()}
              disabled={repairChain.isPending}
              className="mt-2 rounded bg-amber-600 px-3 py-2 text-sm text-black disabled:opacity-50"
            >
              {repairChain.isPending ? 'Repairing…' : 'Repair hash chain'}
            </button>
          )}
          {repairChain.data && (
            <p className="mt-2 text-sm text-green-500">Repaired {repairChain.data.repaired} entries.</p>
          )}
        </section>
      )}

      {auditLoading && <p className="mt-4 text-zinc-500">Loading audit…</p>}
      {audit && (
        <section className="mt-6 rounded border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-medium">Recent audit log</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {audit.items.map((entry) => (
              <li key={entry.id} className="text-zinc-400">
                <span className="text-amber-500">{entry.actionType}</span>
                {' '}{entry.entityType} {entry.entityId?.slice(0, 8)} · {entry.actor?.email ?? 'system'} · {entry.createdAt.toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
