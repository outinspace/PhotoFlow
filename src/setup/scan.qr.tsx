import { useCallback, useEffect, useRef, useState } from 'react';
import { Xmark } from 'iconoir-react';
import { StorageConfig } from '../storage/config';
import { decodeHandoffUrl } from '../storage/handoff';

// Scanning the code from inside the app, rather than with the phone's camera.
//
// A code scanned by the camera app opens the browser, and the credentials would
// be saved there — not in the installed app, which has its own separate storage.
// Chromium browsers can claim their own links through the manifest, but Safari
// cannot, so on iOS this is the only way to set up an installed app by scanning.

type Failure = 'insecure' | 'denied' | 'unavailable' | 'unreadable';

const MESSAGES: Record<Failure, string> = {
    insecure: 'The camera is only available over HTTPS.',
    denied: 'Camera access was refused. Allow it in your browser settings and try again.',
    unavailable: 'No camera was found on this device.',
    unreadable: 'That code is not a Photoflow connection code.'
};

export const ScanQrCode = ({ onScanned, onCancel }: {
    onScanned: (config: StorageConfig) => void;
    onCancel: () => void;
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [failure, setFailure] = useState<Failure | null>(null);

    // Held in a ref so the frame loop can stop itself without re-running the effect.
    const scanning = useRef(true);
    const handled = useRef(onScanned);
    handled.current = onScanned;

    const fail = useCallback((reason: Failure) => {
        scanning.current = false;
        setFailure(reason);
    }, []);

    useEffect(() => {
        if (!navigator.mediaDevices?.getUserMedia) {
            fail(window.isSecureContext ? 'unavailable' : 'insecure');
            return;
        }

        let stream: MediaStream | undefined;
        let frame = 0;

        const start = async () => {
            try {
                // The rear camera: the code is on another screen in front of you.
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            } catch (error) {
                fail((error as Error).name === 'NotAllowedError' ? 'denied' : 'unavailable');
                return;
            }

            const video = videoRef.current;
            if (!video || !scanning.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            video.srcObject = stream;
            await video.play().catch(() => undefined);

            // Loaded here so the decoder is not in the bundle of anyone who never scans.
            const { default: jsQR } = await import('jsqr');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });

            const read = () => {
                if (!scanning.current || !context || video.readyState !== video.HAVE_ENOUGH_DATA) {
                    frame = requestAnimationFrame(read);
                    return;
                }

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                const found = jsQR(
                    context.getImageData(0, 0, canvas.width, canvas.height).data,
                    canvas.width,
                    canvas.height,
                    { inversionAttempts: 'dontInvert' }
                );

                if (!found) {
                    frame = requestAnimationFrame(read);
                    return;
                }

                const config = decodeHandoffUrl(found.data);
                if (!config) {
                    // Some other QR code in view; say so rather than silently looping.
                    fail('unreadable');
                    return;
                }

                scanning.current = false;
                handled.current(config);
            };

            read();
        };

        void start();

        return () => {
            scanning.current = false;
            cancelAnimationFrame(frame);
            // Leaving the track open keeps the camera light on after the view closes.
            stream?.getTracks().forEach(track => track.stop());
        };
    }, [fail]);

    return (
        <div className='space-y-3'>
            {failure ? (
                <div className='rounded-lg bg-amber-50 p-4 text-sm text-amber-900'>{MESSAGES[failure]}</div>
            ) : (
                <div className='overflow-hidden rounded-xl bg-black'>
                    <video ref={videoRef} playsInline muted className='block w-full' />
                </div>
            )}

            <p className='text-xs text-gray-500'>
                Open <span className='font-medium'>Link Device</span> on the computer you are already
                connected on, and point this at the code.
            </p>

            <button
                type='button'
                onClick={onCancel}
                className='flex items-center gap-1.5 rounded-md px-3 py-2 text-sm/6 font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            >
                <Xmark className='size-4' />
                Cancel
            </button>
        </div>
    );
};
