import { queryClient } from '../app';
import * as keys from './keys';
import { writeJson } from './bucket';
import { DeviceLog, MergedState, OperationInput } from './mutations';

// This device's log. It is written locally first so the UI updates instantly and
// survives being offline, then pushed to the bucket shortly after. Only this
// device ever writes this object, which is what makes the whole scheme free of
// write conflicts.

const DEVICE_ID_KEY = 'photoflow.deviceId';
const LOG_KEY = 'photoflow.log';

// Mutations arrive in bursts — favouriting a few photos, selecting twenty and
// adding them to an album. Batching turns those into one upload.
const FLUSH_DELAY_MS = 1_500;

let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing: Promise<void> | null = null;

export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        // randomUUID is unavailable outside a secure context, and this only has to
        // be unique among the handful of devices one person uses.
        deviceId = crypto.randomUUID
            ? crypto.randomUUID()
            : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
};

export const readLocalLog = (): DeviceLog => {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) {
        try {
            return JSON.parse(raw) as DeviceLog;
        } catch {
            // A corrupt log would otherwise wedge every future mutation.
        }
    }
    return { deviceId: getDeviceId(), ops: [] };
};

const writeLocalLog = (log: DeviceLog) => localStorage.setItem(LOG_KEY, JSON.stringify(log));

export const appendOperations = (operations: OperationInput[]) => {
    const log = readLocalLog();
    const ts = new Date().toISOString();

    let seq = log.ops.reduce((highest, op) => Math.max(highest, op.seq), 0);
    for (const operation of operations) {
        log.ops.push({ ...operation, seq: ++seq, ts });
    }

    writeLocalLog(log);
    scheduleFlush();
};

const scheduleFlush = () => {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { void flush(); }, FLUSH_DELAY_MS);
};

export const flush = async (): Promise<void> => {
    // One upload at a time, so a burst of mutations cannot interleave two writes
    // of the same object and land the older one last.
    if (flushing) {
        return flushing;
    }

    flushing = (async () => {
        const log = readLocalLog();
        if (log.ops.length === 0) {
            return;
        }

        try {
            await writeJson(keys.deviceLog(log.deviceId), log);
        } catch {
            // Offline or a bad key: the log stays local and goes up next time.
            scheduleFlush();
        }
    })().finally(() => { flushing = null; });

    return flushing;
};

// Once the worker has folded this device's operations into meta/state.json, the
// local copies are redundant. Dropping them is what keeps the log from growing
// forever, and only this device ever prunes its own file.
export const pruneCompactedOperations = (state: MergedState) => {
    const log = readLocalLog();
    const cursor = state.cursors?.[log.deviceId] ?? 0;

    const remaining = log.ops.filter(op => op.seq > cursor);
    if (remaining.length === log.ops.length) {
        return;
    }

    writeLocalLog({ ...log, ops: remaining });

    // The published copy still holds the compacted operations; replace it so the
    // next merge does not have to skip over them again.
    void writeJson(keys.deviceLog(log.deviceId), { ...log, ops: remaining }).catch(() => undefined);
};

// Mutations change what the gallery shows, so the merged view is rebuilt from the
// local log immediately rather than waiting for the next sync.
export const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ['mutations'] });
};

// A page closing with unflushed operations would lose them until the next visit.
if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            void flush();
        }
    });
}
