import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
    encodeQuery,
    getModelLoadState,
    ItemVector,
    loadVectors,
    ModelLoadState,
    rankBySimilarity,
    subscribeToModelLoad
} from "../search/clip";
import { useCatalog } from "./useItems";

export interface SearchResult {
    itemId: number;
    score: number;
}

// Mirrors what the old search endpoint returned, so the search page is unchanged.
const MIN_SCORE = 0.20;
const RESULT_LIMIT = 500;

// Roughly half a kilobyte per photo, so a large library is a one-off download of
// some tens of megabytes. Held for the session rather than fetched per keystroke.
const useVectors = (enabled: boolean) => {
    const { data: catalog } = useCatalog();

    return useQuery({
        queryKey: ['search-vectors', catalog?.manifest.generatedAt],
        enabled: enabled && !!catalog,
        staleTime: Infinity,
        gcTime: Infinity,
        queryFn: (): Promise<ItemVector[]> => loadVectors(catalog!.manifest)
    });
};

export const useModelLoadState = (): ModelLoadState =>
    useSyncExternalStore(subscribeToModelLoad, getModelLoadState, getModelLoadState);

export const useSearch = (query: string) => {
    const { data: catalog } = useCatalog();
    const isSearching = query.trim().length > 0;

    const { data: vectors, isLoading: isLoadingVectors } = useVectors(isSearching);
    const model = useModelLoadState();

    const search = useQuery({
        queryKey: ['search', query],
        enabled: isSearching && !!vectors && !!catalog,
        queryFn: async (): Promise<SearchResult[]> => {
            const queryVector = await encodeQuery(query, catalog!.manifest.embeddings.modelRepo);

            return rankBySimilarity(queryVector, vectors!, MIN_SCORE, RESULT_LIMIT);
        }
    });

    // The first search of a session does two slow things before it can rank
    // anything — fetch the embeddings, then fetch the text model — and the page
    // needs to name whichever is happening rather than saying "Searching…" for
    // half a minute.
    return {
        ...search,
        isLoadingVectors: isSearching && isLoadingVectors,
        model
    };
};
