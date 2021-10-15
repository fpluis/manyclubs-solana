import fetch from 'node-fetch';
import { BinaryReader, deserializeUnchecked } from 'borsh';
import base58 from 'bs58';
import BN from 'bn.js';

const [, , address] = process.argv;

const extendBorsh = () => {
  BinaryReader.prototype.readPubkey = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    console.log(
      `Array: ${JSON.stringify(array)}; decoded: ${JSON.stringify(
        bs58.decode(array),
      )}`,
    );
    return bs58.decode(array);
  };

  BinaryReader.prototype.readPubkeyAsString = function () {
    const reader = this;
    const array = reader.readFixedArray(32);
    return base58.encode(array);
  };
};

extendBorsh();

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

const parseSubscription = ({
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
  const subscription = deserializeUnchecked(SUBSCRIPTION_SCHEMA, SubscriptionData, account.data);
  subscription.withdrawnAmounts = subscription.withdrawnAmounts.map((numberBuffer) => {
    const asNumber = new BN(numberBuffer).toNumber();
    console.log(`Buffer ${numberBuffer} as number: ${asNumber}`);
    return asNumber;
  });
  subscription.totalPaid = new BN(subscription.totalPaid).toNumber();
  subscription.price = new BN(subscription.price).toNumber();
  subscription.periodDuration = new BN(subscription.periodDuration).toNumber();
  subscription.paidUntil = new BN(subscription.paidUntil).toNumber();
  return subscription;
};

const getSubscriptionAccountData = metadataAddress =>
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
      return parseSubscription(response);
    })
    .catch(error => {
      console.log(`Error getting token accounts by owner:`);
      console.log(error);
    });

getSubscriptionAccountData(address)
  .then(parsed => {
    console.log(`Parsed metadata: ${JSON.stringify(parsed)}`);
  })
  .catch(error => {
    console.log(error);
  });
