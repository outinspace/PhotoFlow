import { router } from '../routes';
import { S3ConfigForm } from './s3.config.form';

const Setup = () => {
    const handleSaveSuccess = () => {
        router.navigate({ to: '/' });
    };

    return (
        <div className="flex min-h-full flex-1 flex-col px-6 py-12 pb-24 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h3 className="text-center text-xl font-semibold text-gray-800">
                    Set up your storage bucket
                </h3>

                <ol className="mt-4 space-y-2 text-sm text-gray-600 list-decimal list-inside">
                    <li>
                        Create a bucket at your S3-compatible provider (Backblaze B2, Cloudflare R2, AWS S3, etc.)
                    </li>
                    <li>
                        Make the bucket <span className="font-medium text-gray-800">publicly accessible</span> — PhotoFlow serves photos directly from it to your browser
                    </li>
                    <li>
                        Generate an API key with only <span className="font-mono text-xs font-medium text-gray-800">PutObject</span> permission — photos are served directly from the public bucket URL, so the key does not need read access
                    </li>
                </ol>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <S3ConfigForm onSaveSuccess={handleSaveSuccess} />
                <button
                    onClick={() => router.navigate({ to: '/gallery' })}
                    className="mt-2 flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-gray-500 hover:text-gray-700"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
};

export default Setup;
