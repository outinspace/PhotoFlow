import React, { useState } from 'react';
import { Modal } from "../common/modal";
import { useAddItemsToAlbum } from '../api/useAddItemsToAlbum';
import { useAlbums } from '../api/useAlbums';
import { useCreateAlbum } from '../api/useCreateAlbum';
import { Item } from '../types';

interface Props {
    isOpen: boolean;
    onCancel: Function;
    onAddComplete: Function;
    items: Item[];
}

export const AddToAlbumModal = ({ isOpen, onCancel, onAddComplete, items }: Props) => {
    const [selectedAlbumId, setSelectedAlbumId] = useState(0);
    const addToAlbumMutation = useAddItemsToAlbum();

    const { data: albums } = useAlbums();

    const handleAdd = async () => {
        const itemIds = items.map(i => i.itemId);

        const success = await addToAlbumMutation.mutateAsync({
            albumId: selectedAlbumId,
            itemIds
        });

        if (!success) {
            return;
        }

        onAddComplete();
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Add To Album'
            description='Select an album to add the selected items to.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Add',
                    color: 'primary',
                    onClick: handleAdd,
                    disabled: selectedAlbumId === 0
                }
            ]}
        >
            <select
                className='flex-auto border rounded bg-slate-100 p-2 hover:bg-slate-200'
                onChange={e => setSelectedAlbumId(parseInt(e.target.value))}
            >
                <option
                    key={0}
                    value='0'
                    disabled={selectedAlbumId !== 0}
                >
                    Select Album
                </option>
                {albums?.map(album => (
                    <option key={album.albumId} value={album.albumId}>{album.name}</option>
                ))}
            </select>
        </Modal>
    );
}
