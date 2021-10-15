import { StringPublicKey } from '@oyster/common';
import { useMemo, useState } from 'react';
import { useRemoteStorage } from '../contexts';

export const useCreator = (id?: StringPublicKey) => {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [creator, setCreator] = useState({
    username: '',
    address: '',
    description: '',
    banner: '',
    image: '',
  });
  const { remoteStorage, isReady } = useRemoteStorage();
  useMemo(async () => {
    if (
      !hasLoaded &&
      isReady &&
      id &&
      creator.username.length === 0 &&
      creator.address.length === 0
    ) {
      const creator = await remoteStorage.getCreator(id);
      console.log(
        `Received creator from remote storage at useCreator; ${JSON.stringify(creator)}`,
      );
      setCreator(creator);
      setHasLoaded(true);
    }
  }, [isReady, hasLoaded]);

  return {
    creator,
    hasLoaded,
    setCreator,
  };
};
