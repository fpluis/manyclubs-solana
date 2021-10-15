import { useEffect, useMemo, useState } from 'react';
import { useMeta, useRemoteStorage } from '../contexts';
import { Art, Artist, ArtType } from '../types';
import {
  Edition,
  IMetadataExtension,
  MasterEditionV1,
  MasterEditionV2,
  Metadata,
  ParsedAccount,
  StringPublicKey,
  useLocalStorage,
  pubkeyToString,
  useConnection,
  decodeMetadata,
} from '@oyster/common';
import { WhitelistedCreator } from '@oyster/common/dist/lib/models/metaplex/index';
import { Cache } from 'three';
import { useInView } from 'react-intersection-observer';
import { PublicKey } from '@solana/web3.js';

export const metadataToArt = (
  info: Metadata | undefined,
  editions: Record<string, ParsedAccount<Edition>>,
  masterEditions: Record<
    string,
    ParsedAccount<MasterEditionV1 | MasterEditionV2>
  >,
  whitelistedCreatorsByCreator: Record<
    string,
    ParsedAccount<WhitelistedCreator>
  >,
) => {
  let type: ArtType = ArtType.NFT;
  let editionNumber: number | undefined = undefined;
  let maxSupply: number | undefined = undefined;
  let supply: number | undefined = undefined;

  if (info) {
    console.log(`Art info: ${JSON.stringify(info)}`);
    const masterEdition = masterEditions[info.masterEdition || ''];
    const edition = editions[info.edition || ''];
    if (edition) {
      console.log(`Art edition: ${JSON.stringify(edition)}`);
      const myMasterEdition = masterEditions[edition.info.parent || ''];
      if (myMasterEdition) {
        type = ArtType.Print;
        editionNumber = edition.info.edition.toNumber();
        supply = myMasterEdition.info?.supply.toNumber() || 0;
      }
    } else if (masterEdition) {
      console.log(`Master edition: ${JSON.stringify(masterEdition)}`);
      type = ArtType.Master;
      maxSupply = masterEdition.info.maxSupply?.toNumber();
      supply = masterEdition.info.supply.toNumber();
    }
  }

  return {
    uri: info?.data.uri || '',
    mint: info?.mint,
    title: info?.data.name,
    creators: (info?.data.creators || [])
      .map(creator => {
        const knownCreator = whitelistedCreatorsByCreator[creator.address];

        return {
          address: creator.address,
          verified: creator.verified,
          share: creator.share,
          image: knownCreator?.info.image || '',
          name: knownCreator?.info.name || '',
          link: knownCreator?.info.twitter || '',
        } as Artist;
      })
      .sort((a, b) => {
        const share = (b.share || 0) - (a.share || 0);
        if (share === 0 && a.name && b.name) {
          return a.name.localeCompare(b.name);
        }

        return share;
      }),
    seller_fee_basis_points: info?.data.sellerFeeBasisPoints || 0,
    edition: editionNumber,
    maxSupply,
    supply,
    type,
    subscription:
      info && info.subscription
        ? new PublicKey(info?.subscription).toBase58()
        : '',
  } as Art;
};

const cachedImages = new Map<string, string>();
export const useCachedImage = (uri: string, cacheMesh?: boolean) => {
  const [cachedBlob, setCachedBlob] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!uri) {
      return;
    }

    const result = cachedImages.get(uri);
    if (result) {
      setCachedBlob(result);
      return;
    }

    (async () => {
      let response: Response;
      try {
        response = await fetch(uri, { cache: 'force-cache' });
      } catch {
        try {
          response = await fetch(uri, { cache: 'reload' });
        } catch {
          // If external URL, just use the uri
          if (uri?.startsWith('http')) {
            setCachedBlob(uri);
          }
          setIsLoading(false);
          return;
        }
      }

      const blob = await response.blob();
      if (cacheMesh) {
        // extra caching for meshviewer
        Cache.enabled = true;
        Cache.add(uri, await blob.arrayBuffer());
      }
      const blobURI = URL.createObjectURL(blob);
      cachedImages.set(uri, blobURI);
      setCachedBlob(blobURI);
      setIsLoading(false);
    })();
  }, [uri, setCachedBlob, setIsLoading]);

  return { cachedBlob, isLoading };
};

