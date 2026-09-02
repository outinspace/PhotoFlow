import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, QrCode, WarningTriangle } from 'iconoir-react';
import { TopBar } from '../common/top.bar';
import { getStorageConfig } from '../storage/config';
import { buildHandoffUrl } from '../storage/handoff';

// Scanning this sets up the phone in one step, instead of typing an endpoint and a
// forty-character secret on a touch keyboard.
//
// The code contains the bucket credentials, so it is not rendered until asked for
// and is taken away again shortly after. That is a real limit, not a formality:
// a photograph of this screen is as good as the key.

const VISIBLE_FOR_SECONDS = 60;

const LinkDevice = () => {
    const config = getStorageConfig();

    const [visible, setVisible] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(VISIBLE_FOR_SECONDS);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const hide = useCallback(() => {
        setVisible(false);
        setSecondsLeft(VISIBLE_FOR_SECONDS);
    }, []);

    useEffect(() => {
        if (!visible || !config) {
            return;
        }

        // Loaded on demand so the QR library stays out of every other page.
        let cancelled = false;
        import('qrcode').then(({ default: QRCode }) => {
            if (cancelled || !canvasRef.current) {
                return;
            }
            QRCode.toCanvas(canvasRef.current, buildHandoffUrl(config), {
                width: 260,
                margin: 1,
                errorCorrectionLevel: 'L'
            });
        });

        return () => { cancelled = true; };
    }, [visible, config]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft(remaining => {
                if (remaining <= 1) {
                    hide();
                    return VISIBLE_FOR_SECONDS;
                }
                return remaining - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [visible, hide]);

    const copyLink = async () => {
        if (!config) {
            return;
        }

        try {
            await navigator.clipboard.writeText(buildHandoffUrl(config));
            toast.success('Link copied');
        } catch {
            toast.error('Could not copy the link');
        }
    };

    return (
        <div className='flex flex-auto flex-col overflow-hidden'>
            <TopBar title='Link device' />

            <div className='mx-auto w-full max-w-md flex-auto space-y-6 overflow-auto p-5'>
                {!config ? (
                    <p className='text-sm text-slate-600'>
                        Connect this browser to your bucket first, then you can pass that
                        connection to another device from here.
                    </p>
                ) : (
                    <>
                        <p className='text-sm text-slate-600'>
                            Scan this on your phone to connect it to the same bucket, instead of typing
                            the endpoint and secret key by hand.
                        </p>

                        <div className='flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900'>
                            <WarningTriangle className='mt-0.5 size-5 shrink-0' />
                            <div>
                                <div className='font-medium'>The code contains your bucket key</div>
                                <p className='mt-1'>
                                    Anyone who photographs it, or sees a screenshot of it, can write to your
                                    bucket. Show it only when the phone is in your hand, and rotate the key at
                                    your provider if you think it has been seen.
                                </p>
                            </div>
                        </div>

                        {visible ? (
                            <div className='flex flex-col items-center gap-3'>
                                <div className='rounded-xl bg-white p-3 ring-1 ring-slate-200'>
                                    <canvas ref={canvasRef} />
                                </div>
                                <div className='text-xs text-slate-500'>
                                    Hiding in {secondsLeft}s
                                </div>
                                <button
                                    type='button'
                                    onClick={hide}
                                    className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700'
                                >
                                    Hide now
                                </button>
                            </div>
                        ) : (
                            <button
                                type='button'
                                onClick={() => setVisible(true)}
                                className='flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white'
                            >
                                <QrCode className='size-5' />
                                Show QR code
                            </button>
                        )}

                        <div className='border-t border-slate-100 pt-4'>
                            <button
                                type='button'
                                onClick={copyLink}
                                className='flex items-center gap-2 text-sm text-slate-600'
                            >
                                <Copy className='size-4' />
                                Copy the link instead
                            </button>
                            <p className='mt-1.5 text-xs text-slate-400'>
                                For a device that cannot scan. Treat the link like a password — the
                                credentials are in it.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LinkDevice;
