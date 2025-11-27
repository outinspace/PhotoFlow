import { publicItemRoute } from '../routes';
import ItemPreview from './item.preview';
import { expandGUID } from '../common/format.helpers';
import { usePublicItem } from '../api/usePublicItem';

export const PublicItemLayout = () => {
    const { shortTenantId, shortPrimaryFileId } = publicItemRoute.useParams();

    const tenantId = expandGUID(shortTenantId);
    const primaryFileId = expandGUID(shortPrimaryFileId);

    const { data: item } = usePublicItem(tenantId, primaryFileId);

    if (!item) {
        return;
    }

    return (
        <ItemPreview
            readonly
            itemIndex={0}
            items={[item]}
            albumId={null}
        />
    );
}
