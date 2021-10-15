import {
  AccountsProvider,
  ConnectionProvider,
  StoreProvider,
  WalletProvider,
  MetaProvider,
} from '@oyster/common';
import { FC } from 'react';
import { ConfettiProvider } from './components/Confetti';
import { AppLayout } from './components/Layout';
import { CoingeckoProvider } from './contexts/coingecko';
import { RemoteStorageProvider } from './contexts/remote-storage';
import { ProfileProvider } from './contexts/profile';

export const Providers: FC = ({ children }) => {
  return (
    <ConnectionProvider>
      <WalletProvider>
        <AccountsProvider>
          <CoingeckoProvider>
            <StoreProvider
              ownerAddress={process.env.NEXT_PUBLIC_STORE_OWNER_ADDRESS}
              storeAddress={process.env.NEXT_PUBLIC_STORE_ADDRESS}
            >
              <MetaProvider>
                <ConfettiProvider>
                  <RemoteStorageProvider>
                    <ProfileProvider>
                      <AppLayout>{children}</AppLayout>
                    </ProfileProvider>
                  </RemoteStorageProvider>
                </ConfettiProvider>
              </MetaProvider>
            </StoreProvider>
          </CoingeckoProvider>
        </AccountsProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
