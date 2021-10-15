import React, { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Layout,
  Skeleton,
  Button,
  Tag,
  Tooltip,
  Select,
  Form,
  InputNumber,
  Switch,
  message,
  Upload,
  Input,
} from 'antd';
import { Link, useParams } from 'react-router-dom';
import {
  AuctionView,
  useArt,
  useCreator,
  useCreators,
  useExtendedArt,
  useUserBalance,
} from '../../hooks';
import { ArtContent } from '../../components/ArtContent';
import {
  AuctionManagerStatus,
  shortenAddress,
  StringPublicKey,
  useConnection,
} from '@oyster/common';
import { MetaAvatar } from '../../components/MetaAvatar';
import { useRemoteStorage } from '../../contexts';
import { AuctionViewState, useAuctions } from '../../hooks';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Post } from '../../components/Post';
import { ArtMinting } from '../../components/ArtMinting';
import { useWallet } from '@solana/wallet-adapter-react';
import { sendSignMetadata } from '../../actions/sendSignMetadata';
import { PlusOutlined, InboxOutlined } from '@ant-design/icons';
import {
  deserializeSubscription,
  paySubscription,
  withdrawFunds,
} from '../../actions/subscription';
import { QUOTE_MINT } from '../../constants';
import { LAMPORT_MULTIPLIER } from '../../utils/assets';

const { Content } = Layout;
const { Option } = Select;

const fileListUploadEvent = event => {
  console.log('Upload event:', event);

  if (Array.isArray(event)) {
    return event;
  }

  return event && event.fileList;
};

const getLiveAuctionDetails = (auctions: AuctionView[], title) =>
  auctions
    .filter(
      ({ auctionManager, items }) =>
        auctionManager.status !== AuctionManagerStatus.Finished &&
        items.some(auctionItems =>
          auctionItems.some(
            ({ metadata: { info } }) =>
              info && info.data && info.data.name === title,
          ),
        ),
    )
    .map(
      ({
        auction: {
          pubkey,
          info: {
            bidState: { bids },
          },
        },
      }) => {
        // console.log(
        //   `Mapping auction ${pubkey}; bids: ${JSON.stringify(
        //     bids,
        //   )}; as numbers: ${JSON.stringify(
        //     bids.map(({ amount }) => amount.toNumber()),
        //   )}`,
        // );
        return {
          pubkey,
          highestBid:
            bids.length === 0
              ? 0
              : Math.max(
                  ...bids.map(
                    ({ amount }) => amount.toNumber() / LAMPORTS_PER_SOL,
                  ),
                ),
        };
      },
    )
    .sort((a, b) => a.highestBid - b.highestBid);

const secondsToDays = seconds => seconds / (60 * 60 * 24);

const periodToDays = ({ period_amount, period_type }) =>
  period_type === 'months'
    ? period_amount * 30
    : period_type === 'weeks'
    ? period_amount * 7
    : period_amount;

