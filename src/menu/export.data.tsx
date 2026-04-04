import { useState } from 'react';
import { TopBar } from '../common/top.bar';
import { fetchAuthenticatedRoute } from '../api/fetchAuthenticatedRoute';

const ExportData = () => {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetchAuthenticatedRoute('/export/data');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'photoflow.db';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Export Your Data' />
            <div className='p-5 overflow-auto'>
                <p className='text-sm text-slate-700 mb-6'>
                    Photoflow stores your gallery's metadata — including filenames, dates, GPS coordinates,
                    albums, and trips — in a SQLite database file local to your account. You can download
                    this file at any time as a portable backup or to use with other SQLite-compatible tools.
                    Note that your photos and videos are not included; they remain in your configured S3 bucket.
                </p>
                <div className='pb-8'>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className='flex w-full justify-center rounded-md bg-sky-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
                    >
                        {loading ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportData;
