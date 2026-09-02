import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

// Deleting only records a tombstone. Nothing is ever removed from the bucket, so
// a mistaken delete is always recoverable from Recently Deleted.
export const useDeleteItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            const deletedTimeUtc = new Date().toISOString();
            appendOperations(itemIds.map(itemId => ({ op: 'item.deleted' as const, itemId, value: deletedTimeUtc })));
        },
        onSuccess: invalidateAfterMutation
    });
}
