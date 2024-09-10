import Client, {
  HTTPTransport,
  RequestManager,
  WebSocketTransport,
} from '@open-rpc/client-js';
import assert from 'node:assert';
import { randomInt } from 'node:crypto';
import {
  type Address,
  formatEther,
  type Hash,
  type LocalAccount,
  parseEther,
} from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import {
  buildAccountId,
  type Side,
  type OrderFlag,
  ProductType,
  DEFAULT_ORDER_FLAG,
  EIP712_DOMAIN,
  encodeFlag,
} from '@foundation-network/core';

type Account = LocalAccount | SmartAccount;

export const TESTNET_RPC_URL =
  'https://testnet-rpc.foundation.network/perpetual';

type ClientOptions = {
  rpcUrl: string;
  subAccountIndex: number;
  brokerId: number;
};

const DefaultClientOption: ClientOptions = {
  rpcUrl: TESTNET_RPC_URL,
  brokerId: 1,
  subAccountIndex: 0,
};

export class FoundationPerpClient {
  private rpcClient: Client;
  private markets: MarketConfig[] = [];
  private signer: Account;
  subaccount: Hash;

  constructor(signer: Account, options_: Partial<ClientOptions>) {
    const options: ClientOptions = Object.assign(
      {},
      DefaultClientOption,
      options_,
    );

    const transport = options.rpcUrl.startsWith('ws')
      ? new WebSocketTransport(options.rpcUrl)
      : new HTTPTransport(options.rpcUrl);
    this.rpcClient = new Client(new RequestManager([transport]));
    this.signer = signer;
    this.subaccount = buildAccountId(
      signer.address,
      ProductType.Perpetual,
      options.brokerId,
      options.subAccountIndex,
    );
  }

  async getAccountInfo() {
    return (await this.rpcClient.request({
      method: 'ob_query_account',
      params: [this.subaccount],
    })) as Promise<AccountInfo>;
  }

  async getPendingOrders(symbol: string) {
    const marketConfig = await this.getMarket(symbol);
    return (await this.rpcClient.request({
      method: 'ob_query_user_orders',
      params: [marketConfig.symbol, this.subaccount],
    })) as Promise<PendingOrder[]>;
  }

  async getMarketState(symbol: string) {
    const marketConfig = await this.getMarket(symbol);
    const states = await this.rpcClient.request({
      method: 'ob_query_markets_state',
    });

    return states.find((x: MarketState) => x.symbol === marketConfig.symbol);
  }

  async getMarket(ticker: string): Promise<MarketConfig> {
    if (!this.markets.length) {
      await this.getMarketConfig();
    }

    const market: MarketConfig | undefined = this.markets.find(
      (x) => x.ticker === ticker,
    );
    assert(market, 'unknown ticker');
    return market;
  }

  async getOrderbookDepth(symbol: string, limit: number) {
    const marketConfig = await this.getMarket(symbol);
    return (await this.rpcClient.request({
      method: 'ob_query_depth',
      params: [marketConfig.symbol, limit],
    })) as Promise<Depth>;
  }

  async placeLimit(
    market: string,
    side: Side,
    price: string,
    amount: string,
    flag_?: Partial<OrderFlag> | undefined,
  ) {
    const marketConfig = await this.getMarket(market);

    const flag: OrderFlag =
      typeof flag_ === 'undefined'
        ? DEFAULT_ORDER_FLAG
        : Object.assign({}, DEFAULT_ORDER_FLAG, flag_);

    const cmd = await createPostCmd(
      marketConfig,
      this.signer,
      this.subaccount,
      side,
      price,
      amount,
      flag,
    );
    return await this.rpcClient.request(cmd);
  }

  async placeMarket(
    market: string,
    side: Side,
    amount: string,
    flag_?: Partial<OrderFlag> | undefined,
  ) {
    const book = await this.getOrderbookDepth(market, 1);

    let price: string;
    if (side === 'ask') {
      // find best bid price then add 5% slippage
      price = book.bids.map((lv) => {
        const p = (parseEther(lv[0]) * 105n) / 100n;
        return formatEther(p);
      })[0];
    } else {
      price = book.asks.map((lv) => {
        const p = (parseEther(lv[0]) * 95n) / 100n;
        return formatEther(p);
      })[0];
    }

    if (!price) {
      throw new Error('Market order expired due to empty order book');
    }

    return await this.placeLimit(market, side, price, amount, flag_);
  }

