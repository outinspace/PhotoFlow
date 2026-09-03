import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getStorageConfig, normalizeConfig, saveStorageConfig, StorageConfig } from '../storage/config';
import { CORS_RULE_EXAMPLE, verifyConnection, VerifyFailure } from '../storage/verify';
import { clearCachedCatalog } from '../storage/catalog';
import { queryClient } from '../app';

// The bucket connection form, shared by first-run setup and the storage settings
// page. It verifies and saves, then hands back — where to go next differs between
// the two, so the caller decides that.

const BLANK: StorageConfig = {
    endpoint: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: ''
};

// Values are monospaced because every one of them is an endpoint or a key, where
// a single wrong character is the whole problem.
const Field = ({ label, hint, value, onChange, type = 'text', placeholder }: {
    label: string;
    hint?: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
}) => (
    <label className='block'>
        <span className='block text-sm/6 font-medium text-gray-900'>{label}</span>
        {hint && <span className='mb-1 block text-xs text-gray-500'>{hint}</span>}
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={event => onChange(event.target.value)}
            className='mt-1 block w-full rounded-md border-0 p-2 font-mono text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-500'
        />
    </label>
);

const Notice = ({ tone, title, children }: {
    tone: 'amber' | 'red';
    title: string;
    children: React.ReactNode;
}) => (
    <div className={`rounded-lg p-4 text-sm ${tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-900'}`}>
        <div className='font-medium'>{title}</div>
        <div className='mt-1 space-y-2'>{children}</div>
    </div>
);

const CorsHelp = () => (
    <>
        <p>
            Your bucket needs a CORS rule that lets this page talk to it. Most providers’
            “make it public” preset only allows <code>GET</code> and <code>HEAD</code>, which is
            enough to show photos but not to upload one or favourite anything.
        </p>
        <pre className='overflow-x-auto rounded bg-white/60 p-2 text-xs'>{CORS_RULE_EXAMPLE}</pre>
        <p className='text-xs'>
            On Backblaze B2 the built-in “share everything” preset is read-only — add a custom rule
            with the <code>s3_put</code> operation. Note that once a B2 bucket has native CORS rules,
            they can only be edited through B2’s own console or API, not the S3 one.
        </p>
    </>
);

const FAILURE_TITLES: Record<VerifyFailure, string> = {
    'insecure-context': 'This page is not a secure context',
    'unreachable': 'Could not reach that endpoint',
    'cors-reads': 'The bucket is not allowing this app to read it',
    'cors-signed': 'The bucket is not allowing signed requests',
    'bad-credentials': 'Those credentials were rejected',
    'no-such-bucket': 'No such bucket',
    'no-list-permission': 'That key cannot list the bucket',
    'no-write-permission': 'That key cannot write to the bucket',
    'bucket-is-public': 'That bucket is readable by anyone',
    'cdn-rejects-signatures': 'That CDN is changing the request',
    'cdn-unreachable': 'Could not read pictures from that CDN',
    'unknown': 'Could not connect'
};

// Named per provider because "make it private" is in a different place in each, and
// the setting is easy to look straight past.
const PRIVACY_HINTS: { match: RegExp; hint: React.ReactNode }[] = [
    {
        match: /backblazeb2\.com/,
        hint: <>In B2, open the bucket, choose <strong>Bucket Settings</strong>, and set
            <strong> Files in Bucket</strong> to <strong>Private</strong>.</>
    },
    {
        match: /r2\.cloudflarestorage\.com/,
        hint: <>In R2, open the bucket’s <strong>Settings</strong> and turn off
            <strong> Public Development URL</strong>, plus any custom domain serving it.</>
    },
    {
        match: /amazonaws\.com/,
        hint: <>In S3, open the bucket’s <strong>Permissions</strong> tab, turn
            <strong> Block all public access</strong> on, and remove any bucket policy
            granting <code>s3:GetObject</code> to <code>*</code>.</>
    }
];

