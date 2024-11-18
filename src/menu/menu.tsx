import { LogOut } from 'iconoir-react';
import React from 'react';

const options = [
    {
        name: 'Account',
        icon: LogOut
    },
    {
        name: 'Logout',
        icon: LogOut
    }
]

const Menu = () => {
    return (
        <div className='p-5'>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Menu</h1>
            {options.map(option => (
                <div key={option.name} className='first:rounded-t-lg last:rounded-b-lg bg-slate-100 p-2'>
                    {option.name}
                </div>
            ))}
        </div>
    );
};

export default Menu;
