import { useEffect, useState } from 'react';
import constants from '../constants';
import { endSessionAndGoToLogin, getSession } from '../common/session';

interface S3ConfigFormProps {
    /** Existing config to pre-populate fields (minus the secret key). */
    existingConfig?: {
        endpointUrl?: string | null;
        bucketName?: string | null;
        publicBaseUrl?: string | null;
        accessKeyId?: string | null;
        isConfigured?: boolean;
    };
    onSaveSuccess: () => void;
}

function derivePublicBaseUrl(endpointUrl: string, bucketName: string): string {
    const base = endpointUrl.trim().replace(/\/$/, '');
    const bucket = bucketName.trim();
    if (!base || !bucket) return '';
    return `${base}/${bucket}`;
}

export const S3ConfigForm = ({ existingConfig, onSaveSuccess }: S3ConfigFormProps) => {
    const [endpointUrl, setEndpointUrl] = useState(existingConfig?.endpointUrl ?? '');
    const [bucketName, setBucketName] = useState(existingConfig?.bucketName ?? '');
    const [publicBaseUrl, setPublicBaseUrl] = useState(existingConfig?.publicBaseUrl ?? '');
    const [publicBaseUrlOverridden, setPublicBaseUrlOverridden] = useState(!!existingConfig?.publicBaseUrl);
    const [accessKeyId, setAccessKeyId] = useState(existingConfig?.accessKeyId ?? '');
    const [secretAccessKey, setSecretAccessKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!publicBaseUrlOverridden) {
            setPublicBaseUrl(derivePublicBaseUrl(endpointUrl, bucketName));
        }
    }, [endpointUrl, bucketName, publicBaseUrlOverridden]);

    const handlePublicBaseUrlChange = (value: string) => {
        setPublicBaseUrl(value);
        setPublicBaseUrlOverridden(true);
    };

    const handleResetPublicBaseUrl = () => {
        setPublicBaseUrlOverridden(false);
        setPublicBaseUrl(derivePublicBaseUrl(endpointUrl, bucketName));
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setWarnings([]);
        setSuccess(false);

        try {
            const session = getSession();

            const res = await fetch(constants.apiUrl + '/tenant/s3-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Session ' + (session?.sessionId ?? ''),
                    'x-tenant-id': session?.tenantId ?? '',
                },
                body: JSON.stringify({
                    endpointUrl: endpointUrl.trim(),
                    bucketName: bucketName.trim(),
                    publicBaseUrl: publicBaseUrl.trim(),
                    accessKeyId: accessKeyId.trim(),
                    secretAccessKey,
                }),
            });

            if (res.status === 401) {
                endSessionAndGoToLogin();
                return;
            }

            if (res.ok) {
                const body = await res.json();
                if (body.warnings?.length > 0) {
                    setWarnings(body.warnings);
                } else {
                    onSaveSuccess();
                }
                setSuccess(true);
            } else {
                const text = await res.text();
                setError(text.replace(/^"|"$/g, ''));
            }
        } catch (e: any) {
            setError(e?.message ?? 'An unexpected error occurred.');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = "block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm/6";
    const labelClass = "block text-sm/6 font-medium text-gray-900";
    const helpClass = "mt-1 text-xs text-gray-500";

    return (
        <div className="space-y-6">
            <div>
                <label className={labelClass}>S3 Endpoint URL</label>
                <div className="mt-1">
                    <input
                        type="text"
                        value={endpointUrl}
                        onChange={e => setEndpointUrl(e.target.value)}
                        placeholder="https://s3.us-west-004.backblazeb2.com"
                        className={inputClass}
                    />
                </div>
                <p className={helpClass}>The S3-compatible API endpoint for your provider.</p>
            </div>

            <div>
                <label className={labelClass}>Bucket Name</label>
                <div className="mt-1">
                    <input
                        type="text"
                        value={bucketName}
                        onChange={e => setBucketName(e.target.value)}
                        placeholder="my-photoflow-bucket"
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <div className="flex items-baseline justify-between">
                    <label className={labelClass}>Public Base URL</label>
                    {publicBaseUrlOverridden && (
                        <button
                            type="button"
                            onClick={handleResetPublicBaseUrl}
                            className="text-xs text-sky-600 hover:text-sky-500"
                        >
                            Reset to derived
                        </button>
                    )}
                </div>
                <div className="mt-1">
                    <input
                        type="text"
                        value={publicBaseUrl}
                        onChange={e => handlePublicBaseUrlChange(e.target.value)}
                        placeholder="https://my-photoflow-bucket.s3.us-west-004.backblazeb2.com"
                        className={inputClass}
                    />
                </div>
                <p className={helpClass}>
                    Derived from your endpoint and bucket name. Override if your provider uses a different public URL (e.g. Backblaze B2's download subdomain or a custom CDN domain).
                </p>
            </div>

            <div>
                <label className={labelClass}>Access Key ID</label>
                <div className="mt-1">
                    <input
                        type="text"
                        value={accessKeyId}
                        onChange={e => setAccessKeyId(e.target.value)}
                        placeholder="keyId123"
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <label className={labelClass}>Secret Access Key</label>
                <div className="mt-1">
                    <input
                        type="password"
                        value={secretAccessKey}
                        onChange={e => setSecretAccessKey(e.target.value)}
                        placeholder={existingConfig?.isConfigured ? '••••••••' : ''}
                        className={inputClass}
                    />
                </div>
                <p className={helpClass}>
                    {existingConfig?.isConfigured
                        ? 'Leave blank to keep your saved secret. Enter a new value to replace it.'
                        : 'Encrypted before being stored.'}
                </p>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800 space-y-3">
                    <p className="font-medium">Configuration saved with warnings:</p>
                    {warnings.map((w, i) => <p key={i}>{w}</p>)}
                    <button
                        type="button"
                        onClick={onSaveSuccess}
                        className="mt-1 text-sm font-medium text-yellow-900 underline hover:no-underline"
                    >
                        I understand, continue
                    </button>
                </div>
            )}

            {success && warnings.length === 0 && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    S3 configuration saved successfully.
                </div>
            )}

            <div className="pb-8">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex w-full justify-center rounded-md bg-sky-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {saving ? 'Testing & Saving…' : 'Test & Save'}
                </button>
            </div>
        </div>
    );
};
