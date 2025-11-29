import { OneYearAgoToday as OneYearAgo } from './one.year.ago';
import { Years } from './years';
import { Trips } from './trips';

const Home = () => {
    return (
        <div className="flex flex-auto flex-col py-4">
            <OneYearAgo />
            <Trips />
            <Years />
        </div>
    );
};

export default Home;

