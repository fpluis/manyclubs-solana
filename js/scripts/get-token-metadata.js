import fetch from 'node-fetch';
import { BinaryReader, deserializeUnchecked } from 'borsh';
import base58 from 'bs58';
import getAccountInfo from '../lambdas/utils/get-account-info.js';

const NO_SUBSCRIPTION =
  '8nvzrQjr6VmbNrif3uow2vtcdFDCxcabXQveCvpUV7m';

const [, , address] = process.argv;

const extendBorsh = () => {
  BinaryReader.prototype.readPubkey = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    return base58.decode(array);
  };

  BinaryReader.prototype.readPubkeyAsString = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    return array.slice(1).every((value) => value === 0) ? null : base58.encode(array);
  };
};

extendBorsh();

const MetadataKey = {
  EditionV1: 1,
  MasterEditionV1: 2,
  MetadataV1: 4,
  MasterEditionV2: 6,
};

const METADATA_PROGRAM_ID = 'EYv8MSZb7aTmN5VByWPvGtLVGr4Hqm9bjAvTrSF4iscb';

class MasterEditionV1 {
  key;
  supply;
  maxSupply;
  printingMint;
  oneTimePrintingAuthorizationMint;

  constructor(args) {
    this.key = MetadataKey.MasterEditionV1;
    this.supply = args.supply;
    this.maxSupply = args.maxSupply;
    this.printingMint = args.printingMint;
    this.oneTimePrintingAuthorizationMint =
      args.oneTimePrintingAuthorizationMint;
  }
}

class MasterEditionV2 {
  key;
  supply;
  maxSupply;

  constructor(args) {
    this.key = MetadataKey.MasterEditionV2;
    this.supply = args.supply;
    this.maxSupply = args.maxSupply;
  }
}

class Edition {
  key;
  parent;
  edition;

  constructor(args) {
    this.key = MetadataKey.EditionV1;
    this.parent = args.parent;
    this.edition = args.edition;
  }
}

class Metadata {
  key;
  updateAuthority;
  mint;
  data;
  primarySaleHappened;
  isMutable;
  editionNonce;
  masterEdition;
  edition;
  subscription;

  constructor(args) {
    this.key = MetadataKey.MetadataV1;
    this.updateAuthority = args.updateAuthority;
    this.mint = args.mint;
    this.data = args.data;
    this.primarySaleHappened = args.primarySaleHappened;
    this.isMutable = args.isMutable;
    this.editionNonce = args.editionNonce;
    this.subscription = args.subscription;
  }
}

class Creator {
  address;
  verified;
  share;

  constructor(args) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
  }
}

class Data {
  name;
  symbol;
  uri;
  sellerFeeBasisPoints;
  creators;

  constructor(args) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
  }
}

const METADATA_SCHEMA = new Map([
  [
    Creator,
    {
      kind: 'struct',
      fields: [
        ['address', 'pubkeyAsString'],
        ['verified', 'u8'],
        ['share', 'u8'],
      ],
    },
  ],
  [
    Data,
    {
      kind: 'struct',
      fields: [
        ['name', 'string'],
        ['symbol', 'string'],
        ['uri', 'string'],
        ['sellerFeeBasisPoints', 'u16'],
        ['creators', { kind: 'option', type: [Creator] }],
      ],
    },
  ],
  [
    MasterEditionV1,
    {
      kind: 'struct',
      fields: [
        ['key', 'u8'],
        ['supply', 'u64'],
        ['maxSupply', { kind: 'option', type: 'u64' }],
        ['printingMint', 'pubkeyAsString'],
        ['oneTimePrintingAuthorizationMint', 'pubkeyAsString'],
      ],
    },
  ],
  [
    MasterEditionV2,
    {
      kind: 'struct',
      fields: [
        ['key', 'u8'],
        ['supply', 'u64'],
        ['maxSupply', { kind: 'option', type: 'u64' }],
      ],
    },
  ],
  [
    Edition,
    {
      kind: 'struct',
      fields: [
        ['key', 'u8'],
        ['parent', 'pubkeyAsString'],
        ['edition', 'u64'],
      ],
    },
  ],
  [
    Metadata,
    {
      kind: 'struct',
      fields: [
        ['key', 'u8'],
        ['updateAuthority', 'pubkeyAsString'],
        ['mint', 'pubkeyAsString'],
        ['data', Data],
        ['primarySaleHappened', 'u8'],
        ['isMutable', 'u8'],
        ['editionNonce', { kind: 'option', type: 'u8' }],
        ['subscription', { kind: 'option', type: 'pubkeyAsString' }],
      ],
    },
  ],
]);

