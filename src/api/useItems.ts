import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Item } from "../types";
import { computeItemProperties } from "./computeItemProperties";
import { fetchCatalog } from "../storage/catalog";
import { useMutationState } from "./useMutationState";
import { MergedState } from "../storage/mutations";

// The library is assembled from two independent sources:
//
//   catalog/  — immutable facts about each photo, written only by the worker
//   meta/     — favourites, deletions and albums, written only by browsers
//
// Keeping them apart is what lets a month's shard stop changing once the month is
// over: favouriting a 2019 photo touches meta/, never the 2019 shard.

const catalogQuery = {
    queryKey: ['catalog'],
    staleTime: 60_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const catalog = await fetchCatalog(signal);

        for (const item of catalog.items) {
            computeItemProperties(item);
        }

        return catalog;
    }
};

export const useCatalog = () => useQuery(catalogQuery);

// Applying the overlay produces new objects rather than mutating the cached
// catalog, so a favourite toggle cannot leave stale flags behind on re-render.
const applyMutations = (items: Item[], state?: MergedState): Item[] => {
    if (!state) {
        return items;
    }

    return items.map(item => {
        const overlay = state.items[item.itemId];
        if (!overlay) {
            return item;
        }

        return {
            ...item,
            isFavorite: overlay.favorite?.value ?? item.isFavorite,
            deletedTimeUtc: overlay.deleted?.value ?? item.deletedTimeUtc
        };
    });
};

const useMergedItems = () => {
    const { data: catalog, ...query } = useQuery(catalogQuery);
    const { data: mutations } = useMutationState();

    const items = useMemo(
        () => applyMutations(catalog?.items ?? [], mutations),
        [catalog, mutations]
    );

    return { ...query, items };
};

// The gallery and Recently Deleted read the same data and take one side of the
// split each, so no view ever sees both.
export const useItems = () => {
    const { items, ...query } = useMergedItems();

    return {
        ...query,
        data: useMemo(() => items.filter(item => !item.deletedTimeUtc), [items])
    };
};

export const useDeletedItems = () => {
    const { items, ...query } = useMergedItems();

    return {
        ...query,
        data: useMemo(() => items.filter(item => item.deletedTimeUtc), [items])
    };
};
