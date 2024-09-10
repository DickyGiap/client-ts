import { test } from 'vitest';
import { FoundationPerpClient } from './index';
import { privateKeyToAccount } from 'viem/accounts';

test('should get orders', async () => {
  const signer = privateKeyToAccount(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  );

  
  const client = new FoundationPerpClient(signer, {
    rpcUrl: 'http://localhost:8096',
  });
  console.log(client.subaccount)

  const orders = await client.getPendingOrders('CRYPTO_BTC_PERP');
  console.log('orders', orders);
});

test('should get account info', async () => {
  const signer = privateKeyToAccount(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  );

  const client = new FoundationPerpClient(signer, {
    rpcUrl: 'http://localhost:8096',
  });

  const info = await client.getAccountInfo();
  console.log('info', info);
});

test('should query depth', async () => {
  const signer = privateKeyToAccount(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  );

  const client = new FoundationPerpClient(signer, {
    rpcUrl: 'http://localhost:8096',
  });

  const depth = await client.getOrderbookDepth('CRYPTO_BTC_PERP', 100);
  console.log('depth', depth);
});
