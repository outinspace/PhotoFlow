import { router } from '../routes';
import { S3ConfigForm } from './s3.config.form';

const Setup = () => {
    const handleSaveSuccess = () => {
        localStorage.setItem('s3Configured', 'true');
        router.navigate({ to: '/' });
    };

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="text-center text-3xl font-bold italic text-gray-900">
                    PhotoFlow
                </h2>
                <h3 className="mt-4 text-center text-xl font-semibold text-gray-800">
                    Set up your storage bucket
                </h3>
                <p className="mt-2 text-center text-sm text-gray-600">
                    PhotoFlow stores your photos in an S3-compatible bucket that you provide and control.
                    You can use Backblaze B2, Cloudflare R2, AWS S3, or any compatible provider.
                </p>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
                <S3ConfigForm onSaveSuccess={handleSaveSuccess} />
            </div>
        </div>
    );
};

export default Setup;
