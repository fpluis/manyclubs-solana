import { BinaryReader, deserializeUnchecked } from 'borsh';
import base58 from 'bs58';
import BN from 'bn.js';

const extendBorsh = () => {
  BinaryReader.prototype.readPubkey = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    return bs58.decode(array);
  };

  BinaryReader.prototype.readPubkeyAsString = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    return base58.encode(array);
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
  masterEdition;
  edition;
  editionNonce;
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

export const parseTokenMetadata = response => {
  console.log(`Raw token metadata: ${JSON.stringify(response)}`);
  const {
    result: {
      value: {
        data: [bytes, encoding],
        owner,
      },
    },
  } = response;
  const account = {
    data: Buffer.from(bytes, encoding),
    owner,
  };
  console.log(`Parsing metadata from account ${JSON.stringify(account)}`);
  if (!isMetadataAccount(account)) {
    return {};
  }

  try {
    if (isMetadataV1Account(account)) {
      return {
        info: decodeMetadata(account.data),
        type: 'metadata',
      };
    }

    if (isEditionV1Account(account)) {
      return {
        info: decodeEdition(account.data),
        type: 'edition',
      };
    }

    if (isMasterEditionAccount(account)) {
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

class SubscriptionData {
  tokenMint;
  ownerAddresses;
  ownerShares;
  withdrawnAmounts;
  totalPaid;
  price;
  periodDuration;
  paidUntil;

  constructor(args) {
    this.tokenMint = args.tokenMint;
    this.ownerAddresses = args.ownerAddresses;
    this.ownerShares = args.ownerShares;
    this.withdrawnAmounts = args.withdrawnAmounts;
    this.totalPaid = args.totalPaid;
    this.price = args.price;
    this.periodDuration = args.periodDuration;
    this.paidUntil = args.paidUntil;
  }
}

const SUBSCRIPTION_SCHEMA = new Map([
  [
    SubscriptionData,
    {
      kind: 'struct',
      fields: [
        ['tokenMint', 'pubkeyAsString'],
        ['ownerAddresses', ['pubkeyAsString']],
        ['ownerShares', ['u8']],
        ['withdrawnAmounts', ['u64']],
        ['totalPaid', 'u64'],
        ['price', 'u64'],
        ['periodDuration', 'u64'],
        ['paidUntil', 'u64'],
      ],
    },
  ],
]);

export const parseSubscription = ({
  result: {
    value: {
      data: [bytes, encoding],
    },
  },
}) => {
  const data = Buffer.from(bytes, encoding);
  const subscription = deserializeUnchecked(
    SUBSCRIPTION_SCHEMA,
    SubscriptionData,
    data,
  );
  subscription.withdrawnAmounts = subscription.withdrawnAmounts.map(
    numberBuffer => {
      const asNumber = new BN(numberBuffer).toNumber();
      console.log(`Buffer ${numberBuffer} as number: ${asNumber}`);
      return asNumber;
    },
  );
  subscription.totalPaid = new BN(subscription.totalPaid).toNumber();
  subscription.price = new BN(subscription.price).toNumber();
  subscription.periodDuration = new BN(subscription.periodDuration).toNumber();
  subscription.paidUntil = new BN(subscription.paidUntil).toNumber();
  return subscription;
};
