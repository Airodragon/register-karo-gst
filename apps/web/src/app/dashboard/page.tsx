'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearToken, type ApplicationSummary } from '@/lib/api';
import { ApplicationCard } from '@/components/application-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateFilingModal } from '@/components/create-filing-modal';
import { Toast, useToast } from '@/components/toast';
import { canCancelAutomation } from '@/lib/application-actions';
import clsx from 'clsx';

type FilterTab = 'attention' | 'all' | 'active' | 'input' | 'done' | 'failed';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'input', label: 'Needs input' },
  { id: 'done', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
];

function filterApps(apps: ApplicationSummary[], tab: FilterTab): ApplicationSummary[] {
  switch (tab) {
    case 'attention':
      return apps.filter((a) => a.needsAttention);
    case 'active':
      return apps.filter((a) => canCancelAutomation(a.status) || a.status === 'TRN_RECEIVED');
    case 'input':
      return apps.filter((a) => a.actionRequired);
    case 'done':
      return apps.filter((a) => a.status === 'ARN_RECEIVED');
    case 'failed':
      return apps.filter((a) => a.status === 'FAILED' || a.status === 'BIOMETRIC_REQUIRED');
    default:
      return apps;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('attention');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('updatedAt');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ApplicationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { toast, showSuccess, showError, dismiss } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api.listApplications({
        search: search || undefined,
        sort,
        order: 'desc',
        page,
        pageSize: 20,
        attention: tab === 'attention',
      });
      setApps(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router, search, sort, page, tab]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, sort]);

  function logout() {
    clearToken();
    router.push('/login');
  }

  async function createNew(data: { clientRef: string; constitution: string }) {
    const businessConstitution =
      data.constitution === 'partnership'
        ? 'Partnership'
        : data.constitution === 'huf'
          ? 'Hindu Undivided Family'
          : 'Proprietorship';
    const app = await api.createApplication({
      clientRef: data.clientRef,
      constitution: data.constitution,
      formData: {
        business: { constitutionOfBusiness: businessConstitution },
      },
    });
    router.push(`/applications/${app.id}`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteApplication(deleteTarget.id);
      showSuccess('Filing deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = tab === 'attention' ? apps : filterApps(apps, tab);
  const stats = {
    total,
    needsInput: apps.filter((a) => a.actionRequired).length,
    attention: apps.filter((a) => a.needsAttention).length,
    completed: apps.filter((a) => a.status === 'ARN_RECEIVED').length,
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">RegisterKaro</h1>
            <p className="text-xs text-neutral-500">GST registration operations</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition shadow-sm"
            >
              New filing
            </button>
            <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-800">
              Sign out
            </button>
            <Link href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-800">
              Team
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total filings', value: stats.total },
            { label: 'Needs attention', value: stats.attention },
            { label: 'Needs input', value: stats.needsInput },
            { label: 'Completed', value: stats.completed },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-sm"
            >
              <p className="text-2xl font-semibold text-neutral-900 tabular-nums">{s.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
          >
            <input
              type="search"
              placeholder="Search by client ref, TRN, ARN…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </form>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="updatedAt">Last updated</option>
            <option value="createdAt">Created date</option>
            <option value="trnExpiresAt">TRN expiry</option>
          </select>
        </div>

        <div className="flex gap-1 overflow-x-auto mb-6 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                tab === t.id
                  ? 'bg-teal-700 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading filings…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-xl bg-white">
            <p className="text-neutral-500 text-sm">
              {tab === 'all' ? 'No filings yet' : 'No filings in this view'}
            </p>
            {tab === 'all' && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-sm text-teal-700 font-medium hover:underline"
              >
                Create your first filing
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onDelete={() => setDeleteTarget(app)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <CreateFilingModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createNew}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete filing?"
        description={`This will permanently delete ${deleteTarget?.clientRef ?? 'this filing'} and all associated documents. This cannot be undone.`}
        confirmLabel="Delete filing"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
