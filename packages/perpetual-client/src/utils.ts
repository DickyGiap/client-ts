import type { Address, Hash } from 'viem';

export const buildAccountId = (
  address: Address,
  brokerId: number,
  subaccountIndex: number,
): Hash => {
  return `${address}${`${brokerId}`.padStart(8, '0')}000000000001${`${subaccountIndex}`.padStart(4, '0')}`;
};
