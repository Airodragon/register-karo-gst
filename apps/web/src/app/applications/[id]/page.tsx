'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type ApplicationDetail, type AutomationProgress } from '@/lib/api';
import { useApplicationSocket } from '@/lib/socket';
import { StatusBadge } from '@/components/application-card';
import { StepWizard } from '@/components/step-wizard';
import { AutomationProgressBar } from '@/components/automation-progress';
import { HumanInputPanel } from '@/components/human-input-panel';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Toast, useToast } from '@/components/toast';
import { isFormEditable, isAutomationActive, canEditDocuments } from '@/lib/wizard-steps';
import { canCancelAutomation } from '@/lib/application-actions';
import type { WizardStepId } from '@/lib/wizard-steps';
import { InputDock } from '@/components/input-dock';
import { DocumentUpload } from '@/components/document-upload';

export default function ApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [automating, setAutomating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [inputData, setInputData] = useState<Record<string, unknown>>();
  const [liveProgress, setLiveProgress] = useState<AutomationProgress>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failureScreenshotUrl, setFailureScreenshotUrl] = useState<string | null>(null);
  const [dockMinimized, setDockMinimized] = useState(false);
  const { toast, showSuccess, showError, dismiss } = useToast();

  useEffect(() => {
    if (app?.failureScreenshotKey) {
      api.getFailureScreenshotUrl(id).then((r) => setFailureScreenshotUrl(r.url)).catch(() => {});
    }
  }, [app?.failureScreenshotKey, id]);

  const load = useCallback(async () => {
    try {
      const data = await api.getApplication(id);
      setApp(data);
      if (data.automationProgress) {
        setLiveProgress(data.automationProgress);
      }
      if (data.pendingInputData) {
        setInputData(data.pendingInputData as Record<string, unknown>);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!app) return;
    const polling = [
      'QUEUED',
      'RUNNING',
      'PART_B_IN_PROGRESS',
      'AWAITING_CAPTCHA',
      'AWAITING_OTP',
      'AWAITING_EVC_OTP',
    ].includes(app.status);
    if (!polling) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [app?.status, load]);

  const onUpdate = useCallback((data: unknown) => {
    const patch = data as ApplicationDetail;
    setApp((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.pendingInput === null || patch.pendingInput === undefined) {
      if (!patch.pendingInputData) {
        setInputData(undefined);
      }
    }
    if (patch.automationProgress) {
      setLiveProgress(patch.automationProgress);
    }
  }, []);

  const onInputRequired = useCallback((data: unknown) => {
    const payload = data as Record<string, unknown>;
    setInputData(payload);
    setApp((prev) =>
      prev
        ? {
            ...prev,
            actionRequired: true,
            pendingInput: (payload.type as string) ?? prev.pendingInput,
            pendingInputData: payload,
            status: String(payload.type ?? '').includes('CAPTCHA')
              ? 'AWAITING_CAPTCHA'
              : prev.status,
          }
        : prev,
    );
  }, []);

  const onProgress = useCallback((progress: AutomationProgress) => {
    setLiveProgress(progress);
    setApp((prev) => (prev ? { ...prev, automationProgress: progress } : prev));
  }, []);

  useApplicationSocket(id, onUpdate, onInputRequired, onProgress);

  async function saveForm(formData: Record<string, unknown>, step: WizardStepId) {
    await api.updateForm(id, formData);
    const updated = await api.updateStep(id, step);
    setApp(updated);
  }

  async function autoSaveForm(formData: Record<string, unknown>) {
    const updated = await api.updateForm(id, formData);
    setApp(updated);
  }

  async function startAutomation(fromStep?: string) {
    setAutomating(true);
    try {
      await api.startAutomation(id, fromStep);
      showSuccess('Automation started');
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setAutomating(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const updated = await api.cancelAutomation(id);
      setApp(updated);
      setLiveProgress(undefined);
      setConfirmCancel(false);
      showSuccess('Automation cancelled');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteApplication(id);
      showSuccess('Filing deleted');
      router.push('/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">Loading application…</p>
      </div>
    );
  }

  const showWizard = isFormEditable(app.status);
  const showDocumentsOnly = canEditDocuments(app.status) && !showWizard;
  const partA = (app.formData?.partA as Record<string, string> | undefined) ?? {};
  const contactHints = {
    mobile: partA.pasMobile,
    email: partA.pasEmail,
  };
  const progress = liveProgress ?? app.automationProgress;
  const canCancel = canCancelAutomation(app.status);
  const humanInputData = inputData ?? app.pendingInputData;
  const humanInputType = app.pendingInput ?? (humanInputData?.type as string | undefined);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-800">
            ← All filings
          </Link>
          <div className="flex items-start justify-between mt-2 gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-neutral-900 truncate">{app.clientRef}</h1>
              <p className="text-xs text-neutral-500 capitalize mt-0.5">{app.constitution}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {app.status === 'ARN_RECEIVED' && app.arn && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-sm text-green-800 font-medium">Registration submitted</p>
            <p className="mt-2 font-mono text-lg font-semibold text-green-900">{app.arn}</p>
            <p className="text-xs text-green-700 mt-1">Application Reference Number</p>
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt('Template name');
                if (!name) return;
                try {
                  await api.createTemplate({
                    name,
                    constitution: app.constitution,
                    formData: app.formData ?? {},
                  });
                  showSuccess('Template saved');
                } catch (err) {
                  showError(err instanceof Error ? err.message : 'Failed to save template');
                }
              }}
              className="mt-4 text-sm font-medium text-teal-700 hover:underline"
            >
              Save as template
            </button>
          </div>
        )}

        {app.trn && !app.arn && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-5 py-4">
            <p className="text-xs text-teal-800 font-medium">TRN received</p>
            <p className="font-mono text-sm font-semibold text-teal-900 mt-1">{app.trn}</p>
            {app.daysUntilTrnExpiry !== undefined && (
              <p className="text-xs text-teal-700 mt-1">
                Valid for {app.daysUntilTrnExpiry} more day
                {app.daysUntilTrnExpiry !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {app.errorLog && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-3">
            <p>{app.errorLog}</p>
            {failureScreenshotUrl && (
              <a
                href={failureScreenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={failureScreenshotUrl}
                  alt="Failure screenshot"
                  className="rounded-lg border border-red-200 max-h-48 w-full object-contain bg-white"
                />
                <span className="text-xs text-red-700 mt-1 inline-block">View full screenshot</span>
              </a>
            )}
          </div>
        )}

        {app.status === 'BIOMETRIC_REQUIRED' && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            GSK biometric visit required. Complete offline at a GST Suvidha Kendra.
          </div>
        )}

        {(isAutomationActive(app.status) || progress) && app.status !== 'DRAFT' && (
          <AutomationProgressBar progress={progress} status={app.status} />
        )}

        {app.actionRequired && humanInputType && (
          <HumanInputPanel
            applicationId={id}
            inputType={humanInputType}
            inputData={humanInputData}
            contactHints={contactHints}
            onSubmitted={load}
            onError={showError}
          />
        )}

        {app.actionRequired && humanInputType && !dockMinimized && (
          <InputDock
            applicationId={id}
            clientRef={app.clientRef}
            inputType={humanInputType}
            inputData={humanInputData}
            contactHints={contactHints}
            onSubmitted={load}
            onError={showError}
            onDismiss={() => setDockMinimized(true)}
          />
        )}

        {canCancel && (
          <button
            onClick={() => setConfirmCancel(true)}
            disabled={cancelling}
            className="w-full border border-red-200 bg-white hover:bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            Cancel automation
          </button>
        )}

        {app.status === 'FAILED' && (
          <button
            onClick={() => startAutomation(app.trn ? 'part_b_resume' : 'part_a')}
            disabled={automating}
            className="w-full border border-neutral-300 bg-white hover:bg-neutral-50 text-sm px-4 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {automating ? 'Retrying…' : 'Retry automation'}
          </button>
        )}

        {app.status === 'TRN_RECEIVED' && !app.arn && (
          <button
            onClick={() => startAutomation('part_b_resume')}
            disabled={automating}
            className="w-full bg-teal-700 hover:bg-teal-600 text-white text-sm px-4 py-3 rounded-xl font-medium disabled:opacity-50 shadow-sm"
          >
            {automating ? 'Starting Part B…' : 'Continue Part B automation'}
          </button>
        )}

        {showDocumentsOnly && (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Update documents</h2>
            <p className="text-sm text-neutral-500 mb-4">
              TRN is saved. You can still upload or replace documents before continuing Part B.
            </p>
            <DocumentUpload
              applicationId={id}
              constitution={app.constitution}
              documents={app.documents ?? []}
              onUploaded={load}
              onError={showError}
            />
          </div>
        )}

        {showWizard && (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
            <StepWizard
              applicationId={id}
              constitution={app.constitution}
              documents={app.documents ?? []}
              formData={app.formData ?? {}}
              currentStep={app.currentStep}
              onSave={saveForm}
              onAutoSave={autoSaveForm}
              onStartAutomation={() => startAutomation('part_a')}
              onDocumentsChange={load}
              onError={showError}
            />
          </div>
        )}

        {app.auditEvents && app.auditEvents.length > 0 && (
          <details className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <summary className="px-5 py-3 text-sm font-medium text-neutral-700 cursor-pointer hover:bg-neutral-50">
              Activity log ({app.auditEvents.length})
            </summary>
            <ul className="border-t border-neutral-100 px-5 py-3 space-y-2 max-h-48 overflow-y-auto">
              {app.auditEvents.map((e) => (
                <li key={e.id} className="text-xs text-neutral-600 flex justify-between gap-4">
                  <span>{e.message}</span>
                  <time className="text-neutral-400 shrink-0">
                    {new Date(e.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="border border-neutral-200 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-medium text-neutral-900">Danger zone</h3>
          <p className="text-xs text-neutral-500 mt-1 mb-4">
            Permanently remove this filing and all uploaded documents.
          </p>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50"
          >
            Delete filing
          </button>
        </div>
      </main>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel automation?"
        description="The browser session will stop. You can edit the form and restart automation later."
        confirmLabel="Cancel automation"
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete filing?"
        description={`Permanently delete ${app.clientRef} and all documents. This cannot be undone.`}
        confirmLabel="Delete filing"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
