import React, { useContext, useMemo, useState } from 'react';
import { useRemoteStorage } from './remote-storage';
import { Artist } from '../types';
import { useWallet } from '@solana/wallet-adapter-react';

type ProfileConfig = {
  creator: Artist;
  hasLoaded: Boolean;
  setCreator: (any) => void;
};

const ProfileProviderContext = React.createContext<ProfileConfig>({
  creator: {
    username: '',
    address: '',
    image: '',
  } as Artist,
  hasLoaded: false,
  setCreator: () => {},
});

export const ProfileProvider = ({ children = null as any }) => {
  const { publicKey } = useWallet();
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
      isReady &&
      publicKey &&
      creator.username.length === 0 &&
      creator.address.length === 0
    ) {
      const creator = await remoteStorage.getCreator(publicKey.toBase58());
      console.log(
        `Received creator from remote storage at ProfileProvider; ${JSON.stringify(creator)}`,
      );
      setCreator(creator);
      setHasLoaded(true);
    }
  }, [isReady]);

  return (
    <ProfileProviderContext.Provider
      value={{
        creator,
        hasLoaded,
        setCreator,
      }}
    >
      {children}
    </ProfileProviderContext.Provider>
  );
};

export function useProfile() {
  return useContext(ProfileProviderContext);
}
