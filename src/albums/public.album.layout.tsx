import { publicAlbumRoute } from '../routes';
import { expandGUID } from '../common/format.helpers';
import { usePublicAlbum } from '../api/usePublicAlbum';
import { TopBar } from '../common/top.bar';
import ItemGrid from '../gallery/item.grid';

export const PublicAlbumLayout = () => {
    const { shortTenantId, shortShareSecret } = publicAlbumRoute.useParams();

    const tenantId = expandGUID(shortTenantId);
    const shareSecret = expandGUID(shortShareSecret);

    const { data: album } = usePublicAlbum(tenantId, shareSecret);

    if (!album) {
        return;
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
