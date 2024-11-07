# Foundation Network Spot Client

Spot trading javascript client for [Foundation Network](https://foundation.network)

## Install

This library depends on [viem](https://viem.sh)

```sh
npm install viem @foundation-network/spot-client
```

## Usage

```typescipt
import { TESTNET_RPC_URL, TESTNET_API_URL, FoundationPerpClient } from '@foundation-network/spot-client';
import { privateKeyToAccount } from 'viem/accounts';

const signer = privateKeyToAccount(process.env.PRIVATE_KEY);

const client = new FoundationSpotClient(signer, {
    rpcUrl: TESTNET_RPC_URL,
    apiUrl: TESTNET_API_URL,
});

const marketId = 1;
const price = '61000';
const amount = '1';

await client.placeLimit(marketId, 'ask', price, amount);
```
