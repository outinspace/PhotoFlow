import React, { useEffect, useState } from 'react';
import constants from '../constants';
import { useNavigate } from '@tanstack/react-router';

const Login = () => {
    const [tenantValue, setTenantValue] = useState('');
    const [emailValue, setEmailValue] = useState('');
    const [passwordValue, setPasswordValue] = useState('');

    const navigate = useNavigate({ from: '/login' });

    // Check session
    useEffect(() => {
        const tenantId = localStorage.getItem('tenantId');
        const sessionId = localStorage.getItem('sessionId');

        if (tenantId && sessionId) {
            navigate({ to: '/gallery' });
        }
    }, []);

    const authenticateSession = async (tenantName: string, email: string, password: string) => {
        const params = new URLSearchParams({
            tenantName,
            email,
            password
        });

        const res = await fetch(constants.apiUrl + '/session/login?' + params, {
            method: 'POST'
        });

        if (res.ok) {
            const body = await res.json();

            localStorage.setItem('tenantId', body.tenantId);
            localStorage.setItem('sessionId', body.sessionId);

            navigate({ to: '/gallery' });
        } else {
            // TODO: Fancy toast
            alert('Login failed');
        }
    };

    return (
        <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="text-center text-3xl font-bold italic text-gray-900">
                    PhotoFlow
                </h2>
            </div>

            <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900">
                            Family / Organization Name
                        </label>
                        <div className="mt-2">
                            <input
                                onChange={e => setTenantValue(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm/6"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900">
                            Email Address
                        </label>
                        <div className="mt-2">
                            <input
                                onChange={e => setEmailValue(e.target.value)}
                                type="email"
                                required
                                autoComplete="email"
                                className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm/6"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900">
                                Password
                            </label>
                        </div>
                        <div className="mt-2">
                            <input
                                onChange={e => setPasswordValue(e.target.value)}
                                type="password"
                                required
                                autoComplete="current-password"
                                className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm/6"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            className="flex w-full justify-center rounded-md bg-sky-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            onClick={() => authenticateSession(tenantValue, emailValue, passwordValue)}
                        >
                            Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

};


export default Login;
