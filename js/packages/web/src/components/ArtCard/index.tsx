import React, { useMemo, useState } from 'react';
import { Card, CardProps, Button, Badge } from 'antd';
import { MetadataCategory, StringPublicKey } from '@oyster/common';
import { ArtContent } from './../ArtContent';
import { useArt } from '../../hooks';
import { Artist, ArtType } from '../../types';
import { MetaAvatar } from '../MetaAvatar';
import { useRemoteStorage } from '../../contexts';

const { Meta } = Card;

export interface ArtCardProps extends CardProps {
  pubkey?: StringPublicKey;

  image?: string;
  animationURL?: string;

  category?: MetadataCategory;

  name?: string;
  symbol?: string;
  description?: string;
  creators?: Artist[];
  preview?: boolean;
  small?: boolean;
  close?: () => void;

  height?: number;
  width?: number;
}

export const ArtCard = (props: ArtCardProps) => {
  let {
    className,
    small,
    category,
    image,
    animationURL,
    name,
    preview,
    creators,
    description,
    close,
    pubkey,
    height,
    width,
    ...rest
  } = props;
  const art = useArt(pubkey);
  creators = art?.creators || creators || [];
  const [loadedCreators, setLoadedCreators] = useState<any[]>(creators);
  const { isReady: isRemoteStorageReady, remoteStorage } = useRemoteStorage();

  useMemo(async () => {
    if (isRemoteStorageReady && creators && creators.length > 0) {
      const loadedCreators = await Promise.all(
        creators.map(({ address }) => {
          if (address) {
            return remoteStorage.getCreator(address);
          }

          return {};
        }),
      );
      setLoadedCreators(loadedCreators);
      console.log(
        `Loaded creators for community ${pubkey} with creators ${JSON.stringify(
          creators,
        )} ${JSON.stringify(loadedCreators)}`,
      );
    }
  }, [isRemoteStorageReady, art?.creators]);

  name = art?.title || name || ' ';

  let badge = '';
  if (art.type === ArtType.NFT) {
    badge = 'Unique';
  } else if (art.type === ArtType.Master) {
    badge = 'Master Key';
  } else if (art.type === ArtType.Print) {
    badge = `${art.edition} of ${art.supply}`;
  }

  const card = (
    <Card
      hoverable={true}
      className={`art-card ${small ? 'small' : ''} ${className ?? ''}`}
      cover={
        <>
          {close && (
            <Button
              className="card-close-button"
              shape="circle"
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                close && close();
              }}
            >
              X
            </Button>
          )}
          <ArtContent
            pubkey={pubkey}
            uri={image}
            animationURL={animationURL}
            category={category}
            preview={preview}
            height={height}
            width={width}
          />
        </>
      }
      {...rest}
    >
      <Meta
        title={`${name}`}
        description={
          <>
            <MetaAvatar creators={loadedCreators} size={32} />
            {/* {art.type === ArtType.Master && (
              <>
                <br />
                {!endAuctionAt && (
                  <span style={{ padding: '24px' }}>
                    {(art.maxSupply || 0) - (art.supply || 0)}/
                    {art.maxSupply || 0} prints remaining
                  </span>
                )}
              </>
            )} */}
            <div className="edition-badge">{badge}</div>
          </>
        }
      />
    </Card>
  );

  return art.creators?.find(c => !c.verified) ? (
    <Badge.Ribbon text="Unverified">{card}</Badge.Ribbon>
  ) : (
    card
  );
};
