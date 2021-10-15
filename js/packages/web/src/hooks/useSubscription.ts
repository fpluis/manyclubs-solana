import { useMemo, useState } from 'react';
import { StringPublicKey, useConnection } from '@oyster/common';
import { PublicKey } from '@solana/web3.js';
import { deserializeSubscription } from '../actions/subscription';

export const useSubscription = (key?: StringPublicKey) => {
  const connection = useConnection();
  const [subscription, setSubscription] = useState({});

  useMemo(async () => {
    if (!connection || !key) {
      return;
    }

    const info = await connection.getAccountInfo(new PublicKey(key));
    if (info == null) {
      return;
    }

    const deserialized = deserializeSubscription(Buffer.from(info.data));
    setSubscription(deserialized);
  }, [connection]);

  return subscription;
};
