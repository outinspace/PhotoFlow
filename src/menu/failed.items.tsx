import { useMemo } from 'react';
import { Download, Refresh, WarningTriangle } from 'iconoir-react';
import { formatDistanceToNow } from 'date-fns';
import { useItems } from "../api/useItems";
import { useReprocessItems } from '../api/useReprocessItems';
import { TopBar } from '../common/top.bar';
import { downloadFile } from '../common/share.helpers';
import { formatBytes } from '../common/format.helpers';
import { File } from '../types';

// A file that failed processing has no thumbnail and no placeholder, so showing
// these in the photo grid drew rows of invisible squares. A list of names is the
// only thing that can actually be read, and the original is still in the bucket —
// downloading it is how you find out what went wrong.

interface FailedFile {
    file: File;
}

const FailedRow = ({ entry, onReprocess }: { entry: FailedFile; onReprocess: () => void }) => (
    <div className='flex items-center gap-3 border-b border-slate-100 last:border-0 px-4 py-3'>
        <WarningTriangle className='size-5 shrink-0 text-amber-500' />

        <div className='min-w-0 flex-auto'>
            <div className='truncate font-mono text-sm text-slate-800'>{entry.file.originalFileName}</div>
            <div className='mt-0.5 text-xs text-slate-500'>
                {formatBytes(entry.file.sizeBytes)}
                {entry.file.failedProcessingTimeUtc && (
                    <> · failed {formatDistanceToNow(new Date(entry.file.failedProcessingTimeUtc), { addSuffix: true })}</>
                )}
            </div>
        </div>

        <button
            type='button'
            onClick={onReprocess}
            title='Queue for reprocessing'
            className='flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
        >
            <Refresh className='size-4' />
        </button>
        <button
            type='button'
            onClick={() => downloadFile(entry.file)}
            title='Download the original'
            className='flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
        >
            <Download className='size-4' />
        </button>
    </div>
);

export const FailedItems = () => {
    const { data, isLoading } = useItems();
    const reprocess = useReprocessItems();

    const failed = useMemo<FailedFile[]>(() => {
        return (data ?? []).flatMap(item =>
            item.files
                .filter(file => !!file.failedProcessingTimeUtc)
                .map(file => ({ file }))
        );
    }, [data]);

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Failed Items' />

            <div className='flex-auto overflow-auto tabbar-pad'>
                <div className='mx-auto w-full max-w-2xl px-5'>
                {isLoading ? (
                    // Saying nothing failed while the catalog is still loading would
                    // be a claim, not a placeholder.
                    <div className='rounded-2xl bg-white p-4 text-sm text-slate-500'>Loading…</div>
                ) : failed.length === 0 ? (
                    <div className='rounded-2xl bg-white p-4 text-sm text-slate-500'>
                        Nothing has failed processing. Anything that does will be listed here.
                    </div>
                ) : (
                    <>
                        <div className='flex items-center justify-between gap-3 pb-4'>
                            <p className='text-sm text-slate-600'>
                                {failed.length} file{failed.length === 1 ? '' : 's'} could not be processed. The
                                originals are safe in your bucket — only the thumbnails and previews are missing.
                            </p>
                            <button
                                type='button'
                                disabled={reprocess.isPending}
                                onClick={() => reprocess.mutate(failed.map(entry => entry.file))}
                                className='shrink-0 rounded-full bg-sky-600 px-5 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-40'
                            >
                                Retry all
                            </button>
                        </div>

                        <div className='rounded-2xl bg-white overflow-hidden'>
                        {failed.map(entry => (
                            <FailedRow
                                key={entry.file.fileId}
                                entry={entry}
                                onReprocess={() => reprocess.mutate([entry.file])}
                            />
                        ))}
                        </div>
                    </>
                )}
                </div>
            </div>
        </div>
    );
}
