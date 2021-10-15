import { PublicKey, AccountInfo } from '@solana/web3.js';

export type StringPublicKey = string;

export class LazyAccountInfoProxy<T> {
  executable: boolean = false;
  owner: StringPublicKey = '';
  lamports: number = 0;

  get data() {
    //
    return undefined as unknown as T;
  }
}

export interface LazyAccountInfo {
  executable: boolean;
  owner: StringPublicKey;
  lamports: number;
  data: [string, string];
}

const PubKeysInternedMap = new Map<string, PublicKey>();

export const toPublicKey = (key: string | PublicKey) => {
  if (typeof key !== 'string') {
    return key;
  }

  let result = PubKeysInternedMap.get(key);
  if (!result) {
    result = new PublicKey(key);
    PubKeysInternedMap.set(key, result);
  }

  return result;
};

export const pubkeyToString = (key: PublicKey | null | string = '') => {
  return typeof key === 'string' ? key : key?.toBase58() || '';
};

export interface PublicKeyStringAndAccount<T> {
  pubkey: string;
  account: AccountInfo<T>;
}

export const WRAPPED_SOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112',
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);

export const BPF_UPGRADE_LOADER_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

export const MEMO_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

export const METADATA_PROGRAM_ID =
  'EYv8MSZb7aTmN5VByWPvGtLVGr4Hqm9bjAvTrSF4iscb' as StringPublicKey;

export const VAULT_ID =
  'BaZCkxDGa2Nv48k6WoZNxT47Y4YaDBDyEF68FPcuBQmn' as StringPublicKey;

export const AUCTION_ID =
  'E6WaQgpxTKEguevLkAJkogfhBsgfnsGyD15Yk4THxreW' as StringPublicKey;

export const METAPLEX_ID =
  'EWxgMgz7jKA3qN5ET3h8p6FWdUW2Wp47ijcvTDfFLvsN' as StringPublicKey;

export const SUBSCRIPTION_ID = new PublicKey('JAaJhnfYAeEjKTtKs5iBJwU11x1Hq4NtmehhCYHb2JT2');

export const SYSTEM = new PublicKey('11111111111111111111111111111111');
