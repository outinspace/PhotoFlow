import { CreditCard, LogOut, ProfileCircle, Refresh, RefreshDouble, Restart, Trash } from 'iconoir-react';
import React, { useMemo } from 'react';
import { router } from '../routes';
import PageHeader from '../common/page.header';
import { fetchAuthenticatedRoute, useGallery } from '../queries';
import { formatBytes } from '../common/format.helpers';
import { useDebugMode } from '../hooks/use.debug.mode';

const options = [
    {
        name: 'Recently Deleted Items',
        icon: Trash,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/recently-deleted' });
        }
    },
    {
        name: 'Items In-Process',
        icon: RefreshDouble,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/items-in-process' });
        }
    },
    {
        name: 'Billing',
        icon: CreditCard,
        debug: false,
        onClick: () => {
            router.navigate({ to: '/billing' });
        }
    },
    {
        name: 'Logout',
        icon: LogOut,
        debug: false,
        onClick: () => {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('sessionId');
            router.navigate({ to: '/login' });
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
    }
];

const Menu = () => {
    const showDebugOptions = useDebugMode();

    return (
        <div className='p-5'>
            <PageHeader name='Menu' />
            <div>
                {options
                    .filter(option => !option.debug || showDebugOptions)
                    .map(option => (
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
        items.filter(i => i.files.some(f => f.lastProcessedTimeUtc === null)).length,
        [items]);

    return (
        <div className='mt-5 justify-center items-center flex flex-col text-slate-500 font-light text-xs'>
            <div>{`${photosCount} Photos · ${videosCount} Videos · ${formattedBytes} Total`}</div>
            {processingItemsCount > 0 && (
                <div>
                    {`${processingItemsCount} items processing`}
                </div>
            )}
        </div>
    );
};

export default Menu;
