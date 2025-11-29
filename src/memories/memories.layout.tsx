import { OneYearAgoToday as OneYearAgo } from './one.year.ago';
import { Years } from './years';
import { Trips } from './trips';
import { Albums } from './albums';

const MemoriesLayout = () => {
    return (
        <div className="flex flex-auto flex-col py-4">
            <OneYearAgo />
            <Trips />
            <Albums />
            <Years />
        </div>
    );
};

export default MemoriesLayout;

