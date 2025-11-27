import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import toast from "react-hot-toast";

export const useReprocessItem = () => {
    return useMutation({
        mutationFn: async (itemId: number) => {
            const promise = fetchAuthenticatedRoute(`/items/${itemId}/reprocess`, {
                method: 'POST'
            });

            await toast.promise(promise, {
                loading: 'Reprocessing',
                success: 'Complete',
                error: 'Failed to reprocess item'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery'] });
        }
    });
}

