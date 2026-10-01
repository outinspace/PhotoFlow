import { useMemo } from 'react';
import { useAlbumsWithItems } from '../api/useAlbumsWithItems';
import { ItemStack } from './item.stack';
import { useNavigate } from '@tanstack/react-router';
import { parseISO } from 'date-fns';
import { Section } from './section';

// Collections shows the few albums most recently added to; the rest are a tap away.
const ALBUMS_SHOWN = 6;

export const Albums = () => {
    const albums = useAlbumsWithItems();
    const navigate = useNavigate();

    const sortedAlbums = useMemo(() => {
        if (!albums) return [];

        const getMostRecentPhotoTime = (album: typeof albums[number]) => {
            if (album.items.length === 0) return 0;
            return Math.max(...album.items.map(item => parseISO(item.captureTime).getTime()));
        };

        return [...albums].sort((a, b) => getMostRecentPhotoTime(b) - getMostRecentPhotoTime(a));
    }, [albums]);

    const handleAlbumClick = (albumId: number) => {
        navigate({ to: '/album/$albumId', params: { albumId: albumId.toString() } });
    };

    if (sortedAlbums.length === 0) {
        return null;
    }

    return (
        <Section title='Albums' seeAllTo='/albums'>
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-3 gap-y-4 px-5'>
                {sortedAlbums.slice(0, ALBUMS_SHOWN).map(album => (
                    <div key={album.albumId} className='min-w-0'>
                        <ItemStack
                            items={album.items}
                            onClick={() => handleAlbumClick(album.albumId)}
                            fullWidth
                            aspectRatio='1/1'
                            showCount={false}
                        />
                        <div className='mt-2 px-1 text-[15px] font-semibold text-slate-900 truncate'>{album.name}</div>
                        <div className='px-1 text-[13px] text-slate-500'>{album.items.length}</div>
                    </div>
                ))}
            </div>
        </Section>
    );
};
