import { useQuery } from "@tanstack/react-query";
import { computeItemProperties } from "./computeItemProperties";
import { readJson } from "../storage/bucket";
import { loadRuntimeConfig } from "../storage/runtime.config";
import { itemShareKey, SharedItem } from "../storage/sharing";

export const usePublicItem = (primaryFileId: string) => useQuery({
    queryKey: ['public', 'item', primaryFileId],
    queryFn: async () => {
        await loadRuntimeConfig();

        const shared = await readJson<SharedItem>(itemShareKey(primaryFileId));
        if (!shared) {
            throw new Error('This shared photo is no longer available.');
        }

        computeItemProperties(shared.item, shared.urls.originalPrefix, shared.urls.tileImagePrefix, shared.urls.previewPrefix);

        return shared.item;
    }
});
