import type {Address, Hash} from "viem";
import type {NumericString, OrderFlag, OrderStatus, Side} from "@foundation-network/core";

export type SpotConfig = {
  signing_config: SigningConfig;
  system_fee_tiers: FeeTier[]
}

export type FeeTier = {
  taker_fee: NumericString;
  maker_fee: NumericString;
}

export type SigningConfig = {
  endpoint: Address;
  offchain_book: Address;
  eip712_domain_name: string;
  eip712_domain_version: string;
  eip712_domain_chain_id: number;
};

export type AssetInfo = {
  asset_id: number;
  name: string;
  ticker: string;
};

export type MarketConfig = {
  symbol: Hash;
  ticker: string;
  tickSize: string;
  stepSize: string;
  minAmount: string;
  offchainBook: Address;
};

export type PendingOrder = {
  market_id: number,
  order_id: 8;
  account_id: Hash;
  side: Side;
  price: NumericString;
  amount: NumericString;
  status: OrderStatus;
  matched_quote_amount: NumericString;
  matched_base_amount: NumericString;
  system_quote_fee: NumericString;
  system_base_fee: NumericString;
  broker_quote_fee: NumericString;
  broker_base_fee: NumericString;
  nonce: number;
  expiration: OrderFlag;
  trigger_condition: null;
  created_at: number;
  is_triggered: true;
  signature: Hash;
  signer: Address | null;
  tag: 'limit' | 'market' | 'stop_loss' | 'take_profit';
  system_fee_tier: FeeTier,
  broker_fee_tier: FeeTier
};

export type AccountInfo = Record<string, Balance>;

export type Balance = {
  available: NumericString;
  frozen: NumericString;
}
export type Level = [NumericString, NumericString, NumericString];

export type Depth = {
  asks: Level[];
  bids: Level[];
  symbol: Hash;
};

export type SpotMarket = {
  id: number;
  ticker: string;
  base: number;
  quote: number;
  tick_size: NumericString;
  step_size: NumericString;
  available_from: number;
  min_volume: NumericString;
  price_floor: string;
  price_cap: string;
  unavailable_after: number | null
}

export type GetOrderHistoryParams = {
  account: string;
  take: number;
  page?: number;
  startTime?: number;
  endTime?: number;
  marketId?: number;
  isBuyer?: boolean;
  status: string;
};

export type MarketDepth = {
  asks: [string, string][];
  bids: [string, string][];
}

export type GetTradeHistoryParams = {
  account: string;
  take: number;
  page?: number;
  startTime?: number;
  endTime?: number;
  marketId?: number;
  isBuyer?: boolean;
  isMaker?: boolean;
}