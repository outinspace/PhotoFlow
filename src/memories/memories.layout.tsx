import { Link } from '@tanstack/react-router';
import { Settings } from 'iconoir-react';
import { OneYearAgoToday as OneYearAgo } from './one.year.ago';
import { Years } from './years';
import { Trips } from './trips';
import { Albums } from './albums';
import { glassCircleClasses } from '../common/top.bar';

// Memories, albums, trips and years in one place. Settings live behind the button
// here on a phone, where there is no sidebar to hold them.
const MemoriesLayout = () => {
    return (
        <div className="flex flex-auto flex-col tabbar-pad">
            <div className='flex items-center justify-between px-5 pt-4 pb-5'>
                <h1 className='text-[34px] font-bold tracking-tight text-slate-900'>Collections</h1>
                <Link to='/menu' className={`${glassCircleClasses} md:hidden`} aria-label='Settings' title='Settings'>
                    <Settings className='size-6' />
                </Link>
            </div>
            <Trips />
            <OneYearAgo />
            <Albums />
            <Years />
        </div>
    );
};

export default MemoriesLayout;
