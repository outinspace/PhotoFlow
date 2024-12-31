import { CreditCard, LogOut, ProfileCircle, Trash } from 'iconoir-react';
import React, { useMemo } from 'react';
import { router } from '../routes';
import PageHeader from '../common/page.header';
import { useGallery } from '../queries';
import { formatBytes } from '../common/format.helpers';

const options = [
    {
        name: 'Recently Deleted Items',
        icon: Trash,
        onClick: () => {
            router.navigate({ to: '/recently-deleted' });
        }
    },
    {
        name: 'Profile',
        icon: ProfileCircle
    },
    {
        name: 'Billing',
        icon: CreditCard
    },
    {
        name: 'Logout',
        icon: LogOut,
        onClick: () => {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('sessionId');
            router.navigate({ to: '/login' });
        }
    }
];

const Menu = () => {
    return (
        <div className='p-5'>
            <PageHeader name='Menu' />
            <div>
                {options.map(option => (
                    <div
                        key={option.name}
                        className='flex first:rounded-t-lg last:rounded-b-lg bg-slate-100 p-2 border-b last:border-0 transition-all hover:bg-slate-200 active:bg-slate-300'
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

    return (
        <div className='mt-5 justify-center flex'>
            {`${photosCount} Photos · ${videosCount} Videos · ${formattedBytes} Total`}
        </div>
    );
};

export default Menu;
