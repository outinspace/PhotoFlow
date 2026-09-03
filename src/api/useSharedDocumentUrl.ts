import { useEffect, useState } from 'react';
import { readSharedDocumentUrl } from '../storage/sharing';

// The presigned URL of a shared document, read from the fragment and kept current.
//
// Subscribed rather than read once because following one share link from another
// changes only the fragment, and the browser does not reload for that. Read once,
// the page would go on showing the photo from the previous link.

export const useSharedDocumentUrl = (): string | null => {
    const [documentUrl, setDocumentUrl] = useState(readSharedDocumentUrl);

    useEffect(() => {
        const onHashChange = () => setDocumentUrl(readSharedDocumentUrl());

        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    return documentUrl;
};
