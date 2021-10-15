import React from 'react';
import { Row, Col, Card, Layout, Carousel } from 'antd';
import { FileOutlined, LockOutlined } from '@ant-design/icons';
import { MetaAvatar } from '../../components/MetaAvatar';
import ReactTimeAgo from 'react-time-ago';
import { Artist } from '../../types';
import { shortenAddress } from '@oyster/common';

const { Content } = Layout;

const AuthorBadge = ({
  creator,
  showCommunity,
  communityName,
}: {
  creator: {
    username: string;
    address: string;
    image: string;
    name?: string;
  };
  showCommunity: boolean;
  communityName: string;
}) => {
  const { address, username } = creator;
  return (
    <div>
      <Content>
        <Row>
          <Col span={4}>
            <Row>
              <MetaAvatar creators={[creator as Artist]} size={64} />
            </Row>
          </Col>
          <Col span={20}>
            <Row>
              <span style={{ fontSize: '1.2rem' }} className="creator-name">
                {username}
              </span>
            </Row>
            <Row>
              {showCommunity && communityName && communityName.length > 0 ? (
                <span>Via {communityName}</span>
              ) : (
                address && (
                  <span
                    style={{ fontSize: '1rem', color: '#e0e0e0' }}
                    className="creator-address"
                  >
                    {shortenAddress(address)}
                  </span>
                )
              )}
            </Row>
          </Col>
        </Row>
      </Content>
    </div>
  );
};

const FileCarousel = ({ files = [], filePaths = [] }) => {
  const refs = [] as any[];

  const downloadNames = filePaths.map(url => {
    const chunks = new URL(url).pathname.split('/');
    return chunks[chunks.length - 1];
  });

  return (
    <Carousel
      dots={true}
      dotPosition="bottom"
      style={{
        background: 'white',
        marginBottom: 16,
        paddingBottom: 0,
        textAlign: 'center',
      }}
    >
      {files.map((file, index) => {
        if (file == null) {
          return;
        }

        const { type } = file as File;
        const ref = React.createRef();
        refs.push(ref);
        const url = URL.createObjectURL(file);
        return (
          <div key={index}>
            {type.startsWith('image/') ? (
              <img
                ref={ref as any}
                src={url}
                style={{ width: '100%', objectFit: 'cover' }}
              ></img>
            ) : type.startsWith('video/mp4') ? (
              <video
                controls={true}
                ref={ref as any}
                src={url}
                style={{ width: '100%', objectFit: 'cover' }}
              ></video>
            ) : (
              <Content style={{ textAlign: 'center' }}>
                <Row>
                  <Col span={24}>
                    <a
                      ref={ref as any}
                      href={url}
                      download={downloadNames[index]}
                      style={{
                        width: '100%',
                        lineHeight: '140px',
                        fontSize: '84px',
                      }}
                    >
                      <FileOutlined style={{ color: "#768BF9" }}></FileOutlined>
                    </a>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <span
                      style={{
                        fontSize: '1rem',
                        lineHeight: '32px',
                        color: 'white',
                      }}
                    >
                      {downloadNames[index]}
                    </span>
                  </Col>
                </Row>
              </Content>
            )}
          </div>
        );
      })}
    </Carousel>
  );
};

export const Post = ({
  post: {
    creator,
    communityName,
    content,
    visibility,
    filePaths,
    files,
    creationDate,
  },
  showCommunity = false,
}) => {
  console.log(`Showing post with content ${content}`);
  return (
    <div style={{ width: '100%' }}>
      <Card
        style={{ marginTop: 64 }}
        title={
          creator && (
            <AuthorBadge
              creator={creator}
              showCommunity={showCommunity}
              communityName={communityName}
            ></AuthorBadge>
          )
        }
        cover={
          files &&
          filePaths && (
            <FileCarousel files={files} filePaths={filePaths}></FileCarousel>
          )
        }
        extra={
          creationDate && (
            <ReactTimeAgo date={new Date(creationDate)} locale="en-US" />
          )
        }
      >
        {content ? (
          <p style={{ color: 'white' }}>{content}</p>
        ) : (
          <Content>
            <Row>
              <Col span={24} style={{ textAlign: 'center' }}>
                <LockOutlined
                  style={{ fontSize: 64, color: 'white', textAlign: 'center' }}
                  size={64}
                />
                <p style={{ marginTop: 32 }}>
                  {visibility === 'subscribers'
                    ? 'Subscribe to access this content'
                    : 'Join the community to access this content'}
                </p>
              </Col>
            </Row>
          </Content>
        )}
      </Card>
    </div>
  );
};
