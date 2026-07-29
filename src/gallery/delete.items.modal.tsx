import { Modal } from '../common/modal';
import { useDeleteItems } from '../api/useDeleteItems';
import { Item } from '../types';

interface Props {
    isOpen: boolean;
    onCancel: () => void;
    onDeleteComplete?: () => void;
    items: Item[];
}

export const DeleteItemsModal = ({ isOpen, onCancel, onDeleteComplete, items }: Props) => {
    const deleteItems = useDeleteItems();

    const handleDelete = () => {
        const itemIds = items.map(i => i.itemId);
        deleteItems.mutate(itemIds, {
            onSuccess: () => onDeleteComplete?.()
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            title='Mark For Deletion?'
            description={`${items.length} ${items.length === 1 ? 'item' : 'items'} will be accessible in Recently Deleted Items for 30 days.`}
            actions={[
                {
                    text: 'Cancel',
                    color: 'neutral',
                    onClick: onCancel
                },
                {
                    text: 'Delete',
                    color: 'destructive',
                    onClick: handleDelete
                }
            ]}
        />
    );
}; 