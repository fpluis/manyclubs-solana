import { Col, Row, Layout } from 'antd';
import React, { useMemo, useState } from 'react';
import Masonry from 'react-masonry-css';
import { Link } from 'react-router-dom';
import { ArtistCard } from '../../components/ArtistCard';
import { useRemoteStorage } from '../../contexts';

const { Content } = Layout;

export const ArtistsView = () => {
  const { remoteStorage, isReady } = useRemoteStorage();
  const [creators, setCreators] = useState<any>([]);

  useMemo(async () => {
    if (isReady) {
      const creators = await remoteStorage.getCreators();
      console.log(`Found creators: ${JSON.stringify(creators)}`);
      setCreators(creators);
    }

    return [];
  }, [isReady]);

  const artistGrid = (
    <Masonry
      breakpointCols={{
        default: 3,
        700: 2,
        500: 1,
      }}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {creators.map(
        ({ username, image, description, banner, address }, idx) => {
          return (
            <Link to={`/artists/${address}`} key={idx}>
              <ArtistCard
                artist={{
                  address,
                  username: username || '',
                  image: image || '',
                  description: description || '',
                  banner: banner || '',
                }}
              />
            </Link>
          );
        },
      )}
    </Masonry>
  );

  return (
    <Layout style={{ margin: 0, marginTop: 30 }}>
      <Content
        style={{ display: 'flex', flexWrap: 'wrap', textAlign: 'center' }}
      >
        <Col style={{ width: '100%', marginTop: 10 }}>
          <h1 style={{ fontSize: 32, fontWeight: 600 }}>Creators</h1>
          {artistGrid}
        </Col>
      </Content>
    </Layout>
  );
};
