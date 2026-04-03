import { useState } from 'react';
import constants from '../constants';
import { router } from '../routes';

interface S3ConfigFormProps {
    /** Existing config to pre-populate fields (minus the secret key). */
    existingConfig?: {
        endpointUrl?: string | null;
        bucketName?: string | null;
        publicBaseUrl?: string | null;
        accessKeyId?: string | null;
    };
    onSaveSuccess: () => void;
}

interface FieldInfo {
    id: string;
    label: string;
    help: string;
    placeholder: string;
    type?: string;
}

const fields: FieldInfo[] = [
    {
        id: 'endpointUrl',
        label: 'S3 Endpoint URL',
        help: 'The S3-compatible API endpoint for your provider. For Backblaze B2 this looks like https://s3.us-west-004.backblazeb2.com. For Cloudflare R2 it is https://<account-id>.r2.cloudflarestorage.com.',
        placeholder: 'https://s3.us-west-004.backblazeb2.com',
    },
    {
        id: 'bucketName',
        label: 'Bucket Name',
        help: 'The name of your S3 bucket.',
        placeholder: 'my-photoflow-bucket',
    },
    {
        id: 'publicBaseUrl',
        label: 'Public Base URL',
        help: 'The public URL prefix used to fetch files directly from the bucket. This is the URL your browser will use to load photos. For Backblaze B2 it is typically https://f005.backblazeb2.com/file/<bucket-name> or your custom CDN domain.',
        placeholder: 'https://f005.backblazeb2.com/file/my-photoflow-bucket',
    },
    {
        id: 'accessKeyId',
        label: 'Access Key ID',
        help: 'The S3 access key ID. This is not sensitive and is stored in plaintext.',
        placeholder: 'keyId123',
    },
    {
        id: 'secretAccessKey',
        label: 'Secret Access Key',
        help: 'The S3 secret access key. This is encrypted before being stored. Your key should have only GetObject and PutObject permissions — no ListBucket or DeleteObject.',
        placeholder: '',
        type: 'password',
    },
];

export const S3ConfigForm = ({ existingConfig, onSaveSuccess }: S3ConfigFormProps) => {
    const [values, setValues] = useState({
        endpointUrl: existingConfig?.endpointUrl ?? '',
        bucketName: existingConfig?.bucketName ?? '',
        publicBaseUrl: existingConfig?.publicBaseUrl ?? '',
        accessKeyId: existingConfig?.accessKeyId ?? '',
        secretAccessKey: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setWarnings([]);
        setSuccess(false);

        try {
            const sessionId = localStorage.getItem('sessionId') ?? '';
            const tenantId = localStorage.getItem('tenantId') ?? '';

            const res = await fetch(constants.apiUrl + '/tenant/s3-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Session ' + sessionId,
                    'x-tenant-id': tenantId,
                },
                body: JSON.stringify({
                    endpointUrl: values.endpointUrl.trim(),
                    bucketName: values.bucketName.trim(),
                    publicBaseUrl: values.publicBaseUrl.trim(),
                    accessKeyId: values.accessKeyId.trim(),
                    secretAccessKey: values.secretAccessKey,
                }),
            });

            if (res.status === 401) {
                localStorage.removeItem('tenantId');
                localStorage.removeItem('sessionId');
                localStorage.removeItem('s3Configured');
                router.navigate({ to: '/login' });
                return;
            }

            if (res.ok) {
                const body = await res.json();
                if (body.warnings?.length > 0) {
                    setWarnings(body.warnings);
                }
                setSuccess(true);
                onSaveSuccess();
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

    return (
        <div className="space-y-6">
            {fields.map(field => (
                <div key={field.id}>
                    <label className="block text-sm/6 font-medium text-gray-900">
                        {field.label}
                    </label>
                    <div className="mt-1">
                        <input
                            type={field.type ?? 'text'}
                            value={(values as any)[field.id]}
                            onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm/6"
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{field.help}</p>
                </div>
            ))}

            {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    {error}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 space-y-1">
                    <p className="font-medium">Configuration saved with warnings:</p>
                    {warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
            )}

            {success && warnings.length === 0 && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    S3 configuration saved successfully.
                </div>
            )}

            <div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex w-full justify-center rounded-md bg-sky-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {saving ? 'Testing & Saving…' : 'Test & Save'}
                </button>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
                <p className="font-medium">Required API key permissions:</p>
                <ul className="list-disc list-inside space-y-0.5">
                    <li>GetObject — to serve photos to the browser</li>
                    <li>PutObject — to upload new photos</li>
                </ul>
                <p className="font-medium mt-2">Do NOT grant these permissions:</p>
                <ul className="list-disc list-inside space-y-0.5">
                    <li>ListBucket — prevents directory enumeration</li>
                    <li>DeleteObject — prevents accidental deletion via the API key</li>
                </ul>
            </div>
        </div>
    );
};
