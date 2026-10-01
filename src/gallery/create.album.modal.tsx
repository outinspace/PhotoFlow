import { useState } from 'react';
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

    const handleCreate = () => {
        const itemIds = items.map(i => i.itemId);

        createAlbumMutation.mutate(
            { name: albumName, itemIds },
            { onSuccess: () => onAddComplete() }
        );
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
                className='flex-auto h-11 rounded-xl bg-white/80 px-3 text-[15px] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-sky-500'
                maxLength={50}
            />
        </Modal>
    );
}
