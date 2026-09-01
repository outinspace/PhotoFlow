import { useMutation } from "@tanstack/react-query";
import { appendOperations, invalidateAfterMutation } from "../storage/mutation.log";

export const useUnfavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            appendOperations([{ op: 'item.favorite', itemId, value: false }]);
        },
        onSuccess: invalidateAfterMutation
    });
}
