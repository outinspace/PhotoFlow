import { OneYearAgoToday as OneYearAgo } from './one.year.ago';
import { Years } from './years';

const Home = () => {
    return (
        <div className="flex flex-auto flex-col py-4">
            <OneYearAgo />
            <Years />
        </div>
    );
};

export default Home;

