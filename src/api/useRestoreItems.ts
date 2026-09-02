import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

export const useRestoreItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            appendOperations(itemIds.map(itemId => ({ op: 'item.deleted' as const, itemId, value: null })));
        },
        onSuccess: invalidateAfterMutation
    });
}