const PostCreator = ({
  props: {
    creatingPost,
    setCreatingPost,
    remoteStorage,
    id,
    pubkey,
    setPosts,
    posts,
    data,
  },
}) => {
  if (!creatingPost) {
    return (
      <Col span={24} style={{ textAlign: 'center', marginTop: 64 }}>
        <Tooltip title="Create Post">
          <Button
            onClick={() => setCreatingPost(true)}
            style={{
              width: '82px',
              height: '82px',
              background: '#768BF9',
            }}
            type="primary"
            icon={<PlusOutlined style={{ color: 'white', fontSize: 32 }} />}
            shape="circle"
            size="large"
          />
        </Tooltip>
      </Col>
    );
  }

  const createPost = async props => {
    console.log(`Create post with props ${JSON.stringify(props)}`);
    const post = await remoteStorage.createPost(id, pubkey)(props);
    console.log(`Create post result: ${JSON.stringify(post)}`);
    setCreatingPost(false);
    message.success('Successfully created the post');

    setPosts([post, ...posts]);
    // setPosts([...posts, { author: pubkey, community: id, ...result }]);
  };

  return (
    <Form
      style={{ marginTop: 64 }}
      name="validate_other"
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 14 }}
      onFinish={createPost}
    >
      <Form.Item
        name="content"
        label="Content"
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Input.TextArea rows={16} />
      </Form.Item>
      <Form.Item
        name="visibility"
        label="Visibility"
        rules={[
          {
            required: true,
            message: 'Please select who will be able to see the post.',
          },
        ]}
      >
        <Select placeholder="Please select a visibility level">
          <Option value="public">Public</Option>
          <Option value="community">Community (anyone with the token)</Option>
          {data && data.subscriptionConfig && (
            <Option value="subscribers">Subscriber-only</Option>
          )}
        </Select>
      </Form.Item>

      <Form.Item label="Dragger">
        <Form.Item
          name="dragger"
          valuePropName="fileList"
          getValueFromEvent={fileListUploadEvent}
          noStyle
        >
          <Upload.Dragger
            name="files"
            customRequest={remoteStorage.uploadFile(id)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Support for a single or bulk upload.
            </p>
          </Upload.Dragger>
        </Form.Item>
      </Form.Item>

      <Form.Item
        wrapperCol={{
          span: 12,
          offset: 6,
        }}
      >
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
};

