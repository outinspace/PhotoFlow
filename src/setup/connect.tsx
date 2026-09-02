import { useState } from 'react';
import { router } from '../routes';
import { getDefaultToMemories } from '../hooks/use.settings';
import { takeHandoffFromUrl } from '../storage/handoff';
import { StorageConnectionForm } from './storage.connection.form';
import { ScanQrCode } from './scan.qr';
import { StorageConfig } from '../storage/config';
import logoUrl from '../assets/icon-192.png';
import { QrCode } from 'iconoir-react';

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
    const [scanned, setScanned] = useState<StorageConfig | null>(null);
    const [scanning, setScanning] = useState(false);

    const received = scanned ?? handoff;

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
                    {received
                        ? 'Using the connection from your other device. These details stay in this browser and are never sent anywhere else.'
                        : 'Connect your own storage bucket. These details stay in this browser and are never sent anywhere else.'}
                </p>

                <div className='mt-10'>
                    {scanning ? (
                        <ScanQrCode
                            onScanned={config => {
                                setScanning(false);
                                setScanned(config);
                            }}
                            onCancel={() => setScanning(false)}
                        />
                    ) : (
                        <>
                            {!received && (
                                <div className='mb-6'>
                                    <button
                                        type='button'
                                        onClick={() => setScanning(true)}
                                        className='flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm/6 font-semibold text-white shadow-sm hover:bg-sky-500'
                                    >
                                        <QrCode className='size-5' />
                                        Scan a code from another device
                                    </button>
                                    <div className='mt-4 flex items-center gap-3 text-xs text-gray-400'>
                                        <span className='h-px flex-auto bg-gray-200' />
                                        or enter the details
                                        <span className='h-px flex-auto bg-gray-200' />
                                    </div>
                                </div>
                            )}

                            <StorageConnectionForm
                                autoConnectWith={received}
                                onConnected={() => router.navigate({ to: getDefaultToMemories() ? '/memories' : '/gallery' })}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Connect;
