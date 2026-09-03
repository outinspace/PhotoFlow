import { useQuery } from "@tanstack/react-query";
import { computeItemProperties } from "./computeItemProperties";
import { readJson } from "../storage/bucket";
import { retryUnlessRefused } from "./retryUnlessRefused";
import { SharedItem } from "../storage/sharing";

// A shared photo is read by its presigned URL, which the link itself carries. So
// this needs no credentials and no configuration — which is the point, since
// whoever opens the link has neither.

export const usePublicItem = (documentUrl: string) => useQuery({
    queryKey: ['public', 'item', documentUrl],
    retry: retryUnlessRefused,
    queryFn: async () => {
        const shared = await readJson<SharedItem>(documentUrl);
        if (!shared) {
            throw new Error('This shared photo is no longer available.');
        }

        computeItemProperties(shared.item);

        return shared.item;
    }
});
