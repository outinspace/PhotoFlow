import { publicItemRoute } from '../routes';
import ItemPreview from './item.preview';
import { usePublicItem } from '../api/usePublicItem';
import { ShareUnavailable } from '../common/share.unavailable';

export const PublicItemLayout = () => {
    // The share id is the file's content hash, used verbatim. It was briefly
    // decoded as a compacted GUID here, which silently produced a key that
    // matched nothing.
    const { shortPrimaryFileId } = publicItemRoute.useParams();

    const { data: item, isLoading, isError } = usePublicItem(shortPrimaryFileId);

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
