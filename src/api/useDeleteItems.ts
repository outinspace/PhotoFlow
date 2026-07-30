import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useDeleteItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            await fetchAuthenticatedRoute('/items', {
                method: 'DELETE',
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

