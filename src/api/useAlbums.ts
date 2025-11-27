import { useQuery } from "@tanstack/react-query";
import { Album } from "../types";
import { fetchAuthenticatedRoute } from "./fetchAuthenticatedRoute";

interface GetAlbumsResponse {
    albums: Album[];
}

export const useAlbums = () => useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
        const res = await fetchAuthenticatedRoute('/albums');

        const body = await res.json();
        const response = body as GetAlbumsResponse;

        return response.albums;
    }
})

