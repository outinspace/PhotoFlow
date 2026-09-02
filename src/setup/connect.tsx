import { useState } from 'react';
import { router } from '../routes';
import { getDefaultToMemories } from '../hooks/use.settings';
import { takeHandoffFromUrl } from '../storage/handoff';
import { StorageConnectionForm } from './storage.connection.form';
import logoUrl from '../assets/icon-192.png';

// First-run setup, and what a scanned device lands on. This screen stands in for
// signing in — there is no account and no server to authenticate against, so
// connecting means telling this browser which bucket to read and giving it a key
// to write with.
//
// It deliberately has no navigation around it: there is nowhere else to go until a
// bucket is connected. Changing an existing connection happens on the storage
// settings page instead, which keeps its own navigation.

const Connect = () => {
    // Read before first render, and removed from the URL in the same step, so the
    // credentials never sit in the address bar or in history.
    const [handoff] = useState(takeHandoffFromUrl);

    return (
        <div className='flex min-h-full flex-1 flex-col px-6 py-12 lg:px-8'>
            {/* m-auto rather than justify-center: it centres the same way when there
                is room, but collapses when there is not, so a short window scrolls
                to the logo instead of clipping it out of reach. */}
            <div className='m-auto w-full sm:max-w-sm'>
                <img src={logoUrl} alt='' className='mx-auto size-16 rounded-2xl shadow-sm' />
                <h1 className='mt-4 text-center text-3xl font-bold italic text-gray-900'>
                    PhotoFlow
                </h1>
                <p className='mt-3 text-center text-sm text-gray-600'>
                    {handoff
                        ? 'Using the connection from your other device. These details stay in this browser and are never sent anywhere else.'
                        : 'Connect your own storage bucket. These details stay in this browser and are never sent anywhere else.'}
                </p>

                <div className='mt-10'>
                    <StorageConnectionForm
                        autoConnectWith={handoff}
                        onConnected={() => router.navigate({ to: getDefaultToMemories() ? '/memories' : '/gallery' })}
                    />
                </div>
            </div>
        </div>
    );
};

export default Connect;
