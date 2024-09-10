import { test } from 'vitest';
import { FoundationSpotClient } from './index';
import { privateKeyToAccount } from 'viem/accounts';

test('should get orders', async () => {
  const signer = privateKeyToAccount(
    '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  );

  const client = new FoundationSpotClient(signer, {
    rpcUrl: 'http://localhost:8096',
    apiUrl: ''
  });

});
