/**
 * Type declarations for argon2-browser - Phase 15
 * argon2-browser does not ship with @types; this shim provides minimal typings.
 */
declare module "argon2-browser" {
    export enum ArgonType {
        Argon2d = 0,
        Argon2i = 1,
        Argon2id = 2,
    }

    export interface HashOptions {
        pass: string | Uint8Array;
        salt: Uint8Array;
        time?: number;
        mem?: number;
        parallelism?: number;
        hashLen?: number;
        type?: ArgonType;
    }

    export interface HashResult {
        hash: Uint8Array;
        hashHex: string;
        encoded: string;
    }

    export function hash(opts: HashOptions): Promise<HashResult>;

    const argon2: {
        ArgonType: typeof ArgonType;
        hash: (opts: HashOptions) => Promise<HashResult>;
    };
    export default argon2;
}
