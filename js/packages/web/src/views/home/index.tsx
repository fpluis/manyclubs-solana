import { Layout, Spin, Button } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { decodeMetadata, useConnection, useStore, useWalletModal } from '@oyster/common';
import { useMeta, useRemoteStorage } from '../../contexts';
import { SetupView } from './setup';
import { Row, Col } from 'antd';
import { Post } from '../../components/Post';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

const { Content } = Layout;

export const HomeView = () => {
  const { isLoading, store } = useMeta();
  const { isConfigured } = useStore();
  const { remoteStorage, isReady: isRemoteStorageReady } = useRemoteStorage();
  const [posts, setPosts] = useState([] as any);
  const connection = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const connect = useCallback(
    () => (wallet.wallet ? wallet.connect().catch() : setVisible(true)),
    [wallet.wallet, wallet.connect, setVisible],
  );

  const getCommunityName = async id => {
    console.log(`Get community info of ${id}`);
    if (id == null || id.length === 0) {
      return '';
    }

    const communityInfo = await connection
      .getAccountInfo(new PublicKey(id))
      .catch(error => {
        console.log(error);
      });
    if (communityInfo == null) {
      return '';
    }

    console.log(`Decoding metadata ${JSON.stringify(communityInfo)}`);
    const decoded = decodeMetadata(communityInfo.data);
    console.log(`Decoded community data: ${JSON.stringify(decoded)}`);
    return decoded.data.name;
  };

  useMemo(async () => {
    if (isRemoteStorageReady) {
      try {
        const posts = await remoteStorage.getPosts();
        console.log(`Posts: ${JSON.stringify(posts)}`);
        setPosts(posts);
      } catch (error) {
        console.log(`Error getting posts:`);
        console.log(error);
        return;
      }
    }
  }, [isRemoteStorageReady]);

  console.log(
    `Is store configured? ${isConfigured}; store: ${JSON.stringify(store)}`,
  );
  const showSetupView = !isConfigured;
  const showPosts =
    store && !isLoading && isRemoteStorageReady && posts.length > 0;

  return (
    <Layout style={{ margin: 0, marginTop: 30, alignItems: 'center', width: "100%" }}>
      {showSetupView ? (
        <SetupView />
      ) : showPosts ? (
        <Content
          style={{
            margin: '0 auto',
            width: '60%',
            minWidth: '300px',
            maxWidth: '600px',
          }}
        >
          <Col span={24} sm={24} xs={24}>
            <h1 style={{ fontSize: 32, fontWeight: 600 }}>Latest posts on ManyClubs</h1>
            {posts.map((post, index) => (
              <Post key={index} post={post} showCommunity={true}></Post>
            ))}
          </Col>
        </Content>
      ) : !wallet.connected ? (
        <p>
          <Button type="primary" className="app-btn" onClick={connect}>
            Connect
          </Button>{' '}
        </p>
      ) : (
        <Spin></Spin>
      )}
    </Layout>
  );
};
