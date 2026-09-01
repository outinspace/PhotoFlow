import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { TopBar } from '../common/top.bar';
import { getStorageConfig, resolvePublicBaseUrl, resolveRegion } from '../storage/config';
import { StorageConnectionForm } from '../setup/storage.connection.form';
import { useHeartbeat } from '../storage/heartbeat';
import { useIncomingQueue } from '../storage/incoming';
import { useCatalog } from '../api/useItems';
import { formatBytes } from '../common/format.helpers';

// Where this browser is connected, and how the processing job that fills that
// bucket is doing. Editing happens in place rather than on the first-run screen,
// which is what keeps the navigation bar around so there is a way back out.
//
// The secret key is deliberately never displayed — it is held for signing, not for
// reading back.
const Row = ({ label, value }: { label: string; value: string }) => (
    <div className='border-b border-slate-100 px-4 py-3'>
        <div className='text-xs text-slate-500'>{label}</div>
        <div className='mt-0.5 break-all font-mono text-sm text-slate-800'>{value}</div>
    </div>
);

// Photos that have arrived but have not been processed yet.
//
// The catalog cannot answer this: an upload has no catalog entry until the worker
// has been over it, so anything waiting is invisible everywhere else in the app.
const IncomingQueue = () => {
    const { data: queue, isLoading } = useIncomingQueue();

    if (isLoading || !queue) {
        return null;
    }

    if (queue.count === 0) {
        return (
            <div className='rounded-lg bg-slate-50 p-4 text-sm text-slate-600'>
                Nothing waiting. Everything uploaded has been processed.
            </div>
        );
    }

    return (
        <div className='rounded-lg bg-sky-50 p-4 text-sm text-sky-900'>
            <div className='font-medium'>
                {queue.truncated ? '1000+' : queue.count} file{queue.count === 1 ? '' : 's'} waiting
                {' · '}{formatBytes(queue.bytes)}
            </div>
            <p className='mt-1'>
                These are uploaded and safe. They appear in your library after the next
                processing run.
            </p>
            <div className='mt-2 font-mono text-xs text-sky-800'>
                {queue.names.slice(0, 5).map(name => <div key={name}>{name}</div>)}
                {queue.count > 5 && <div>…and {queue.count - 5} more</div>}
            </div>
        </div>
    );
};

// With no server to alert on a stalled pipeline, this is where a missed nightly
// run becomes visible. The worker writes its own record of each run.
const ProcessingStatus = () => {
    const { data: heartbeat, isLoading } = useHeartbeat();
    const { data: catalog } = useCatalog();

    return (
        <div className='space-y-3 border-t border-slate-100 p-4'>
            <h2 className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Processing</h2>

            <IncomingQueue />

            {isLoading && <div className='text-sm text-slate-500'>Loading…</div>}

            {!isLoading && !heartbeat && (
                <div className='rounded-lg bg-amber-50 p-4 text-sm text-amber-900'>
                    No run has been recorded yet. Once the processing job runs for the
                    first time, its result appears here.
                </div>
            )}

            {heartbeat && (
                <>
                    <div className={`rounded-lg p-4 text-sm ${heartbeat.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
                        <div className='font-medium'>
                            {heartbeat.ok ? 'Last run succeeded' : 'Last run failed'}
                        </div>
                        <div className='mt-1'>
                            {formatDistanceToNow(new Date(heartbeat.finishedAt), { addSuffix: true })}
                        </div>
                    </div>

                    <div className='space-y-1'>
                        {heartbeat.steps.map(step => (
                            <div key={step.name} className='flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm'>
                                <span className={step.failed ? 'text-red-600' : 'text-slate-700'}>{step.name}</span>
                                <span className='font-mono text-xs text-slate-500'>{step.seconds}s</span>
                            </div>
                        ))}
                    </div>

                    {heartbeat.notes.length > 0 && (
                        <div className='rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600'>
                            {heartbeat.notes.map((note, index) => <div key={index}>{note}</div>)}
                        </div>
                    )}
                </>
            )}

            {catalog && (
                <div className='text-xs text-slate-500'>
                    Catalog generated {formatDistanceToNow(new Date(catalog.manifest.generatedAt), { addSuffix: true })}
                    {' · '}{catalog.manifest.counts.items} items across {catalog.manifest.shards.length} shards
                </div>
            )}
        </div>
    );
};

const StorageSettings = () => {
    const [editing, setEditing] = useState(false);
    // Re-read after an edit so the rows show what was just saved.
    const [savedAt, setSavedAt] = useState(0);
    const config = getStorageConfig();

    if (editing) {
        return (
            <div className='flex flex-auto flex-col overflow-hidden'>
                <TopBar title='Storage' />

                <div className='mx-auto w-full max-w-lg flex-auto overflow-auto p-5'>
                    <StorageConnectionForm
                        submitLabel='Save connection'
                        onCancel={() => setEditing(false)}
                        onConnected={() => {
                            setSavedAt(Date.now());
                            setEditing(false);
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div key={savedAt} className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Storage' />

            <div className='flex-auto overflow-auto'>
            {config ? (
                <>
                    <Row label='Endpoint' value={config.endpoint} />
                    <Row label='Bucket' value={config.bucket} />
                    <Row label='Region' value={`${resolveRegion(config)}${config.region ? '' : ' (from endpoint)'}`} />
                    <Row label='Public base URL' value={`${resolvePublicBaseUrl(config)}${config.publicBaseUrl ? '' : ' (bucket, no CDN)'}`} />
                    <Row label='Access key ID' value={config.accessKeyId} />

                    <div className='p-4'>
                        <button
                            type='button'
                            onClick={() => setEditing(true)}
                            className='rounded-md px-3 py-2 text-sm/6 font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                        >
                            Change connection
                        </button>
                    </div>

                    <ProcessingStatus />
                </>
            ) : (
                <div className='p-4 text-sm text-slate-500'>No storage connected.</div>
            )}
            </div>
        </div>
    );
};

export default StorageSettings;
