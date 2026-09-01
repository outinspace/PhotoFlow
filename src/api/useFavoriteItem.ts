import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

export const useFavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            appendOperations([{ op: 'item.favorite', itemId, value: true }]);
        },
        onSuccess: invalidateAfterMutation
    });
}
