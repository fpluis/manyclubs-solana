import {
  programIds,
  findProgramAddress,
  toPublicKey,
  StringPublicKey,
  createAssociatedTokenAccountInstruction,
  findOrCreateAccountByMint,
} from '@oyster/common';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
import { deserializeUnchecked, serialize } from 'borsh';
import BN from 'bn.js';

import { Keypair, Connection } from '@solana/web3.js';
import {
  sendTransactionWithRetry,
  cache,
  ensureWrappedAccount,
  toLamports,
  ParsedAccount,
  WalletSigner,
} from '@oyster/common';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { approve } from '@oyster/common/dist/lib/models/account';
import { TokenAccount } from '@oyster/common/dist/lib/models/account';
import { AccountLayout, MintInfo } from '@solana/spl-token';
import { QUOTE_MINT } from '../constants';

export const SUBSCRIPTION_PREFIX = 'sub';

// 86,400
const SECONDS_IN_A_DAY = 60 * 60 * 24;

// 604,800
const SECONDS_IN_A_WEEK = 7 * SECONDS_IN_A_DAY;

// Using 30-day months for simplicity = 2,592,000
const SECONDS_IN_A_MONTH = 30 * SECONDS_IN_A_DAY;

class SubscriptionData {
  tokenMint: StringPublicKey;
  ownerAddresses: StringPublicKey[];
  ownerShares: number[];
  withdrawnAmounts: number[];
  totalPaid: BN;
  price: BN;
  periodDuration: BN;
  paidUntil: BN;

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

export class CreateSubscriptionArgs {
  instruction: number = 0;
  ownerAddresses: StringPublicKey[];
  ownerShares: number[];
  tokenMint: StringPublicKey;
  resource: StringPublicKey;
  price: BN;
  periodDuration: BN;

  constructor(args: {
    ownerAddresses: StringPublicKey[];
    ownerShares: number[];
    tokenMint: StringPublicKey;
    resource: StringPublicKey;
    price: BN;
    periodDuration: BN;
  }) {
    this.ownerAddresses = args.ownerAddresses;
    this.ownerShares = args.ownerShares;
    this.tokenMint = args.tokenMint;
    this.resource = args.resource;
    this.price = args.price;
    this.periodDuration = args.periodDuration;
  }
}

export class WithdrawFundsArgs {
  instruction: number = 1;
  resource: StringPublicKey;
  amount: number;

  constructor(args: { resource: StringPublicKey; amount: number }) {
    this.resource = args.resource;
    this.amount = args.amount;
  }
}

export class PaySubscriptionArgs {
  instruction: number = 2;
  resource: StringPublicKey;

  constructor(args: { resource: StringPublicKey }) {
    this.resource = args.resource;
  }
}

export const SUBSCRIPTION_SCHEMA = new Map<any, any>([
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

  [
    CreateSubscriptionArgs,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['ownerAddresses', ['pubkeyAsString']],
        ['ownerShares', ['u8']],
        ['tokenMint', 'pubkeyAsString'],
        ['resource', 'pubkeyAsString'],
        ['price', 'u64'],
        ['periodDuration', 'u64'],
      ],
    },
  ],
  [
    WithdrawFundsArgs,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['resource', 'pubkeyAsString'],
        ['amount', 'u64'],
      ],
    },
  ],
  [
    PaySubscriptionArgs,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['resource', 'pubkeyAsString'],
      ],
    },
  ],
]);

export const deserializeSubscription = buffer => {
  const subscription = deserializeUnchecked(
    SUBSCRIPTION_SCHEMA,
    SubscriptionData,
    buffer,
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

export const createSubscriptionInstructions = async (
  instructions,
  { period_type, period_amount, price },
  resource,
  creators,
  payer,
) => {
  console.log(
    `Create a subscription with args ${JSON.stringify({
      period_type,
      period_amount,
      price,
    })}`,
  );
  const durationSeconds =
    period_type === 'months'
      ? period_amount * SECONDS_IN_A_MONTH
      : period_type === 'weeks'
      ? period_amount * SECONDS_IN_A_WEEK
      : period_amount * SECONDS_IN_A_DAY;
  const subscriptionKey = (
    await findProgramAddress(
      [
        Buffer.from(SUBSCRIPTION_PREFIX),
        programIds().subscription.toBuffer(),
        toPublicKey(resource).toBuffer(),
      ],
      programIds().subscription,
    )
  )[0];
  const ownerAddresses = creators.map(({ address }) => address);
  const ownerShares = creators.map(({ share }) => share);

  const data = Buffer.from(
    serialize(
      SUBSCRIPTION_SCHEMA,
      new CreateSubscriptionArgs({
        ownerAddresses,
        ownerShares,
        tokenMint: QUOTE_MINT.toBase58(),
        resource,
        price: new BN(price),
        periodDuration: new BN(durationSeconds),
      }),
    ),
  );
  console.log(`Subscription key: ${JSON.stringify(subscriptionKey)}`);

  const keys = [
    {
      pubkey: toPublicKey(payer),
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(subscriptionKey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: toPublicKey(programIds().subscription),
      data,
    }),
  );

  return subscriptionKey;
};

const findAssociatedTokenAddress = async (
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey,
): Promise<PublicKey> => {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        programIds().token.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      programIds().associatedToken,
    )
  )[0];
};

