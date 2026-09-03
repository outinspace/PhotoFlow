import ItemPreview from './item.preview';
import { usePublicItem } from '../api/usePublicItem';
import { ShareUnavailable } from '../common/share.unavailable';
import { useSharedDocumentUrl } from '../api/useSharedDocumentUrl';

export const PublicItemLayout = () => {
    // The link carries a presigned URL to the share document in its fragment, so
    // this page needs no credentials and no configuration of its own.
    const documentUrl = useSharedDocumentUrl();

    const { data: item, isLoading, isError } = usePublicItem(documentUrl ?? '');

    if (!documentUrl) {
        return <ShareUnavailable kind='photo' />;
    }

    if (isLoading) {
        return null;
    }

    if (isError || !item) {
        return <ShareUnavailable kind='photo' />;
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
