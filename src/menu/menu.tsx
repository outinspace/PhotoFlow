import { CreditCard, LogOut, ProfileCircle } from 'iconoir-react';
import React from 'react';
import { router } from '../routes';
import PageHeader from '../common/page.header';

const options = [
    {
        name: 'Profile',
        icon: ProfileCircle
    },
    {
        name: 'Billing',
        icon: CreditCard
    },
    {
        name: 'Logout',
        icon: LogOut,
        onClick: () => {
            localStorage.removeItem('tenantId');
            localStorage.removeItem('sessionId');
            router.navigate({ to: '/login' });
        }
    }
];

const Menu = () => {
    return (
        <div className='p-5'>
            <PageHeader name='Menu' />
            <div>
                {options.map(option => (
                    <div
                        key={option.name}
                        className='flex first:rounded-t-lg last:rounded-b-lg bg-slate-100 p-2 border-b last:border-0 transition-all hover:bg-slate-200 active:bg-slate-300'
                        onClick={option.onClick}
                    >
                        <option.icon className='mr-2' />
                        {option.name}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Menu;