const addPaySubscriptionInstructions = async (
  payer: StringPublicKey,
  payerTokenKey: StringPublicKey,
  subscriptionTokenPubkey: StringPublicKey,
  subscriptionPubkey: StringPublicKey,
  tokenMintPubkey: StringPublicKey,
  transferAuthority: StringPublicKey,
  resource: StringPublicKey,
  instructions: TransactionInstruction[],
) => {
  const subscriptionProgramId = programIds().subscription;

  console.log(
    `Subscription seeds: ${JSON.stringify([
      Buffer.from(SUBSCRIPTION_PREFIX),
      programIds().subscription.toBuffer(),
      toPublicKey(resource).toBuffer(),
    ])}`,
  );
  const data = Buffer.from(
    serialize(
      SUBSCRIPTION_SCHEMA,
      new PaySubscriptionArgs({
        resource,
      }),
    ),
  );

  const keys = [
    {
      pubkey: toPublicKey(payer),
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: toPublicKey(payerTokenKey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(subscriptionTokenPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(subscriptionPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(tokenMintPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(transferAuthority),
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: programIds().token,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: toPublicKey(subscriptionProgramId),
      data: data,
    }),
  );

  return;
};

async function setupPaySubscription(
  connection: Connection,
  wallet: WalletSigner,
  subscriberAccount: string | undefined,
  subscriptionAddress: string,
  price: number,
  resource: string,
  overallInstructions: TransactionInstruction[][],
  overallSigners: Keypair[][],
): Promise<void> {
  if (!wallet.publicKey) throw new WalletNotConnectedError();

  let signers: Keypair[] = [];
  let instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span,
  );

  const tokenAccount = subscriberAccount
    ? (cache.get(subscriberAccount) as TokenAccount)
    : undefined;
  const mint = cache.get(
    tokenAccount ? tokenAccount.info.mint : QUOTE_MINT,
  ) as ParsedAccount<MintInfo>;
  const lamports = toLamports(price, mint.info) + accountRentExempt;
  console.log(`Set up pay sub; amount: ${price}; lamports: ${lamports}`);

  const subscriptionPublicKey = new PublicKey(subscriptionAddress);
  const subscriptionAta = await findAssociatedTokenAddress(
    subscriptionPublicKey,
    QUOTE_MINT,
  );
  const existingAta = await connection.getAccountInfo(
    toPublicKey(subscriptionAta),
  );
  console.log(
    `Associated token address to ${subscriptionAddress}: ${subscriptionAta}; Existing ata: ${JSON.stringify(
      existingAta,
    )}`,
  );
  if (!existingAta) {
    createAssociatedTokenAccountInstruction(
      instructions,
      toPublicKey(subscriptionAta),
      wallet.publicKey,
      subscriptionPublicKey,
      QUOTE_MINT,
    );
  }

  const payingSolAccount = ensureWrappedAccount(
    instructions,
    cleanupInstructions,
    tokenAccount,
    wallet.publicKey,
    lamports + accountRentExempt * 2,
    signers,
  );

  console.log(
    `About to approve transfer authority; paying sol account: ${payingSolAccount}; key: ${toPublicKey(
      payingSolAccount,
    ).toBase58()}; wallet: ${wallet.publicKey}`,
  );
  const transferAuthority = approve(
    instructions,
    cleanupInstructions,
    toPublicKey(payingSolAccount),
    wallet.publicKey,
    lamports - accountRentExempt,
  );

  signers.push(transferAuthority);

  await addPaySubscriptionInstructions(
    wallet.publicKey.toBase58(),
    toPublicKey(payingSolAccount).toBase58(),
    subscriptionAta.toBase58(),
    subscriptionPublicKey.toBase58(),
    QUOTE_MINT.toBase58(),
    transferAuthority.publicKey.toBase58(),
    resource,
    instructions,
  );

  overallInstructions.push([...instructions, ...cleanupInstructions]);
  overallSigners.push(signers);
  return;
}

export async function paySubscription(
  connection: Connection,
  wallet: WalletSigner,
  subscriberTokenAccount: string | undefined,
  subscriptionAddress: string,
  price: number,
  resource: string,
) {
  const signers: Keypair[][] = [];
  const instructions: TransactionInstruction[][] = [];
  await setupPaySubscription(
    connection,
    wallet,
    subscriberTokenAccount,
    subscriptionAddress,
    price,
    resource,
    instructions,
    signers,
  );

  await sendTransactionWithRetry(
    connection,
    wallet,
    instructions[0],
    signers[0],
    'single',
  );

  return price;
}

const addWithdrawFundsInstructions = async (
  payer: StringPublicKey,
  withdrawerPublicKey: StringPublicKey,
  withdrawerToken: StringPublicKey,
  subscriptionTokenPubkey: StringPublicKey,
  subscriptionPubkey: StringPublicKey,
  tokenMintPubkey: StringPublicKey,
  resource: StringPublicKey,
  amount: number,
  instructions: TransactionInstruction[],
) => {
  const data = Buffer.from(
    serialize(
      SUBSCRIPTION_SCHEMA,
      new WithdrawFundsArgs({
        resource,
        amount,
      }),
    ),
  );

  const keys = [
    {
      pubkey: toPublicKey(payer),
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: toPublicKey(withdrawerPublicKey),
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: toPublicKey(withdrawerToken),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(subscriptionTokenPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(subscriptionPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: toPublicKey(tokenMintPubkey),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: programIds().token,
      isSigner: false,
      isWritable: false,
    },
  ];
  instructions.push(
    new TransactionInstruction({
      keys,
      programId: toPublicKey(programIds().subscription),
      data: data,
    }),
  );

  return;
};

async function setUpWithdrawFunds(
  connection: Connection,
  wallet: WalletSigner,
  withdrawerPublicKey: string,
  subscriptionAddress: string,
  lamports: number,
  resource: string,
  overallInstructions: TransactionInstruction[][],
  overallSigners: Keypair[][],
) {
  if (!wallet.publicKey) throw new WalletNotConnectedError();

  let signers: Keypair[] = [];
  let instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];

  const subscriptionPublicKey = new PublicKey(subscriptionAddress);
  const subscriptionAta = await findAssociatedTokenAddress(
    subscriptionPublicKey,
    QUOTE_MINT,
  );
  const existingAta = await connection.getAccountInfo(
    toPublicKey(subscriptionAta),
  );
  console.log(
    `Associated token address to ${subscriptionAddress}: ${subscriptionAta}; Existing ata: ${JSON.stringify(
      existingAta,
    )}`,
  );
  

  // Missing a call to getTokenAccountsByOwner if the account is not cached
  // const withdrawerTokenAddress = cache.get(withdrawerAccount) as TokenAccount;
  // console.log(
  //   `Withdrawer token account associated to address ${withdrawerAccount}: ${withdrawerTokenAddress.pubkey}`,
  // );
  // const tokenAccounts = await connection.getTokenAccountsByOwner(
  //   new PublicKey(withdrawerAccount),
  //   {
  //     programId: programIds().token,
  //   },
  // );
  // console.log(`Token accounts associated to ${withdrawerAccount}: ${JSON.stringify(tokenAccounts)}`);
  // const [withdrawerTokenAccount] = tokenAccounts.value;
  // const withdrawerAta = await findAssociatedTokenAddress(
  //   new PublicKey(withdrawerPublicKey),
  //   QUOTE_MINT,
  // );
  // const existingWithdrawerAta = await connection.getAccountInfo(
  //   toPublicKey(withdrawerAta),
  // );
  // console.log(
  //   `Associated token address to ${withdrawerPublicKey}: ${JSON.stringify(
  //     withdrawerAta,
  //   )}; Existing ata: ${JSON.stringify(existingWithdrawerAta)}`,
  // );
  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span,
  );
  const withdrawerTokenAccount = findOrCreateAccountByMint(
    wallet.publicKey,
    wallet.publicKey,
    instructions,
    cleanupInstructions,
    accountRentExempt,
    QUOTE_MINT,
    signers,
  );
  console.log(
    `Withdrawer token account: ${JSON.stringify(withdrawerTokenAccount)}`,
  );

  await addWithdrawFundsInstructions(
    wallet.publicKey.toBase58(),
    withdrawerPublicKey,
    withdrawerTokenAccount.toBase58(),
    subscriptionAta.toBase58(),
    subscriptionPublicKey.toBase58(),
    QUOTE_MINT.toBase58(),
    resource,
    lamports,
    instructions,
  );

  overallInstructions.push([...instructions, ...cleanupInstructions]);
  overallSigners.push(signers);
  return;
}

export async function withdrawFunds(
  connection: Connection,
  wallet: WalletSigner,
  withdrawerPublicKey: string,
  subscriptionAddress: string,
  lamports: number,
  resource: string,
) {
  const signers: Keypair[][] = [];
  const instructions: TransactionInstruction[][] = [];
  await setUpWithdrawFunds(
    connection,
    wallet,
    withdrawerPublicKey,
    subscriptionAddress,
    lamports,
    resource,
    instructions,
    signers,
  );

  await sendTransactionWithRetry(
    connection,
    wallet,
    instructions[0],
    signers[0],
    'single',
  );

  return lamports;
}
