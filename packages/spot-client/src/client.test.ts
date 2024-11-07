import { test } from 'vitest';
import { FoundationSpotClient } from './index';
import { privateKeyToAccount } from 'viem/accounts';
import assert from "node:assert";

test('should place orders', async () => {
  const signer = privateKeyToAccount(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  );

  const client = new FoundationSpotClient(signer, {
    rpcUrl: 'http://localhost:8096',
    apiUrl: ''
  });

  const markets = await client.getOpenMarkets()
  assert.notEqual(markets.length, 0)
  const order_id = await client.placeLimit(markets[0].id, 'bid', '23.164', '10')
  console.log({order_id})
});
