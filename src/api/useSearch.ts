import { useQuery } from "@tanstack/react-query";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

export interface SearchResult {
    itemId: number;
    score: number;
}

interface SearchItemsResponse {
    results: SearchResult[];
}

export const useSearch = (query: string) => useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length > 0,
    queryFn: async (): Promise<SearchResult[]> => {
        const params = new URLSearchParams({ q: query });
        const res = await fetchAuthenticatedRoute(`/items/search?${params.toString()}`);

        const body = (await res.json()) as SearchItemsResponse;
        return body.results;
    },
});
