import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import constants from '../constants';
import { fetchAuthenticatedRoute } from '../api/fetchAuthenticatedRoute';
import { S3ConfigForm } from './s3.config.form';
import { markSetupWizardCompleted, getPostSetupRoute } from './setup.wizard.state';
import { router } from '../routes';

interface ExistingConfig {
    endpointUrl: string | null;
    bucketName: string | null;
    publicBaseUrl: string | null;
    accessKeyId: string | null;
    isConfigured: boolean;
}

interface SetupStep {
    id: string;
    title: string;
    render: () => JSX.Element;
}

const copyToClipboard = async (value: string) => {
    try {
        await navigator.clipboard.writeText(value);
        toast.success('Copied');
    } catch {
        toast.error('Copy failed');
    }
};

const FieldRow = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">{label}</div>
                <div className="mt-1 break-all rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                    {value}
                </div>
            </div>
            <button
                type="button"
                onClick={() => copyToClipboard(value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                Copy
            </button>
        </div>
    </div>
);

const StepSection = ({ title, children }: { title: string; children: JSX.Element | JSX.Element[] }) => (
    <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
);

const Setup = () => {
    const [config, setConfig] = useState<ExistingConfig | null>(null);
    const [stepIndex, setStepIndex] = useState(0);

    const tenantId = localStorage.getItem('tenantId');

    useEffect(() => {
        fetchAuthenticatedRoute('/tenant/s3-config')
            .then(res => res.json())
            .then((data: ExistingConfig) => setConfig(data));
    }, []);

    const importEndpoint = useMemo(() => {
        return `${constants.apiUrl.replace(/\/$/, '')}/import/s3`;
    }, []);

    const uploadSecret = tenantId ?? 'tenant-id-required';
    const uploadAccessKey = 'photoflow';
    const bucketName = tenantId ?? 'tenant-id-required';

    const completeWizard = () => {
        markSetupWizardCompleted(tenantId);
        router.navigate({ to: getPostSetupRoute() });
    };

    const advanceStep = () => {
        setStepIndex(current => Math.min(current + 1, steps.length - 1));
    };

    const retreatStep = () => {
        setStepIndex(current => Math.max(current - 1, 0));
    };

    const steps = useMemo<SetupStep[]>(() => {
        const result: SetupStep[] = [
            {
                id: 'about',
                title: 'Welcome to PhotoFlow',
                render: () => (
                    <div className="space-y-6">
                        <StepSection title="About the app">
                            <p>PhotoFlow is a progressive web app for browsing, organizing, and sharing your photo library. It gives you a clean gallery, albums, memories, and map views while keeping your original files in storage you control.</p>
                            <p>The app connects to the PhotoFlow API for browsing thumbnails, metadata, imports, and sharing. It is built for people who want a polished photo experience without giving up control of where the original files live.</p>
                        </StepSection>
                        <StepSection title="Core features">
                            <p><span className="font-medium text-slate-900">Gallery</span>, <span className="font-medium text-slate-900">Albums</span>, <span className="font-medium text-slate-900">Memories</span>, and <span className="font-medium text-slate-900">Map</span> help you explore the same library in different ways.</p>
                            <p>Public photo links should be treated as permanent access to that item. Album sharing works differently and uses a separate album-level share link.</p>
                        </StepSection>
                    </div>
                )
            },
            {
                id: 'mobile-setup',
                title: 'Importing Photos',
                render: () => (
                    <div className="space-y-6">
                        <StepSection title="How imports work">
                            <p>You can use any mobile app that can upload photos to an S3-compatible API. PhotoFlow exposes an S3-compatible import endpoint, so those apps can send files directly into your library.</p>
                            <p><span className="font-medium text-slate-900">PhotoSync</span> is the recommended option on iPhone and Android. Create a new S3 destination in PhotoSync and enter the values below.</p>
                        </StepSection>
                        <StepSection title="PhotoFlow import values">
                            <FieldRow label="Server / Endpoint URL" value={importEndpoint} />
                            <FieldRow label="Bucket Name" value={bucketName} />
                            <FieldRow label="Access Key ID" value={uploadAccessKey} />
                            <FieldRow label="Secret Access Key" value={uploadSecret} />
                        </StepSection>
                    </div>
                )
            },
            {
                id: 'finish',
                title: 'Setup complete',
                render: () => (
                    <div className="space-y-6">
                        <StepSection title="Next">
                            <p>You can start browsing immediately. If you skipped any step, you can come back later from the menu and run through this tutorial again.</p>
                        </StepSection>
                    </div>
                )
            }
        ];

        if (!config?.isConfigured) {
            result.splice(2, 0, {
                id: 'storage',
                title: 'Set up your storage bucket',
                render: () => (
                    <div className="space-y-6">
                        <StepSection title="Before you save">
                            <ol className="list-decimal space-y-2 pl-5">
                                <li>Create a bucket at your S3-compatible provider.</li>
                                <li>Make the bucket publicly accessible so PhotoFlow can serve files directly from it.</li>
                                <li>Create a write-capable API key for PhotoFlow to store original and processed files.</li>
                            </ol>
                        </StepSection>
                        <S3ConfigForm
                            onSaveSuccess={advanceStep}
                        />
                    </div>
                )
            });
        }

        return result;
    }, [advanceStep, bucketName, config?.isConfigured, importEndpoint, uploadSecret]);

    const currentStep = steps[stepIndex];
    const isLastStep = stepIndex === steps.length - 1;
    const isStorageStep = currentStep?.id === 'storage';

    useEffect(() => {
        setStepIndex(current => Math.min(current, steps.length - 1));
    }, [steps.length]);

    if (!config) {
        return <div className="p-5 text-slate-500">Loading…</div>;
    }

    return (
        <div className="flex min-h-full flex-1 flex-col bg-slate-50 px-6 py-8 pb-24 lg:px-8">
            <div className="mx-auto w-full max-w-3xl">
                <div className="mb-6 text-center">
                    <h2 className="text-3xl font-bold italic text-slate-900">
                        PhotoFlow
                    </h2>
                </div>
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-medium text-sky-700">
                                    Step {stepIndex + 1} of {steps.length}
                                </div>
                                <h1 className="mt-1 text-2xl font-semibold text-slate-900">{currentStep.title}</h1>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        {currentStep.render()}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                        <button
                            type="button"
                            onClick={retreatStep}
                            disabled={stepIndex === 0}
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                        >
                            Back
                        </button>

                        <div className="flex items-center gap-3">
                            {!isLastStep && isStorageStep && (
                                <button
                                    type="button"
                                    onClick={advanceStep}
                                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                                >
                                    Skip Step
                                </button>
                            )}
                            {isLastStep ? (
                                <button
                                    type="button"
                                    onClick={completeWizard}
                                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                                >
                                    Go To App
                                </button>
                            ) : !isStorageStep ? (
                                <button
                                    type="button"
                                    onClick={advanceStep}
                                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                                >
                                    Next
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Setup;
