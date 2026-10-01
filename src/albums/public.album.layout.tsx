import { usePublicAlbum } from '../api/usePublicAlbum';
import ItemGrid from '../gallery/item.grid';
import { ShareUnavailable } from '../common/share.unavailable';
import { useSharedDocumentUrl } from '../api/useSharedDocumentUrl';

export const PublicAlbumLayout = () => {
    const documentUrl = useSharedDocumentUrl();

    const { data: album, isLoading, isError } = usePublicAlbum(documentUrl ?? '');

    if (!documentUrl) {
        return <ShareUnavailable kind='album' />;
    }

    if (isLoading) {
        return null;
    }

    if (isError || !album) {
        return <ShareUnavailable kind='album' />;
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <ItemGrid
                readonly
                items={album.items}
                albumId={null}
                title={album.name}
            />
        </div>
    );
}
