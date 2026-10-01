import { Database, LogOut, NavArrowRight, QrCode, Settings, Trash, WarningTriangle } from 'iconoir-react';
import React, { useMemo } from 'react';
import { router } from '../routes';
import { useItems } from '../api/useItems';
import { formatBytes, pluralize } from '../common/format.helpers';
import { useDebugMode } from '../hooks/use.debug.mode';
import { clearStorageConfig } from '../storage/config';
import { clearCachedCatalog } from '../storage/catalog';
import { queryClient } from '../app';
import UploadButton from './upload.button';

const commonOptions = [
    {
        name: 'Display & Playback',
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
        name: 'Link Device',
        icon: QrCode,
        onClick: () => {
            router.navigate({ to: '/link-device' });
        }
    },
];

const logout = async () => {
    // The caches hold the library of whoever was connected, and they outlive
    // the credentials, so clearing them matters as much as clearing the keys.
    clearStorageConfig();
    await clearCachedCatalog();
    queryClient.clear();

    router.navigate({ to: '/connect' });
};

const advancedOptions = [
    {
        name: 'Storage Settings',
        icon: Database,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/storage-settings' });
        }
    },
    {
        name: 'Failed Items',
        icon: WarningTriangle,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/failed-items' });
        }
    }
];

const MenuSection = ({ options }: { options: { name: string; icon: React.ElementType; onClick: () => void }[] }) => (
    <div className='rounded-2xl bg-white overflow-hidden'>
        {options.map(option => (
            <button
                type='button'
                key={option.name}
                className='flex w-full items-center gap-3 min-h-13 px-4 text-left text-[16px] text-slate-900 hover:bg-slate-50 active:bg-slate-100 cursor-pointer group'
                onClick={option.onClick}
            >
                <option.icon className='size-5.5 flex-none text-slate-500' />
                <span className='flex-auto self-stretch flex items-center border-b border-slate-100 group-last:border-0'>{option.name}</span>
                <NavArrowRight className='size-4 flex-none text-slate-400' />
            </button>
        ))}
    </div>
);

const Menu = () => {
    const showDebugOptions = useDebugMode();
    const visibleAdvancedOptions = advancedOptions.filter(option => !option.debug || showDebugOptions);

    return (
        <div className='w-full max-w-2xl mx-auto px-5 pt-4 tabbar-pad'>
            <div className='flex items-center justify-between pb-5'>
                <h1 className='text-[34px] font-bold tracking-tight text-slate-900'>Settings</h1>
                <UploadButton />
            </div>
            <MenuSection options={commonOptions} />
            <div className='mt-7'>
                <div className='px-4 mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500'>Advanced</div>
                <MenuSection options={visibleAdvancedOptions} />
            </div>
            <button
                type='button'
                onClick={logout}
                className='mt-7 flex w-full items-center justify-center gap-2 min-h-13 rounded-2xl bg-white text-[16px] font-medium text-red-600 hover:bg-slate-50 active:bg-slate-100 cursor-pointer'
            >
                <LogOut className='size-5' />
                Log Out
            </button>
            <GalleryStats />
        </div>
    );
};

const GalleryStats = () => {
    const { data } = useItems();
    const items = data ?? [];

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
        <div className='mt-6 justify-center items-center flex flex-col text-slate-500 text-xs'>
            <div>{`${pluralize(photosCount, 'Photo')} · ${pluralize(videosCount, 'Video')} · ${formattedBytes} Total`}</div>
            {processingItemsCount > 0 && (
                <div>
                    {`${pluralize(processingItemsCount, 'item')} processing`}
                </div>
            )}
            <br />
            <div>Version: {commitHash}</div>
        </div>
    );
};

export default Menu;
