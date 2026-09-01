import { publicAlbumRoute } from '../routes';
import { usePublicAlbum } from '../api/usePublicAlbum';
import { TopBar } from '../common/top.bar';
import ItemGrid from '../gallery/item.grid';
import { ShareUnavailable } from '../common/share.unavailable';

export const PublicAlbumLayout = () => {
    const { shortShareSecret } = publicAlbumRoute.useParams();

    const { data: album, isLoading, isError } = usePublicAlbum(shortShareSecret);

    if (isLoading) {
        return null;
    }

    if (isError || !album) {
        return <ShareUnavailable kind='album' />;
    }

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar
                title={album.name}
                hideBack
            />
            <ItemGrid
                readonly
                items={album.items}
                albumId={null}
            />
        </div>
    );
}
