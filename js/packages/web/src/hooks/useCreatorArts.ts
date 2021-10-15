import { useMeta } from '../contexts';
import { decodeMetadata, StringPublicKey, useConnection } from '@oyster/common';
import { useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';

export const useCreatorArts = (id?: StringPublicKey) => {
  const { metadata } = useMeta();
  // const connection = useConnection();
  // const [accounts, setAccounts] = useState<any>([]);
  // useMemo(async () => {
  //   if (accounts.length > 0 || id == null) {
  //     return;
  //   }

  //   const cached = metadata.filter(m =>
  //     m.info.data.creators?.some(c => c.address === id),
  //   );
  //   if (cached.length === 0) {
  //     console.log(`Cached: ${JSON.stringify(cached)}`);
  //     setAccounts(cached);
  //     return;
  //   }

  //   // TODO: Rework to get other artworks
  //   if (id != null) {
  //     const accountInfo = await connection.getAccountInfo(new PublicKey(id));
  //     if (accountInfo != null) {
  //       const decoded = decodeMetadata(accountInfo.data);
  //       setAccounts({ pubkey: id, info: decoded, account: accountInfo });
  //     }
  //   }
  // }, [id, metadata]);
  // return accounts;

  const filtered = metadata.filter(m =>
    m.info.data.creators?.some(c => c.address === id),
  );
  return filtered;
};
