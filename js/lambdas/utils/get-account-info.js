import fetch from 'node-fetch';

export default address =>
  fetch('https://api.devnet.solana.com', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [address, { encoding: 'jsonParsed' }],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .catch(error => {
      console.log(`Error getting token accounts by owner:`);
      console.log(error);
    });
