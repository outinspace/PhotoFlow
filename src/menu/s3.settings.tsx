import { useEffect, useState } from 'react';
import { fetchAuthenticatedRoute } from '../api/fetchAuthenticatedRoute';
import PageHeader from '../common/page.header';
import { S3ConfigForm } from '../setup/s3.config.form';

interface ExistingConfig {
    endpointUrl: string | null;
    bucketName: string | null;
    publicBaseUrl: string | null;
    accessKeyId: string | null;
    isConfigured: boolean;
}

const S3Settings = () => {
    const [config, setConfig] = useState<ExistingConfig | null>(null);
    const [hasPhotos, setHasPhotos] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchAuthenticatedRoute('/tenant/s3-config')
            .then(res => res.json())
            .then((data: ExistingConfig) => setConfig(data));
    }, []);

    // We detect existing photos from the gallery cache if available, but a simpler
    // heuristic is: if the tenant already has S3 configured, they may have photos.
    useEffect(() => {
        if (config?.isConfigured) {
            setHasPhotos(true);
        }
    }, [config]);

    const handleSaveSuccess = () => {
        setSaved(true);
        localStorage.setItem('s3Configured', 'true');
    };

    if (!config) {
        return <div className="p-5 text-slate-500">Loading…</div>;
    }

    return (
        <div className="p-5">
            <PageHeader name="Storage Settings" />

            {hasPhotos && config.isConfigured && (
                <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
                    <p className="font-semibold mb-1">Warning: changing your bucket will break existing photos</p>
                    <p>
                        If you change your S3 configuration, all photos currently stored in your old bucket
                        will become inaccessible. You are responsible for manually copying your files to the
                        new bucket before switching, preserving the exact same folder paths
                        (<code className="font-mono text-xs">original/</code>,&nbsp;
                        <code className="font-mono text-xs">tile-image/</code>,&nbsp;
                        <code className="font-mono text-xs">preview/</code>).
                        PhotoFlow does not migrate files automatically.
                    </p>
                </div>
            )}

            {saved && (
                <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
                    Storage settings saved. New uploads will use the updated bucket.
                </div>
            )}

            <S3ConfigForm
                existingConfig={config}
                onSaveSuccess={handleSaveSuccess}
            />
        </div>
    );
};

export default S3Settings;