  async cancelOrder(market: string, orderId: number) {
    const marketConfig = await this.getMarket(market);
    const nonce = (BigInt(Date.now() + 20_000) << 20n) | BigInt(randomInt(0, 10000));

    const signData = {
      domain: {
        ...EIP712_DOMAIN,
        verifyingContract: marketConfig.offchainBook,
      },
      message: {
        subaccount: this.subaccount,
        nonce: nonce,
        orderId: BigInt(orderId),
      },
      primaryType: 'Cancel',
      types: {
        Cancel: [
          { type: 'bytes32', name: 'subaccount' },
          { type: 'uint64', name: 'nonce' },
          { type: 'uint64', name: 'orderId' },
        ],
      },
    } as const;

    const signature = await this.signer.signTypedData(signData);

    return await this.rpcClient.request({
      method: 'ob_trade',
      params: [
        this.subaccount,
        {
          cancel: {
            symbol: marketConfig.symbol,
            orderId: orderId.toString(),
          },
        },
        signature,
        nonce.toString(),
        '',
      ],
    });
  }

  private async getMarketConfig() {
    const markets: GetOpenMarketResult = await this.rpcClient.request({
      method: 'ob_query_open_markets',
      params: [],
    });

    this.markets = markets.map((t) => {
      return {
        symbol: t.symbol,
        ticker: t.ticker,
        offchainBook: t.offchain_book,
        tickSize: t.tick_size,
        stepSize: t.step_size,
        minAmount: t.step_size,
      };
    });
  }
}

export type MarketConfig = {
  symbol: Hash;
  ticker: string;
  tickSize: string;
  stepSize: string;
  minAmount: string;
  offchainBook: Address;
};

const createPostCmd = async (
  market: MarketConfig,
  signer: Account,
  subaccount: Hash,
  method: Side,
  price: string,
  amount: string,
  flag: OrderFlag,
) => {
  const nonce = (BigInt(Date.now() + 20_000) << 20n) | BigInt(randomInt(0, 10000));
  const exp = encodeFlag(flag);

  const signData = {
    domain: { ...EIP712_DOMAIN, verifyingContract: market.offchainBook },
    message: {
      subaccount,
      nonce: nonce,
      price: parseEther(price),
      amount: method === 'bid' ? parseEther(amount) : -parseEther(amount),
      expiration: exp,
      triggerCondition: 0n,
    },
    primaryType: 'Order',
    types: {
      Order: [
        { name: 'subaccount', type: 'bytes32' },
        { name: 'price', type: 'int256' },
        { name: 'amount', type: 'int256' },
        { name: 'nonce', type: 'uint64' },
        { name: 'expiration', type: 'uint64' },
        { name: 'triggerCondition', type: 'uint128' },
      ],
    },
  } as const;

  const signature = await signer.signTypedData(signData);

  return {
    method: 'ob_trade',
    params: [
      subaccount, // account id
      {
        [method]: {
          symbol: market.symbol,
          amount,
          price,
          expiration: {
            time_in_force: flag.timeInForce, // immediate_or_cancel | fill_or_kill | post_only
            reduce_only: flag.reduceOnly,
            expires_at: flag.expiresAt, // unix epoch in second
            is_market_order: flag.isMarketOrder,
            self_trade_behavior: flag.selfTradeBehavior,
          },
        },
      },
      signature,
      nonce.toString(),
      '',
    ],
  };
};

type OpenMarket = {
  symbol: Hash;
  ticker: string;
  offchain_book: Address;
  tick_size: string;
  step_size: string;
  min_amount: string;
};

type GetOpenMarketResult = OpenMarket[];

export type NumericString = `${number}`;

export type OrderStatus =
  | 'placed'
  | 'filled'
  | 'canceled'
  | 'conditional_canceled';

export type PendingOrder = {
  order_id: 8;
  account_id: Hash;
  symbol: Hash;
  side: Side;
  create_timestamp: number;
  amount: NumericString;
  price: NumericString;
  status: OrderStatus;
  matched_quote_amount: NumericString;
  matched_base_amount: NumericString;
  quote_fee: NumericString;
  nonce: number;
  expiration: OrderFlag;
  trigger_condition: null;
  is_triggered: true;
  signature: Hash;
  signer: Address | null;
  hash: Hash;
  has_dependency: boolean;
  tag: 'limit' | 'market' | 'stop_loss' | 'take_profit';
};

export type Position = {
  base_amount: NumericString;
  quote_amount: NumericString;
  last_cumulative_funding: NumericString;
  frozen_in_bid_order: NumericString;
  frozen_in_ask_order: NumericString;
  unsettled_pnl: NumericString;
  is_settle_pending: boolean;
};
export type AccountInfo = {
  positions: Record<Hash, Position>;
  collateral: NumericString;
  is_in_liquidation_queue: boolean;
};

export type Level = [NumericString, NumericString, NumericString];

export type Depth = {
  asks: Level[];
  bids: Level[];
  symbol: Hash;
};

type MarketState = {
  symbol: Hash;
  open_interest: '0';
  cumulative_funding: NumericString;
  available_settle: NumericString;
  next_funding_rate: NumericString;
  mark_price: NumericString;
};
