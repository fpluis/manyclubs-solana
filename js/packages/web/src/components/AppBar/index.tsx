import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Dropdown, Menu, Image } from 'antd';
import { ConnectButton, CurrentUserBadge } from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { Notifications } from '../Notifications';
import useWindowDimensions from '../../utils/layout';
import { MenuOutlined, UserOutlined } from '@ant-design/icons';
import { useMeta } from '../../contexts';

const CreatorProfile = ({ creator }) => {
  const { image: profilePicture, username } = creator;
  // console.log(
  //   `Displaying profile image ${profilePicture}`,
  // );
  return (
    <Link to={'/profile'}>
      <Button
        shape="circle"
        className="app-btn"
        style={{ backgroundColor: 'white', padding: 0 }}
      >
        <p style={{ display: 'none' }}>{profilePicture}</p>
        <Avatar
          size={32}
          alt={username}
          src={
            profilePicture ? (
              profilePicture
            ) : (
              <UserOutlined style={{ fontSize: 32, color: 'black' }} />
            )
          }
        ></Avatar>
      </Button>
    </Link>
  );
};

const UserActions = () => {
  const { publicKey } = useWallet();
  const { whitelistedCreatorsByCreator, store } = useMeta();
  const pubkey = publicKey?.toBase58() || '';

  const canCreate = useMemo(() => {
    return (
      store?.info?.public ||
      whitelistedCreatorsByCreator[pubkey]?.info?.activated
    );
  }, [pubkey, whitelistedCreatorsByCreator, store]);
  console.log(
    `Whitelisted creators: ${JSON.stringify(whitelistedCreatorsByCreator)}`,
  );

  return (
    <>
      {store && (
        <>
          {canCreate ? (
            <Link to={`/art/create`}>
              <Button className="app-btn">Create</Button>
            </Link>
          ) : null}
          <Link to={`/auction/create/0`}>
            <Button className="connector" type="primary">
              Sell
            </Button>
          </Link>
        </>
      )}
    </>
  );
};

const DefaultActions = ({ vertical = false }: { vertical?: boolean }) => {
  const { connected } = useWallet();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
      }}
    >
      <Link to={`/artists`}>
        <Button className="app-btn">Creators</Button>
      </Link>
      <Link to={`/artworks`}>
        <Button className="app-btn">
          {connected ? 'Clubs' : 'Clubs'}
        </Button>
      </Link>
      <Link to={`/marketplace`}>
        <Button className="app-btn">Marketplace</Button>
      </Link>
    </div>
  );
};

const MetaplexMenu = () => {
  const { width } = useWindowDimensions();
  const { connected } = useWallet();

  if (width < 768)
    return (
      <>
        <Dropdown
          arrow
          placement="bottomLeft"
          trigger={['click']}
          overlay={
            <Menu>
              <Menu.Item>
                <Link to={`/artists`}>
                  <Button className="app-btn">Creators</Button>
                </Link>
              </Menu.Item>
              <Menu.Item>
                <Link to={`/artworks`}>
                  <Button className="app-btn">
                    {connected ? 'Clubs' : 'Artworks'}
                  </Button>
                </Link>
              </Menu.Item>
              <Menu.Item>
                <Link to={`/`}>
                  <Button className="app-btn">Marketplace</Button>
                </Link>
              </Menu.Item>
            </Menu>
          }
        >
          <MenuOutlined style={{ fontSize: '1.4rem' }} />
        </Dropdown>
      </>
    );

  return <DefaultActions />;
};

export const AppBar = ({ creator, hasCreatorLoaded }) => {
  const wallet = useWallet();

  return (
    <>
      <div className="app-left app-bar-box">
        <Link to={`/`}>
          <Button className="app-btn">
            {/* <h1 className="title">K</h1> */}
            <img src="/manyclubs.png" width="48" />
          </Button>
        </Link>
        <div className="divider" />
        <MetaplexMenu />
      </div>
      {wallet.connected ? (
        <div className="app-right app-bar-box">
          {window.location.hash !== '#/analytics' && <Notifications />}
          <UserActions />
          <CurrentUserBadge
            showBalance={false}
            showAddress={false}
            iconSize={24}
          />
          {hasCreatorLoaded && (
            <CreatorProfile key={Date.now()} creator={creator} />
          )}
        </div>
      ) : (
        <ConnectButton type="primary" allowWalletChange />
      )}
    </>
  );
};
