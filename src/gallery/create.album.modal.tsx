import React, { useState } from 'react';
import { Modal } from "../common/modal";
import { useCreateAlbum } from '../api/useCreateAlbum';
import { Item } from '../types';

interface Props {
    isOpen: boolean;
    onCancel: Function;
    onAddComplete: Function;
    items: Item[];
}

export const CreateAlbumModal = ({ isOpen, onCancel, onAddComplete, items }: Props) => {
    const [albumName, setAlbumName] = useState('');
    const createAlbumMutation = useCreateAlbum();

    const handleCreate = async () => {
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
            title='Create New Album'
            description='Enter a name for the new album. Your selected items will be added to it.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Create',
                    color: 'primary',
                    onClick: handleCreate,
                    disabled: albumName === ''
                }
            ]}
        >
            <input
                type='text'
                placeholder='Album Name'
                onChange={e => setAlbumName(e.target.value)}
                className='flex-auto border rounded bg-slate-100 p-2 hover:bg-slate-200'
                maxLength={50}
            />
        </Modal>
    );
}
