import { useMemo } from 'react';
import { useAlbumsWithItems } from '../api/useAlbumsWithItems';
import { ItemStack } from './item.stack';
import { useNavigate, Link } from '@tanstack/react-router';
import { parseISO } from 'date-fns';

export const Albums = () => {
    const albums = useAlbumsWithItems();
    const navigate = useNavigate();

    const sortedAlbums = useMemo(() => {
        if (!albums) return [];
        
        return [...albums].sort((a, b) => {
            // Get the most recent photo from each album
            const getMostRecentPhotoTime = (album: typeof a) => {
                if (album.items.length === 0) return 0;
                return Math.max(...album.items.map(item => parseISO(item.captureTime).getTime()));
            };
            
            const aTime = getMostRecentPhotoTime(a);
            const bTime = getMostRecentPhotoTime(b);
            
            // Sort by most recent photo (descending)
            return bTime - aTime;
        });
    }, [albums]);

    const handleAlbumClick = (albumId: number) => {
        navigate({ to: '/album/$albumId', params: { albumId: albumId.toString() } });
    };

    if (sortedAlbums.length === 0) {
        return null;
    }

    return (
        <>
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4 px-6">
                    <h2 className="text-2xl font-bold">Albums</h2>
                    <Link
                        to="/albums"
                        className="text-sm text-sky-500 hover:text-sky-600 font-medium"
                    >
                        See All Albums
                    </Link>
                </div>
                <div className="overflow-x-auto" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex shrink-1 gap-4 pl-6" style={{ width: 'max-content' }}>
                        {sortedAlbums.map((album) => {
                            return (
                                <div key={album.albumId} className="flex flex-col items-center flex-shrink-0">
                                    <ItemStack
                                        items={album.items}
                                        onClick={() => handleAlbumClick(album.albumId)}
                                    />
                                    <div className="mt-2 text-sm font-medium text-center max-w-[300px]">
                                        {album.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

