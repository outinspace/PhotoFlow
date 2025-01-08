import React from 'react';
import { useGallery } from "../queries";
import { TopBar } from '../common/top.bar';
import { formatBytes } from '../common/format.helpers';

export const Billing = () => {
    const { data: gallery } = useGallery();

    const items = gallery?.items ?? [];
    const totalBytes = items.reduce((bytes, item) => bytes + item.totalBytes, 0);

    const monthlyTotal = 0.007 * totalBytes / 1000 / 1000 / 1000;
    const yearlyTotal = monthlyTotal * 12;

    return (
        <div className='flex-col'>
            <TopBar title='Billing' />
            <div className='p-5'>
                <div>
                    {formatBytes(totalBytes)}
                </div>
                <div>
                    {'$' + monthlyTotal.toFixed(2) + '/month'}
                </div>
                <div>
                    {'$' + yearlyTotal.toFixed(2) + '/year'}
                </div>

            </div>
        </div>
    );
}