interface Props {
    onConnected: () => void;
    onCancel?: () => void;
    submitLabel?: string;
    // A connection received from another device, applied without waiting for the
    // person to press anything.
    autoConnectWith?: StorageConfig | null;
}

export const StorageConnectionForm = ({ onConnected, onCancel, submitLabel = 'Connect', autoConnectWith }: Props) => {
    const [config, setConfig] = useState<StorageConfig>(autoConnectWith ?? getStorageConfig() ?? BLANK);
    const [testing, setTesting] = useState(false);
    const [failure, setFailure] = useState<VerifyFailure | null>(null);
    const [detail, setDetail] = useState<string | undefined>();

    const update = (field: keyof StorageConfig) => (value: string) =>
        setConfig(current => ({ ...current, [field]: value }));

    const connect = useCallback(async (override?: StorageConfig) => {
        setTesting(true);
        setFailure(null);

        try {
            let candidate = normalizeConfig(override ?? config);
            let result = await verifyConnection(candidate);

            // The provider told us the region it expected, so use it rather than
            // making the user go and find it.
            if (!result.ok && result.correctedRegion) {
                candidate = { ...candidate, region: result.correctedRegion };
                result = await verifyConnection(candidate);
            }

            if (!result.ok) {
                setFailure(result.failure ?? 'unknown');
                setDetail(result.detail);
                return;
            }

            const previous = getStorageConfig();
            const changedBucket = previous
                && (previous.endpoint !== candidate.endpoint || previous.bucket !== candidate.bucket);

            saveStorageConfig(candidate);

            // A different bucket means the cached library belongs to something else.
            if (changedBucket) {
                await clearCachedCatalog();
                queryClient.clear();
            }

            toast.success('Connected');
            onConnected();
        } finally {
            setTesting(false);
        }
    }, [config, onConnected]);

    useEffect(() => {
        if (autoConnectWith) {
            void connect(autoConnectWith);
        }
    }, [autoConnectWith]);

    const isComplete = config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey;

    return (
        <div className='flex flex-col gap-6'>
            {failure && (
                <Notice tone={failure === 'insecure-context' ? 'amber' : 'red'} title={FAILURE_TITLES[failure]}>
                    {failure === 'insecure-context' && (
                        <p>
                            Photoflow signs its own requests to your bucket, and browsers only provide the
                            crypto for that over HTTPS — or over plain http on <code>localhost</code> exactly.
                            At <code>{window.location.origin}</code> it is unavailable. Open the app at{' '}
                            <code>http://localhost</code>, or serve it over HTTPS.
                        </p>
                    )}

                    {failure === 'unreachable' && (
                        <p>
                            Nothing answered at <code>{detail}</code>. Check the endpoint URL.
                        </p>
                    )}

                    {(failure === 'cors-reads' || failure === 'cors-signed') && (
                        <>
                            {failure === 'cors-signed' && (
                                <p>
                                    Reads work, so the bucket and URL are right — but the preflight for a signed
                                    request was rejected. This is the usual sign of a read-only CORS rule.
                                </p>
                            )}
                            <CorsHelp />
                        </>
                    )}

                    {failure === 'bad-credentials' && (
                        <p>Check the access key ID and secret. The provider reported <code>{detail}</code>.</p>
                    )}

                    {failure === 'no-such-bucket' && (
                        <p>
                            The endpoint answered but has no bucket called <code>{config.bucket}</code>. Check the
                            spelling, and that the key belongs to the same account.
                        </p>
                    )}

                    {failure === 'no-list-permission' && (
                        <p>
                            The key reached the bucket but is not allowed to list it. Photoflow needs list
                            because it discovers your other devices’ changes under <code>meta/log/</code>.
                            Give this key read, write and list on this bucket.
                        </p>
                    )}

                    {failure === 'cdn-rejects-signatures' && (
                        <p>
                            <code>{detail}</code> answered, but storage refused the signature on the way
                            through. Photoflow signs each picture’s URL for the host it is asked for, and
                            the signature covers both the host and the path — so the CDN has to forward
                            them to the bucket unchanged. Check that it preserves the <code>Host</code>
                            header and does not add or strip a path prefix. Leave the field blank to read
                            pictures straight from the bucket instead.
                        </p>
                    )}

                    {failure === 'cdn-unreachable' && (
                        <p>
                            Nothing usable answered at <code>{detail}</code>. Either it cannot be reached,
                            or it does not return CORS headers for this app’s origin. Everything else is
                            working — leave the field blank and pictures load from the bucket directly.
                        </p>
                    )}

                    {failure === 'no-write-permission' && (
                        <p>
                            The key can read and list the bucket but not write to it. Photoflow needs
                            write, because uploads, favourites and albums are all written straight from
                            this browser. Give this key read, write and list on this bucket.
                            The provider said <code>{detail}</code>.
                        </p>
                    )}

                    {failure === 'bucket-is-public' && (
                        <>
                            <p>
                                Anyone can read objects from <code>{config.bucket}</code> without
                                credentials, so Photoflow will not connect to it.
                            </p>
                            <p>
                                Photoflow keeps your photo index at fixed paths — <code>catalog/manifest.json</code>{' '}
                                and the shards it lists. On a private bucket that is safe, because reading
                                any of it needs a signature. On a public one, anyone who finds or guesses
                                the bucket can fetch that index, and it names the location, camera, filename
                                and stored file of every photo you have. Photo files themselves are named by
                                content hash, but the index is the list of those hashes.
                            </p>
                            <p>
                                Nothing here needs public access: this app signs every read in your browser
                                with the key above. Make the bucket private and connect again.
                            </p>
                            {PRIVACY_HINTS.find(({ match }) => match.test(config.endpoint))?.hint
                                ? <p>{PRIVACY_HINTS.find(({ match }) => match.test(config.endpoint))!.hint}</p>
                                : null}
                        </>
                    )}

                    {failure === 'unknown' && (
                        <p>The provider said: <code>{detail || 'no details'}</code>.</p>
                    )}
                </Notice>
            )}

            <div className='space-y-4'>
                <Field
                    label='S3 endpoint'
                    hint='Your provider’s API endpoint. The region is worked out from it.'
                    placeholder='https://s3.us-west-004.backblazeb2.com'
                    value={config.endpoint}
                    onChange={update('endpoint')}
                />
                <Field label='Bucket name' value={config.bucket} onChange={update('bucket')} />
                <Field label='Access key ID' value={config.accessKeyId} onChange={update('accessKeyId')} />
                <Field
                    label='Secret access key'
                    type='password'
                    value={config.secretAccessKey}
                    onChange={update('secretAccessKey')}
                />
                <Field
                    label='CDN Base URL (Optional)'
                    hint='A CDN in front of your bucket, used for photos and videos only — the catalog and your edits always go straight to the bucket. Worth setting: the gallery loads hundreds of thumbnails at once, and a CDN serves them over one multiplexed connection where a bucket endpoint allows about six. It has to pass the host and path through to the bucket unchanged, which is checked when you connect. Leave blank to read from the bucket.'
                    placeholder='https://photos.example.com'
                    value={config.publicBaseUrl ?? ''}
                    onChange={update('publicBaseUrl')}
                />
            </div>

            <div className='flex gap-2'>
                <button
                    type='button'
                    disabled={!isComplete || testing}
                    onClick={() => connect()}
                    className='flex flex-1 justify-center rounded-md bg-sky-600 px-3 py-2 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-40'
                >
                    {testing ? 'Checking…' : submitLabel}
                </button>
                {onCancel && (
                    <button
                        type='button'
                        onClick={onCancel}
                        disabled={testing}
                        className='rounded-md px-3 py-2 text-sm/6 font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
