import { useMemo } from "react";
import { Album } from "../types";
import { useMutationState } from "./useMutationState";
import { AlbumState, MergedState } from "../storage/mutations";

// Albums are derived from the merged mutation state rather than fetched. There is
// no albums file to keep in step: an album is simply whatever the logs say about
// it once they are merged.

const toAlbum = (state: AlbumState): Album => ({
    albumId: state.albumId,
    name: state.name?.value ?? 'Untitled',
    shareSecret: state.shareSecret?.value ?? null,
    createdTimeUtc: state.createdTimeUtc ?? state.name?.ts ?? new Date(0).toISOString(),
    updatedTimeUtc: state.name?.ts ?? state.createdTimeUtc ?? new Date(0).toISOString(),
    itemIds: Object.entries(state.members ?? {})
        .filter(([, membership]) => membership.in?.value)
        .map(([itemId]) => Number(itemId))
});

export const selectAlbums = (state?: MergedState): Album[] =>
    Object.values(state?.albums ?? {})
        .filter(album => !album.deleted?.value)
        .map(toAlbum)
        .sort((a, b) => b.createdTimeUtc.localeCompare(a.createdTimeUtc));

export const useAlbums = () => {
    const { data, ...query } = useMutationState();

    return { ...query, data: useMemo(() => selectAlbums(data), [data]) };
}
