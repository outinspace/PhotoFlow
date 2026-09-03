import { AccessRejected } from '../storage/bucket';

// A refused signature will be refused again, so an expired or revoked link should
// say so at once rather than after three silent retries. Anything else — a dropped
// connection on someone's phone — is still worth one more attempt.
export const retryUnlessRefused = (failureCount: number, error: Error) =>
    !(error instanceof AccessRejected) && failureCount < 2;
