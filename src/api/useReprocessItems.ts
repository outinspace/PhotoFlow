import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { File } from "../types";
import * as keys from "../storage/keys";
import { writeJson } from "../storage/bucket";

// Asking for a file to be rebuilt leaves a request in the bucket for the worker
// to find. Nothing happens here and now: the derived files are remade on the next
// processing run, which the toast has to say plainly or the button looks broken.

export const useReprocessItems = () => {
    return useMutation({
        mutationFn: async (requested: File[]) => {
            // A Live Photo asked for twice, or one file requested from two places,
            // should still be one request.
            const files = [...new Map(requested.map(file => [file.fileId, file])).values()];

            await Promise.all(files.map(file =>
                // Named after the file, so asking twice — or from two devices —
                // writes the same request rather than two.
                writeJson(keys.reprocessRequest(file.fileId), {
                    fileId: file.fileId,
                    requestedAt: new Date().toISOString()
                })
            ));

            return files.length;
        },
        onSuccess: count => {
            toast.success(
                `${count} file${count === 1 ? '' : 's'} queued for reprocessing`,
                { duration: 5000 }
            );
        },
        onError: () => toast.error('Could not queue those files for reprocessing')
    });
}
