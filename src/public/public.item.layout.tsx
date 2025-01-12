import React from 'react';
import { publicItemRoute } from '../routes';
import ItemPreview from '../gallery/item.preview';
import { expandGUID } from '../common/format.helpers';
import { usePublicItem } from '../queries';

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
            item={item}
            albumId={null}
        />
    );
}