export const useArt = (key?: StringPublicKey) => {
  const { metadata, editions, masterEditions, whitelistedCreatorsByCreator } =
    useMeta();
  const connection = useConnection();
  const [artMeta, setArt] = useState<Art>({
    link: '',
    title: '',
    artist: '',
    uri: '',
  } as Art);

  useMemo(async () => {
    if (!editions || !masterEditions || !key || artMeta.uri.length > 0) {
      return;
    }

    let account;
    const cached = metadata.find(a => a.pubkey === key);
    if (cached != null) {
      account = cached;
      setArt(
        metadataToArt(
          account?.info,
          editions,
          masterEditions,
          whitelistedCreatorsByCreator,
        ),
      );
      return;
    }

    if (key != null) {
      const accountInfo = await connection.getAccountInfo(new PublicKey(key));
      if (accountInfo != null) {
        const decoded = decodeMetadata(accountInfo.data);
        account = { pubkey: key, info: decoded, account: accountInfo };
        return metadataToArt(
          account?.info,
          editions,
          masterEditions,
          whitelistedCreatorsByCreator,
        );
      }
    }

    return {};
  }, [
    key,
    metadata,
    // artMeta,
    // editions,
    // masterEditions,
    // whitelistedCreatorsByCreator,
  ]);

  return artMeta;
};

export const useExtendedArt = (id?: StringPublicKey) => {
  const { metadata } = useMeta();
  const connection = useConnection();
  const [account, setAccount] = useState<any>();

  const [data, setData] = useState<IMetadataExtension>();
  const localStorage = useLocalStorage();

  const key = pubkeyToString(id);

  useMemo(async () => {
    if (account != null) {
      return;
    }

    const cached = metadata.find(a => a.pubkey === key);
    if (cached != null) {
      setAccount(cached);
      return;
    }

    if (key != null && key.length > 0) {
      console.log(`Get account info associated to key ${key}`);
      const accountInfo = await connection
        .getAccountInfo(new PublicKey(key))
        .catch(error => {
          console.log(error);
        });
      if (accountInfo != null) {
        const decoded = decodeMetadata(accountInfo.data);
        setAccount({ pubkey: key, info: decoded, account: accountInfo });
      }
    }
  }, [key, metadata]);

  useEffect(() => {
    console.log(`Effect; id ${id}; data ${JSON.stringify(data)}`);
    if (id && !data) {
      const USE_CDN = false;
      const routeCDN = (uri: string) => {
        let result = uri;
        if (USE_CDN) {
          result = uri.replace(
            'https://arweave.net/',
            'https://coldcdn.com/api/cdn/bronil/',
          );
        }

        return result;
      };

      if (account && account.info.data.uri) {
        const uri = routeCDN(account.info.data.uri);

        const processJson = (extended: any) => {
          if (!extended || extended?.properties?.files?.length === 0) {
            return;
          }

          if (extended?.image) {
            const file = extended.image.startsWith('http')
              ? extended.image
              : `${account.info.data.uri}/${extended.image}`;
            extended.image = routeCDN(file);
          }

          return extended;
        };

        try {
          const cached = localStorage.getItem(uri);
          if (cached) {
            setData(processJson(JSON.parse(cached)));
          } else {
            // TODO: BL handle concurrent calls to avoid double query
            fetch(uri)
              .then(async _ => {
                try {
                  const data = await _.json();
                  try {
                    localStorage.setItem(uri, JSON.stringify(data));
                  } catch {
                    // ignore
                  }
                  setData(processJson(data));
                } catch {
                  return undefined;
                }
              })
              .catch(() => {
                return undefined;
              });
          }
        } catch (ex) {
          console.error(ex);
        }
      }
    }
  }, [id, data, setData, account]);

  return { data };
};
