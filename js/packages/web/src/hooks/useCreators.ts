import { useMemo, useState } from 'react';
import { useRemoteStorage } from '../contexts';
import { Artist } from '../types';

export const useCreators = (creators?: Artist[]) => {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [extendedCreators, setCreators] = useState<Artist[]>([]);
  const { remoteStorage, isReady } = useRemoteStorage();
  useMemo(async () => {
    if (!hasLoaded && isReady && creators && creators.length > 0) {
      const withExternalProps = await Promise.all(
        creators.map(async ({ address, ...props }) => {
          if (!address) {
            return { address, ...props };
          }

          try {
            const externalProps = await remoteStorage.getCreator(address);
            return { ...props, ...externalProps, address,  };
          } catch (error) {
            return { address, ...props };
          }
        }),
      );
      console.log(
        `Received creators from remote storage at useCreators; ${JSON.stringify(
          withExternalProps,
        )}`,
      );
      setCreators(withExternalProps);
      setHasLoaded(true);
    }
  }, [isReady, hasLoaded, creators]);

  return {
    creators: extendedCreators,
    hasLoaded,
  };
};
