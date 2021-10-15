import { parseTokenMetadata, parseSubscription } from './parse-metadata';
import fetch from 'node-fetch';
import getAccountInfo from './get-account-info';

const getTokenAccountsByOwner = ownerAccount =>
  fetch('https://api.devnet.solana.com', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        ownerAccount,
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        },
        {
          encoding: 'jsonParsed',
        },
      ],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(response => {
      console.log(`Response from solana: ${JSON.stringify(response)}`);
      return response;
    })
    .catch(error => {
      console.log(`Error getting token accounts by owner:`);
      console.log(error);
    });

const extractMintIds = accounts =>
  accounts.result.value.reduce(
    (
      ids,
      {
        account: {
          data: {
            parsed: {
              info: {
                mint,
                tokenAmount: { amount },
              },
            },
          },
        },
      },
    ) => {
      if (amount > 0) {
        return [...ids, mint];
      }

      return ids;
    },
    [],
  );

const getTokenMetadata = address =>
  getAccountInfo(address)
    .then(response => parseTokenMetadata(response))
    .catch(error => {
      console.log(error);
    });

const getMasterMint = async (mint) => {
  const mintInfo = await getAccountInfo(mint).catch(error => {
    console.log(error);
  });
  console.log(`Mint info: ${JSON.stringify(mintInfo)}`);
  const {
    result: {
      value: {
        data: {
          parsed: {
            info: { mintAuthority },
          },
        },
      },
    },
  } = mintInfo;
  console.log(`Mint authority: ${mintAuthority}`);
  const mintMetadata = await getTokenMetadata(mintAuthority);
  console.log(`Parsed mint metadata: ${JSON.stringify(mintMetadata)}`);
  if (mintMetadata.type === 'master') {
    console.log(`Done; master = ${mintAuthority}`);
    return mintAuthority;
  } else if (mintMetadata.type === 'edition') {
    return mintMetadata.info.parent
  }
};

export default (requestedKey, userAddress) =>
  new Promise(async resolve => {
    const accounts = await getTokenAccountsByOwner(userAddress);
    console.log(`Accounts returned: ${JSON.stringify(accounts)}`);
    const mintIds = extractMintIds(accounts);
    const tokenMetadata = await getAccountInfo(requestedKey)
      .then(response => parseTokenMetadata(response))
      .catch(error => {
        console.log(`Error parsing metadata:`, error);
      });
    console.log(
      `Mint ids: ${JSON.stringify(mintIds)}; Token metadata: ${JSON.stringify(
        tokenMetadata,
      )}`,
    );
    const {
      info: {
        updateAuthority,
        mint,
        data: { name },
        subscription,
      },
    } = tokenMetadata;
    const masterMint = await getMasterMint(mint);
    const userMasterMints = await Promise.all(mintIds.map((mint) => getMasterMint(mint)))
    console.log(`Mint: ${mint}; master mint: ${masterMint}; master mints ${JSON.stringify(userMasterMints)}`);
    const validationResponse = {
      mint: masterMint,
      isOwner: mintIds.includes(mint) || userMasterMints.includes(masterMint),
      updateAuthority,
      path: encodeURIComponent(name.toLowerCase()),
    };
    if (subscription == null) {
      resolve({ ...validationResponse, hasSubscriberAccess: true });
      return;
    }

    console.log(`Subscription: ${subscription}`);
    const subscriptionData = await getAccountInfo(subscription).then(
      response => {
        console.log(
          `Get subscription data response: ${JSON.stringify(response)}`,
        );
        return parseSubscription(response);
      },
    );
    console.log(`Subscription paid until "${subscriptionData.paidUntil}"; current time "${new Date().getTime() / 1000}"`)
    console.log(`Subscription data: ${JSON.stringify(subscriptionData)}`);
    resolve({
      ...validationResponse,
      hasSubscriberAccess: subscriptionData.paidUntil > new Date().getTime() / 1000,
    });
  });
