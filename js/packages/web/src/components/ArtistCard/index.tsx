import { Card, Image } from 'antd';
import { shortenAddress } from '@oyster/common';
import { MetaAvatar } from '../MetaAvatar';

export const ArtistCard = ({ artist }) => {
  const { username, banner, address, description } = artist;
  return (
    <Card
      hoverable={true}
      className={`artist-card`}
      cover={
        banner ? (
          <Image src={banner} style={{ objectFit: 'contain' }}></Image>
        ) : (
          <div style={{ height: 100 }} />
        )
      }
    >
      <div>
        <MetaAvatar creators={[artist]} size={100} />
        <div className="artist-card-name">
          {username || shortenAddress(address || '')}
        </div>
        <p className="artist-card-description">{description}</p>
      </div>
    </Card>
  );
};
