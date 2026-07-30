import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export const useUnfavoriteItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            await fetchAuthenticatedRoute(`/items/${itemId}/unfavorite`, {
                method: 'POST'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
        }
    });
}

