import { useGallery } from "../api/useGallery";
import { TopBar } from '../common/top.bar';
import { formatBytes } from '../common/format.helpers';

export const Billing = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];
    const totalBytes = items.reduce((bytes, item) => bytes + item.totalBytes, 0);

    const itemCount = items.length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const bytesThisMonth = items
        .flatMap(item => item.files)
        .filter(file => {
            const uploadDate = new Date(file.uploadTimeUtc);
            return uploadDate.getMonth() === currentMonth && uploadDate.getFullYear() === currentYear;
        })
        .reduce((bytes, file) => bytes + file.sizeBytes, 0);

    const totalUsage = items
        .flatMap(item => item.files)
        .reduce((bytes, file) => bytes + file.sizeBytes, 0);

    const monthlyCost = 0.007 * totalUsage / 1000 / 1000 / 1000;

    const photoItems = items.filter(item => item.type === 'photo');
    const videoItems = items.filter(item => item.type === 'video');
    const livePhotoItems = items.filter(item => item.type === 'live-photo');

    const photoCount = photoItems.length;
    const videoCount = videoItems.length;
    const livePhotoCount = livePhotoItems.length;

    const photoBytes = photoItems.reduce((bytes, item) => bytes + item.totalBytes, 0);
    const videoBytes = videoItems.reduce((bytes, item) => bytes + item.totalBytes, 0);
    const livePhotoBytes = livePhotoItems.reduce((bytes, item) => bytes + item.totalBytes, 0);

    const startOfMonth = new Date(currentYear, currentMonth, 1);

    const bytesStartOfMonth = items
        .flatMap(item => item.files)
        .filter(file => {
            const uploadDate = new Date(file.uploadTimeUtc);
            return uploadDate < startOfMonth;
        })
        .reduce((bytes, file) => bytes + file.sizeBytes, 0);

    return (
        <div className='flex-col'>
            <TopBar title='Billing' />
            <div className='p-5 overflow-y-scroll flex flex-col'>
                <h2 className='text-lg font-bold'>Total Storage</h2>
                <table className='table-auto w-full mb-5'>
                    <tbody>
                        <tr>
                            <td className='border px-4 py-2'>Start of Month</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(bytesStartOfMonth)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2'>Added This Month</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(bytesThisMonth)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2'>Total Storage</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(totalUsage)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2'>Monthly Cost</td>
                            <td className='border px-4 py-2 text-right'>{'$' + monthlyCost.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                <h2 className='text-lg font-bold'>Storage Usage</h2>
                <table className='table-auto w-full mb-5'>
                    <thead>
                        <tr>
                            <th className='px-4 py-2'></th>
                            <th className='px-4 py-2 text-right'>Count</th>
                            <th className='px-4 py-2 text-right'>Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className='border px-4 py-2'>All Items</td>
                            <td className='border px-4 py-2 text-right'>{itemCount.toLocaleString()}</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(totalBytes)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2 pl-4'>Photos</td>
                            <td className='border px-4 py-2 text-right'>{photoCount.toLocaleString()}</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(photoBytes)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2 pl-4'>Videos</td>
                            <td className='border px-4 py-2 text-right'>{videoCount.toLocaleString()}</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(videoBytes)}</td>
                        </tr>
                        <tr>
                            <td className='border px-4 py-2 pl-4'>Live Photos</td>
                            <td className='border px-4 py-2 text-right'>{livePhotoCount.toLocaleString()}</td>
                            <td className='border px-4 py-2 text-right'>{formatBytes(livePhotoBytes)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

