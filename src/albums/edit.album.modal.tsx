import { useState } from 'react';
import { Modal } from "../common/modal";
import { Album } from '../types';
import { useUpdateAlbum } from '../api/useUpdateAlbum';

interface Props {
    album: Album;
    isOpen: boolean;
    onCancel: Function;
    onEditComplete: Function;
}

export const EditAlbumModal = ({ album, isOpen, onCancel, onEditComplete }: Props) => {
    const updateAlbumMutation = useUpdateAlbum();
    const [albumName, setAlbumName] = useState(album.name);

    const handleUpdate = () => {
        updateAlbumMutation.mutate(
            { albumId: album.albumId, name: albumName },
            { onSuccess: () => onEditComplete() }
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Edit Album'
            description='Give the album a new name.'
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Save',
                    color: 'primary',
                    onClick: handleUpdate,
                    disabled: albumName === album.name || albumName === ''
                }
            ]}
        >
            <input
                type='text'
                placeholder='Album Name'
                value={albumName}
                onChange={e => setAlbumName(e.target.value)}
                className='flex-auto h-11 rounded-xl bg-white/80 px-3 text-[15px] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-sky-500'
                maxLength={50}
            />
        </Modal>
    );
}
