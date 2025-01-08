import React, { useState } from 'react';
import { Modal } from "../common/modal";
import { useAddItemsToAlbum, useCreateAlbum } from '../queries';
import { Item } from '../types';

interface Props {
    isOpen: boolean;
    onCancel: Function;
    onAddComplete: Function;
    items: Item[];
}

export const AddToAlbumModal = ({ isOpen, onCancel, onAddComplete, items }: Props) => {
    const [albumName, setAlbumName] = useState('');
    const createAlbumMutation = useCreateAlbum();
    // const addItemsToAlbumMutation = useAddItemsToAlbum()

    const handleAdd = async () => {
        const itemIds = items.map(i => i.itemId);

        const albumId = await createAlbumMutation.mutateAsync({
            name: albumName,
            itemIds
        });

        if (!albumId) {
            return;
        }

        onAddComplete();
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Add To Album'
            description='Select an existing album or enter a name to create a new one.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Add',
                    color: 'primary',
                    onClick: handleAdd
                }
            ]}
        >
            <input type='text' placeholder='Album Name' onChange={e => setAlbumName(e.target.value)} />
        </Modal>
    );
}
