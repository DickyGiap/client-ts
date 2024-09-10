# Foundation Network Perpetual Client

Perpetual trading javascript client for [Foundation Network](https://foundation.network)

## Install

This library depends on [viem](https://viem.sh)

```sh
npm install viem @foundation-network/perpetual-client
```

## Usage

```typescipt
import { TESTNET_RPC_URL, FoundationPerpClient } from '@foundation-network/perpetual-client';
import { privateKeyToAccount } from 'viem/accounts';

const signer = privateKeyToAccount(process.env.PRIVATE_KEY);

const client = new FoundationPerpClient(signer, {
    rpcUrl: TESTNET_RPC_URL,
});

await client.placeLimit('CRYPTO_BTC_PERP', 'ask', '61000', '1');
```