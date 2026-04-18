import { Activity, Database, Download, Learning, LogOut, Refresh, RefreshDouble, Settings, Trash, WarningTriangle } from 'iconoir-react';
import React, { useMemo } from 'react';
import { router } from '../routes';
import PageHeader from '../common/page.header';
import { fetchAuthenticatedRoute } from '../api/fetchAuthenticatedRoute';
import { useGallery } from '../api/useGallery';
import { formatBytes } from '../common/format.helpers';
import { useDebugMode } from '../hooks/use.debug.mode';
import { queryClient } from '../app';
import UploadButton from './upload.button';

const commonOptions = [
    {
        name: 'Settings',
        icon: Settings,
        onClick: () => {
            router.navigate({ to: '/settings' });
        }
    },
    {
        name: 'Recently Deleted Items',
        icon: Trash,
        onClick: () => {
            router.navigate({ to: '/recently-deleted' });
        }
    },
    {
        name: 'Setup Tutorial',
        icon: Learning,
        onClick: () => {
            router.navigate({ to: '/setup' });
        }
    },
    {
        name: 'Logout',
        icon: LogOut,
        onClick: () => {
            queryClient.clear();
            localStorage.removeItem('tenantId');
            localStorage.removeItem('sessionId');
            router.navigate({ to: '/login' });
        }
    },
];

const advancedOptions = [
    {
        name: 'Items In-Process',
        icon: RefreshDouble,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/items-in-process' });
        }
    },
    {
        name: 'Failed Items',
        icon: WarningTriangle,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/failed-items' });
        }
    },
    {
        name: 'Storage Settings',
        icon: Database,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/storage-settings' });
        }
    },
    {
        name: 'Export Your Data',
        icon: Download,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/export-data' });
        }
    },
    {
        name: 'Reprocess Failed Items',
        icon: Refresh,
        debug: true,
        onClick: async () => {
            const res = await fetchAuthenticatedRoute(`/debug/reprocess-failed`, {
                method: 'POST'
            });

            alert(res.status + ' ' + res.statusText);
        }
    },
    {
        name: 'System Status',
        icon: Activity,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/system-status' });
        }
    }
];

const MenuSection = ({ options }: { options: { name: string; icon: React.ElementType; onClick: () => void }[] }) => (
    <div>
        {options.map(option => (
            <div
                key={option.name}
                className='flex first:rounded-t-lg last:rounded-b-lg bg-slate-100 p-2 border-b border-slate-200 last:border-0 transition-all hover:bg-slate-200 active:bg-slate-300'
                onClick={option.onClick}
            >
                <option.icon className='mr-2' />
                {option.name}
            </div>
        ))}
    </div>
);

const Menu = () => {
    const showDebugOptions = useDebugMode();
    const visibleAdvancedOptions = advancedOptions.filter(option => !option.debug || showDebugOptions);

    return (
        <div className='p-5'>
            <div className='flex justify-between'>
                <PageHeader name='Menu' />
                <UploadButton />
            </div>
            <MenuSection options={commonOptions} />
            <div className='mt-5'>
                <div className='text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2'>Advanced</div>
                <MenuSection options={visibleAdvancedOptions} />
            </div>
            <GalleryStats />
        </div>
    );
};

const GalleryStats = () => {
    const { data: gallery } = useGallery();
    const items = gallery?.items ?? [];

    const photosCount = useMemo(() => {
        return items
            .filter(item =>
                item.files.some(file => file.contentType.startsWith('image')))
            .length
    }, [items]);

    const videosCount = useMemo(() => {
        return items
            .filter(item =>
                item.files.length === 1 && item.files[0].contentType.startsWith('video'))
            .length
    }, [items]);

    const formattedBytes = useMemo(() => {
        const bytes = items
            .flatMap(item => item.files)
            .reduce((bytes, file) => bytes + file.sizeBytes, 0);

        return formatBytes(bytes);
    }, [items]);

    const processingItemsCount = useMemo(() =>
        items.filter(i => i.files.some(f => f.lastProcessedTimeUtc === null && !f.failedProcessingTimeUtc)).length,
        [items]);

    // @ts-ignore
    const commitHash = import.meta.env.VITE_COMMIT_HASH || 'unknown';

    return (
        <div className='mt-5 justify-center items-center flex flex-col text-slate-500 font-light text-xs'>
            <div>{`${photosCount} Photos · ${videosCount} Videos · ${formattedBytes} Total`}</div>
            {processingItemsCount > 0 && (
                <div>
                    {`${processingItemsCount} items processing`}
                </div>
            )}
            <br />
            <div>Version: {commitHash}</div>
        </div>
    );
};

export default Menu;