const decodeEdition = buffer =>
  deserializeUnchecked(METADATA_SCHEMA, Edition, buffer);

const decodeMasterEdition = buffer => {
  if (buffer[0] == MetadataKey.MasterEditionV1) {
    return deserializeUnchecked(METADATA_SCHEMA, MasterEditionV1, buffer);
  } else {
    return deserializeUnchecked(METADATA_SCHEMA, MasterEditionV2, buffer);
  }
};

const METADATA_REPLACE = new RegExp('\u0000', 'g');

const decodeMetadata = buffer => {
  const metadata = deserializeUnchecked(METADATA_SCHEMA, Metadata, buffer);
  metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
  metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
  metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
  console.log(`Metadata subscription: ${metadata.subscription}`);
  metadata.subscription =
    metadata.subscription === NO_SUBSCRIPTION
      ? null
      : metadata.subscription;
  return metadata;
};

const isMetadataAccount = account => {
  return account.owner === METADATA_PROGRAM_ID;
};

const isMetadataV1Account = account =>
  account.data[0] === MetadataKey.MetadataV1;

const isEditionV1Account = account => account.data[0] === MetadataKey.EditionV1;

const isMasterEditionAccount = account =>
  account.data[0] === MetadataKey.MasterEditionV1 ||
  account.data[0] === MetadataKey.MasterEditionV2;

const parseMetadata = ({
  result: {
    value: {
      data: [bytes, encoding],
      owner,
    },
  },
}) => {
  const account = {
    data: Buffer.from(bytes, encoding),
    owner,
  };
  console.log(`Parsing metadata from account ${JSON.stringify(account)}`);
  if (!isMetadataAccount(account)) {
    console.log(`Input is not a metadata account`);
    return {};
  }

  try {
    if (isMetadataV1Account(account)) {
      console.log(`Input is a metadata v1 account`);
      return {
        info: decodeMetadata(account.data),
        type: 'metadata',
      };
    }

    if (isEditionV1Account(account)) {
      console.log(`Input is an edition v1 account`);
      return {
        info: decodeEdition(account.data),
        type: 'edition',
      };
    }

    if (isMasterEditionAccount(account)) {
      console.log(`Input is a master edition account`);
      return {
        info: decodeMasterEdition(account.data),
        type: 'master',
      };
    }
  } catch (error) {
    console.log(`Error during deserialization:`);
    console.log(error);
  }
};

const getTokenMetadata = metadataAddress =>
  fetch('https://api.devnet.solana.com', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [metadataAddress, { encoding: 'jsonParsed' }],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(response => {
      console.log(`Response from solana: ${JSON.stringify(response)}`);
      return parseMetadata(response);
    })
    .catch(error => {
      console.log(`Error getting token accounts by owner:`);
      console.log(error);
    });

async function run () {
  const metadata = await getTokenMetadata(address).catch(error => {
    console.log(error);
  });
  console.log(`Parsed metadata: ${JSON.stringify(metadata)}`);
  const { info: { mint } } = metadata;
  const mintInfo = await getAccountInfo(mint).catch((error) => {
    console.log(error);
  });
  console.log(`Mint info: ${JSON.stringify(mintInfo)}`);
  const { result: { value: { data: { parsed: { info: { mintAuthority } } } } } } = mintInfo;
  console.log(`Mint authority: ${mintAuthority}`);
  const mintMetadata = await getTokenMetadata(mintAuthority).catch(error => {
    console.log(error);
  });
  console.log(`Parsed mint metadata: ${JSON.stringify(mintMetadata)}`);
  if (mintMetadata.type === "master") {
    console.log(`Done; master = ${mintAuthority}`);
  } else if (mintMetadata.type === "edition") {
    console.log(`Done; master = ${mintMetadata.info.parent}`)
  }
  
  // const { result: { value: { data: { parsed: { info: { mintAuthority: parentMintAuthority } } } } } } = mintInfo;
  // console.log(`Parent mint authority: ${parentMintAuthority}`);
  // const parentMintMetadata = await getTokenMetadata(address).catch(error => {
  //   console.log(error);
  // });
  // console.log(`Parsed parent mint metadata: ${JSON.stringify(parentMintMetadata)}`);
};

run();
