import { Col, Divider, Row } from 'antd';
import React, { useMemo, useState } from 'react';
import Masonry from 'react-masonry-css';
import { Link, useParams } from 'react-router-dom';
import { ArtCard } from '../../components/ArtCard';
import { ArtContent } from '../../components/ArtContent';
import { CardLoader } from '../../components/MyLoader';
import { Post } from '../../components/Post';
import { useRemoteStorage } from '../../contexts';
import { metadataToArt, useCreator, useCreatorArts } from '../../hooks';
import { useMeta } from '@oyster/common';
import { ArtType } from '../../types';

const DEFAULT_BANNER =
  'https://cdn.pixabay.com/photo/2021/09/12/07/58/banner-6617550_960_720.png';

export const ArtistView = () => {
  const { editions, masterEditions, whitelistedCreatorsByCreator } = useMeta();
  const { id } = useParams<{ id: string }>();
  const { creator } = useCreator(id);
  const communities = useCreatorArts(id);
  console.log(`Creator communities: ${JSON.stringify(communities)}`);
  const onlyMasterKeys = communities.filter(community => {
    const asArt = metadataToArt(
      community.info,
      editions,
      masterEditions,
      whitelistedCreatorsByCreator,
    );
    console.log(`Metadata as art: ${JSON.stringify(asArt)}`);
    return asArt.type === ArtType.Master;
  });
  const [posts, setPosts] = useState<any[]>([]);
  const { remoteStorage, isReady: isRemoteStorageReady } = useRemoteStorage();
  const breakpointColumnsObj = {
    default: 3,
    700: 2,
    500: 1,
  };

  useMemo(async () => {
    if (isRemoteStorageReady) {
      const masterPubkeys = onlyMasterKeys.map(({ pubkey }) => pubkey);
      const posts = await remoteStorage.getCreatorPosts(masterPubkeys);
      console.log(`Artist ${id}'s posts: ${JSON.stringify(posts)}`);
      setPosts(posts);
    }
  }, [isRemoteStorageReady]);

  const artworkGrid =
    onlyMasterKeys.length > 0 ? (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="my-masonry-grid"
        columnClassName="my-masonry-grid_column"
      >
        {onlyMasterKeys.map((m, idx) => {
          const id = m.pubkey;
          return (
            <Link to={`/art/${id}`} key={idx}>
              <ArtCard key={id} pubkey={m.pubkey} preview={false} />
            </Link>
          );
        })}
      </Masonry>
    ) : (
      <p style={{ fontSize: 18, fontWeight: 300, color: 'white' }}>
        This creator hasn't created any clubs yet.
      </p>
    );
  const postsColumn = (
    <Masonry
      breakpointCols={{ default: 1 }}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {posts.map((post, index) => (
        <Post key={index} post={post}></Post>
      ))}
    </Masonry>
  );

  return (
    <>
      <Col>
        <Divider />
        <Row
          style={{ margin: '0 30px', textAlign: 'left', fontSize: '1.4rem' }}
        >
          <Col span={24}>
            <ArtContent
              style={{ maxHeight: '300px' }}
              height={300}
              className="artwork-image"
              uri={creator.banner || DEFAULT_BANNER}
              active={true}
              allowMeshRender={true}
            />
          </Col>
          <Col span={18} style={{ margin: '0 auto' }}>
            <h2 style={{ textAlign: 'center' }}>
              {/* <MetaAvatar creators={creator ? [creator] : []} size={100} /> */}
              {creator?.username}
            </h2>
            <h4 style={{ textAlign: 'center' }}>{creator?.address}</h4>
            <br />
            <div className="info-header">ABOUT ME</div>
            <div className="info-content">{creator?.description}</div>
            <br />
            <div className="info-header">Clubs</div>
            {artworkGrid}
            <div className="info-header">Posts</div>
            {postsColumn}
          </Col>
        </Row>
      </Col>
    </>
  );
};