export const ArtView = () => {
  const { id } = useParams<{ id: string }>();
  const [creatingPost, setCreatingPost] = useState(false);
  const wallet = useWallet();
  const connection = useConnection();
  const pubkey = wallet?.publicKey?.toBase58() || '';
  const [remountArtMinting, setRemountArtMinting] = useState(0);
  const art = useArt(id);
  console.log(`Using art ${JSON.stringify(art)}`);
  const { creators: extendedCreators, hasLoaded: hasLoadedCreators } =
    useCreators(art.creators);
  console.log(
    `Extended creators: ${JSON.stringify(
      extendedCreators,
    )}; have loaded? ${hasLoadedCreators}`,
  );
  // const [{ address: creatorAddress }] = art.creators || [];
  const auctions = useAuctions(AuctionViewState.Live);
  const liveAuctions = getLiveAuctionDetails(auctions, art.title);
  const balance = useUserBalance(QUOTE_MINT.toBase58());
  const myTokenAccount = balance.accounts[0];

  const { remoteStorage, isReady: isRemoteStorageReady } = useRemoteStorage();
  const [posts, setPosts] = useState<any>([]);

  useMemo(async () => {
    if (isRemoteStorageReady) {
      const posts = await remoteStorage.getPosts(id);
      setPosts(posts);
    }
  }, [isRemoteStorageReady]);

  const { data } = useExtendedArt(id);
  console.log(`Extended art: ${JSON.stringify(data)}`);
  const [subscription, setSubscription] = useState<any>();
  const [ownerIndex, setOwnerIndex] = useState(-1 as number);

  useMemo(async () => {
    if (!connection || !art || !art.subscription) {
      return;
    }

    const info = await connection.getAccountInfo(
      new PublicKey(art.subscription),
    );
    if (info == null) {
      return;
    }

    const deserialized = deserializeSubscription(Buffer.from(info.data));
    setSubscription(deserialized);
    const ownerIndex = deserialized.ownerAddresses.findIndex(
      owner => owner === pubkey,
    );
    setOwnerIndex(ownerIndex);
  }, [connection, data]);

  const tag = (
    <div className="info-header">
      <Tag color="blue">UNVERIFIED</Tag>
    </div>
  );

  const postCreator = useMemo(() => {
    return (
      <PostCreator
        props={{
          creatingPost,
          setCreatingPost,
          remoteStorage,
          id,
          pubkey,
          setPosts,
          posts,
          data,
        }}
      />
    );
  }, [creatingPost]);

  const CreatorBadge = ({ creator, index }) => {
    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 5,
        }}
      >
        <MetaAvatar creators={[creator]} size={64} />
        <div>
          <span className="creator-name">
            {creator.username ||
              creator.name ||
              shortenAddress(creator.address || '')}
          </span>
          <div style={{ marginLeft: 10 }}>
            {!creator.verified &&
              (creator.address === pubkey ? (
                <Button
                  onClick={async () => {
                    try {
                      await sendSignMetadata(connection, wallet, id);
                    } catch (e) {
                      console.error(e);
                      return false;
                    }
                    return true;
                  }}
                >
                  Approve
                </Button>
              ) : (
                tag
              ))}
          </div>
        </div>
      </div>
    );
  };

  const SubscriptionComponent = ({ subscription }) => {
    return (
      <Row>
        <Col span={24}>
          <h6 style={{ marginTop: 5 }}>Subscription</h6>
          <Row>
            <span style={{ fontSize: '1.2rem' }}>
              Price: <b>{subscription.price / LAMPORT_MULTIPLIER}</b>◎ every
              <b>{` ${secondsToDays(subscription.periodDuration)}`}</b> days
            </span>
          </Row>
          <Row>
            <span style={{ fontSize: '1.2rem' }}>
              Status:{' '}
              {subscription.paidUntil > new Date().getTime() / 1000 ? (
                <span
                  style={{
                    fontWeight: 800,
                    // color: 'white',
                    // background: '#768BF9',
                  }}
                >
                  Paid until:{' '}
                  {new Date(subscription.paidUntil * 1000).toDateString()}
                </span>
              ) : (
                <span
                  style={{
                    fontWeight: 800,
                    // color: 'white',
                    // background: '#768BF9',
                  }}
                >
                  Unpaid
                </span>
              )}
            </span>
          </Row>
          {art.mint &&
            !art.creators?.some(({ address }) => address === pubkey) && (
              <Row>
                <Button
                  onClick={() =>
                    paySubscription(
                      connection,
                      wallet,
                      myTokenAccount.pubkey,
                      art.subscription as StringPublicKey,
                      subscription.price / LAMPORT_MULTIPLIER,
                      art.mint as StringPublicKey,
                    )
                  }
                  style={{
                    color: 'white',
                    fontWeight: 1000,
                    background: '#768BF9',
                  }}
                  size="large"
                >
                  {subscription.paidUntil < new Date().getTime() / 1000
                    ? 'Pay now'
                    : 'Extend subscription'}
                </Button>
              </Row>
            )}
        </Col>
      </Row>
    );
  };

  const SubscriptionInfo = ({ subscriptionConfig }) => {
    return (
      <Row>
        <Col span={24}>
          <h6 style={{ marginTop: 5 }}>Subscription Info</h6>
          <Row>
            <span style={{ fontSize: '1.2rem' }}>
              Price: <b>{subscriptionConfig.price / LAMPORT_MULTIPLIER}</b>◎
              every
              <b>{` ${periodToDays(subscriptionConfig)}`}</b> days
            </span>
          </Row>
        </Col>
      </Row>
    );
  };

  const CreatorPayout = ({
    subscription: { totalPaid, withdrawnAmounts, ownerShares },
    ownerIndex,
  }) => {
    const maxToWithdraw =
      totalPaid * (ownerShares[ownerIndex] / 100) -
      withdrawnAmounts[ownerIndex];
    return (
      <Row>
        <Col span={24}>
          <h6 style={{ marginTop: 5 }}>Payout</h6>
          <Row>
            <span style={{ fontSize: '1.2rem' }}>
              Total paid: <b>{totalPaid / LAMPORT_MULTIPLIER}</b>◎. You have
              withdrawn {withdrawnAmounts[ownerIndex] / LAMPORT_MULTIPLIER}◎.
              You can withdraw up to{' '}
              <b>{maxToWithdraw / LAMPORT_MULTIPLIER}◎.</b>
            </span>
          </Row>
          {maxToWithdraw > 0 && (
            <Row>
              <Button
                onClick={() =>
                  withdrawFunds(
                    connection,
                    wallet,
                    myTokenAccount.pubkey,
                    art.subscription as StringPublicKey,
                    maxToWithdraw,
                    art.mint as StringPublicKey,
                  )
                }
                style={{
                  color: 'white',
                  fontWeight: 1000,
                  backgroundColor: '#4CAF50',
                }}
                size="large"
              >
                Withdraw
              </Button>
            </Row>
          )}
        </Col>
      </Row>
    );
  };

  return (
    <Content>
      <Col>
        <Row>
          <Col span={24}>
            <ArtContent
              style={{ maxHeight: '300px' }}
              height={300}
              className="artwork-image"
              pubkey={id}
              active={true}
              allowMeshRender={true}
            />
          </Col>
        </Row>
        <Row>
          <Col span={24} style={{ textAlign: 'center', fontSize: '1.4rem' }}>
            <div style={{ fontWeight: 700, fontSize: '4rem' }}>
              {art.title || <Skeleton paragraph={{ rows: 0 }} />}
            </div>
          </Col>
        </Row>
        <Row>
          <Col span={12}>
            <Row>
              <Col span={24}>
                <h6>Royalties</h6>
                <div className="royalties">
                  {((art.seller_fee_basis_points || 0) / 100).toFixed(2)}%
                </div>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <h6 style={{ marginTop: 5 }}>Created By</h6>
                <div className="creators" style={{ fontSize: '1.4rem' }}>
                  {hasLoadedCreators &&
                    extendedCreators.map((creator, index) => (
                      <CreatorBadge
                        key={index}
                        creator={creator}
                        index={index}
                      ></CreatorBadge>
                    ))}
                </div>
                <Row>
                  <Col span={12}>
                    <ArtMinting
                      id={id}
                      key={remountArtMinting}
                      subscriptionConfig={data ? data.subscriptionConfig : {}}
                      onMint={async () =>
                        await setRemountArtMinting(prev => prev + 1)
                      }
                    />
                  </Col>
                </Row>
              </Col>
            </Row>
            {subscription ? (
              <SubscriptionComponent subscription={subscription} />
            ) : (
              data &&
              data.subscriptionConfig && (
                <SubscriptionInfo
                  subscriptionConfig={data.subscriptionConfig}
                ></SubscriptionInfo>
              )
            )}
            {subscription && ownerIndex >= 0 && (
              <CreatorPayout
                subscription={subscription}
                ownerIndex={ownerIndex}
              />
            )}
          </Col>
          <Col span={12}>
            {data && data.description && (
              <Row>
                <Col span={24}>
                  <h6>Description</h6>
                  <div className="description" style={{ fontSize: '1rem' }}>
                    {data.description}
                  </div>
                </Col>
              </Row>
            )}
            {liveAuctions.length === 0 ? (
              <Row>
                <span
                  style={{ fontWeight: 600, fontSize: '1rem', marginTop: 48 }}
                >
                  There are no auctions for this item right now. Stay posted and
                  check back later!
                </span>
              </Row>
            ) : (
              <Col span={24}>
                <Row>
                  <h2>Ongoing Auctions</h2>
                </Row>
                <Row style={{ fontSize: '1.2rem' }}>
                  <Col span={12}>
                    <h6>Address</h6>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <h6>Current Price</h6>
                  </Col>
                </Row>
                {liveAuctions.map(({ pubkey, highestBid }, index) => (
                  <Row
                    key={index}
                    style={{ fontSize: '1.5rem', lineHeight: '32px' }}
                  >
                    <Col span={12}>
                      <Link to={`/auction/${pubkey}`}>
                        <span style={{ textAlign: 'left' }} title={pubkey}>
                          {shortenAddress(pubkey)}
                        </span>
                      </Link>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                      <span title={highestBid.toString()}>◎{highestBid}</span>
                    </Col>
                  </Row>
                ))}
              </Col>
            )}
          </Col>
        </Row>
        {art.creators?.some(({ address }) => address === pubkey) && postCreator}
        <Row>
          <Col xl={12} md={18} sm={24} xs={24} style={{ margin: '0 auto' }}>
            <Row>
              {posts.map((post, index) => (
                <Post key={index} post={post}></Post>
              ))}
            </Row>
          </Col>
        </Row>
      </Col>
    </Content>
  );
};
