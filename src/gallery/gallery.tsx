import ItemGrid from "./item.grid";
import { useItems } from '../api/useItems';
import { UploadDropZone } from '../common/upload.drop.zone';

const Gallery = () => {
    const { data } = useItems();

    const items = data ?? [];

    return (
        <UploadDropZone className='flex flex-auto flex-col overflow-hidden'>
            <ItemGrid items={items} albumId={null} enableUrlPersistence />
        </UploadDropZone>
    )
};

export default Gallery;
