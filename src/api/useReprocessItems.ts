import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../app";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";
import toast from "react-hot-toast";

export const useReprocessItems = () => {
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            const promise = fetchAuthenticatedRoute('/items/reprocess', {
                method: 'POST',
                body: JSON.stringify(itemIds),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            await toast.promise(promise, {
                loading: `Queueing ${itemIds.length} item${itemIds.length > 1 ? 's' : ''} for reprocessing`,
                success: `${itemIds.length} item${itemIds.length > 1 ? 's' : ''} queued for reprocessing`,
                error: 'Failed to queue items for reprocessing'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
        }
    });
}

