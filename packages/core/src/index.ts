import type { Address, Hash } from 'viem';

export enum ProductType {
  Unknown = 0,
  Perpetual = 1,
  Spot = 2,
}

export const buildAccountId = (
  address: Address,
  productType: ProductType,
  brokerId: number,
  subaccountIndex: number,
): Hash => {
  return `${address}${`${brokerId}`.padStart(8, '0')}0000${`${productType}`.padStart(8, '0')}${`${subaccountIndex}`.padStart(4, '0')}`;
};

export type Side = 'ask' | 'bid';

const TIME_IN_FORCES = [
  'default',
  'immediate_or_cancel',
  'fill_or_kill',
  'post_only',
] as const;

const SELF_TRADE_BEHAVIORS = [
  // cancel the maker order and continue to fill taker
  'cancel_provide',
  // cancel the remaining of the taker, stop filling
  'decrease_take',
  // abort the fill process, revert all filled and force cancel the maker order
  'expire_both',
  // allow self trade
  'fill',
] as const;

export type TimeInForce = (typeof TIME_IN_FORCES)[number];
export type SeltTradeBehavior = (typeof SELF_TRADE_BEHAVIORS)[number];

export type OrderFlag = {
  timeInForce: TimeInForce;
  selfTradeBehavior: SeltTradeBehavior;
  reduceOnly: boolean;
  expiresAt: number | undefined | null;
  isMarketOrder: boolean;
};

export const DEFAULT_ORDER_FLAG: OrderFlag = {
  expiresAt: undefined,
  reduceOnly: false,
  timeInForce: 'default',
  isMarketOrder: false,
  selfTradeBehavior: 'cancel_provide',
};

export const encodeFlag = (flag: OrderFlag) => {
  const isMarket = flag.isMarketOrder ? 1n : 0n;
  const reduceOnly = flag.reduceOnly ? 1n : 0n;
  const tif = BigInt(TIME_IN_FORCES.indexOf(flag.timeInForce));
  const stb = BigInt(SELF_TRADE_BEHAVIORS.indexOf(flag.selfTradeBehavior));
  return (
    (tif << 62n) |
    (reduceOnly << 61n) |
    (isMarket << 60n) |
    (stb << 58n) |
    BigInt(flag.expiresAt || 0)
  );
};

export const EIP712_DOMAIN = {
  name: 'FOUNDATION',
  chainId: 1,
  version: '0.1.0',
} as const;

export type NumericString = `${number}`;

export type OrderStatus =
  | 'placed'
  | 'filled'
  | 'partial_filled'
  | 'canceled'
  | 'conditional_canceled';