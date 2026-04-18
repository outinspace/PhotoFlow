import { useMemo } from 'react';
import { useEventsStatus } from '../api/useSystemStatus';
import { TopBar } from '../common/top.bar';

const Bucket = ({ title, counts, tone }: { title: string; counts: Record<string, number>; tone: 'pending' | 'inFlight' | 'failed' }) => {
    const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    const total = entries.reduce((sum, [, n]) => sum + n, 0);

    const toneStyles: Record<typeof tone, { total: string; pill: string; ring: string }> = {
        pending: { total: 'text-slate-700', pill: 'bg-slate-100 text-slate-700', ring: 'ring-slate-200' },
        inFlight: { total: 'text-sky-700', pill: 'bg-sky-50 text-sky-700', ring: 'ring-sky-200' },
        failed: { total: 'text-red-700', pill: 'bg-red-50 text-red-700', ring: 'ring-red-200' },
    };
    const styles = toneStyles[tone];

    return (
        <div className={`flex-1 rounded-lg bg-white p-4 ring-1 ${styles.ring}`}>
            <div className='text-xs font-semibold uppercase tracking-wider text-slate-400'>{title}</div>
            <div className={`mt-1 text-3xl font-semibold ${styles.total}`}>{total.toLocaleString()}</div>
            {entries.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-1.5'>
                    {entries.map(([type, count]) => (
                        <span key={type} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${styles.pill}`}>
                            <span className='font-mono'>{type}</span>
                            <span className='font-semibold'>{count.toLocaleString()}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const SystemStatus = () => {
    const { data, isLoading, error } = useEventsStatus();

    const grandTotal = useMemo(() => {
        if (!data) return 0;
        return sumCounts(data.pending) + sumCounts(data.inFlight) + sumCounts(data.failed);
    }, [data]);

    return (
        <div>
            <TopBar title='System Status' />
            <div className='p-5'>

                {error && (
                    <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200'>
                        Failed to load status.
                    </div>
                )}

                {isLoading && !data && (
                    <div className='text-sm text-slate-500'>Loading…</div>
                )}

                {data && (
                    <>
                        <div className='rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200'>
                            <div className='text-xs font-semibold uppercase tracking-wider text-slate-400'>Events in queue</div>
                            <div className='mt-1 text-4xl font-semibold text-slate-800'>{grandTotal.toLocaleString()}</div>
                            {data.oldestPendingUtc && (
                                <div className='mt-1 text-xs text-slate-500'>
                                    Oldest pending lock: {new Date(data.oldestPendingUtc).toLocaleString()}
                                </div>
                            )}
                        </div>

                        <div className='mt-4 flex flex-col gap-3 md:flex-row'>
                            <Bucket title='Pending' counts={data.pending} tone='pending' />
                            <Bucket title='In-flight' counts={data.inFlight} tone='inFlight' />
                            <Bucket title='Failed' counts={data.failed} tone='failed' />
                        </div>

                        <div className='mt-3 text-xs text-slate-400'>Auto-refreshes every 5 seconds.</div>
                    </>
                )}
            </div>
        </div>
    );
};

const sumCounts = (counts: Record<string, number>) =>
    Object.values(counts).reduce((sum, n) => sum + n, 0);

export default SystemStatus;
