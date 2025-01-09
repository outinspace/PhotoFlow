import { useSearch } from "@tanstack/react-router";

interface SearchParams {
    debug?: boolean;
}

export const useDebugMode = () => {
    const searchParams: SearchParams = useSearch({ strict: false });

    return !!searchParams.debug;
}
