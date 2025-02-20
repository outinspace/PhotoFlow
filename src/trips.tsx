import React, { useMemo } from 'react';
import PageHeader from './common/page.header';
import { useAlbumsWithItems, useGallery } from './queries';
import { AlbumWithItems } from './types';
import { useNavigate } from '@tanstack/react-router';
import clustering from 'density-clustering';
import { min } from 'date-fns';

const Trips = () => {
    const { data: gallery } = useGallery();
    const items = gallery?.items ?? [];

    // const trips = useMemo(() => {
    //     const records = items
    //         .filter(item => item.latitude && item.longitude)
    //         .filter(item => item.captureTime !== '0001-01-01T00:00:00+00:00')
    //         .map(item => [item.latitude!, item.longitude!]);
    //
    //     const epsilon = 0.1;
    //     const minPoints = 50;
    //
    //     const alg = new clustering.OPTICS();
    //
    //     console.time('Run');
    //     const clusters = alg.run(records, epsilon, minPoints);
    //     console.timeEnd('Run');
    //
    //     const clusteredRecords = clusters.map(cluster => {
    //         return cluster.map(index => items[index]);
    //     });
    //
    //     return clusteredRecords;
    // }, [items]);

    const trips = useMemo(() => {
        // 



        return [];
    }, [items]);

    console.log(trips);

    return (
        <div className='p-5'>
            <PageHeader name='Trips' />
            <div
                className='w-full grid justify-items-center justify-around md:justify-normal'
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min-content, 150px))'
                }}
            >
            </div>
        </div>
    );
};

interface TripCoverProps {
    album: AlbumWithItems;
    onClick: Function;
}

const TripCover = ({ album, onClick }: TripCoverProps) => {
    let gridCols = 1;
    if (album.items.length >= 16) {
        gridCols = 4;
    } else if (album.items.length >= 9) {
        gridCols = 3;
    } else if (album.items.length >= 4) {
        gridCols = 2;
    }

    const gridTemplate = `repeat(${gridCols}, minmax(0, 1fr))`;
    const coverItems = album.items.slice(0, gridCols * gridCols);

    return (
        <div className='flex-col m-2 justify-items-center' onClick={() => onClick()}>
            <div className={'rounded border border-slate-200 size-36 overflow-hidden grid'}
                style={{
                    gridTemplateColumns: gridTemplate,
                    gridTemplateRows: gridTemplate
                }}
            >
                {coverItems.map(item => (
                    <img
                        key={item.itemId}
                        src={item.primaryFile.tileImageUrl ?? ''}
                        className='w-full h-full object-cover'
                    />
                ))}
            </div>
            <div className='mt-1 truncate text-ellipsis w-36 text-sm text-center'>{album.name}</div>
        </div>
    )
}

export default Trips;
