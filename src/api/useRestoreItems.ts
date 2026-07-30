import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useRestoreItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            await fetchAuthenticatedRoute('/items/restore', {
                method: 'POST',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
        }
    });
}

