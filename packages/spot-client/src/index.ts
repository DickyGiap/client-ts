import Client, {
  HTTPTransport,
  RequestManager,
  WebSocketTransport,
} from '@open-rpc/client-js';
import assert from 'node:assert';
import { randomInt } from 'node:crypto';
import { type Address, type Hash, type LocalAccount, parseEther } from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import {
  buildAccountId,
  type NumericString,
  encodeFlag,
  type OrderFlag,
  type Side,
  ProductType,
  type OrderStatus,
  DEFAULT_ORDER_FLAG,
  EIP712_DOMAIN,
} from '@foundation-network/core';

type Account = LocalAccount | SmartAccount;

export const TESTNET_RPC_URL =
  'https://testnet-rpc.foundation.network/spot';

export const TESTNET_API_URL = 'https://testnet-api.foundation.network';

type ClientOptions = {
  rpcUrl: string;
  apiUrl: string;
  brokerId: number;
};

const DefaultClientOption: ClientOptions = {
  rpcUrl: TESTNET_RPC_URL,
  apiUrl: TESTNET_API_URL,
  brokerId: 1,
};

export class FoundationSpotClient {
  private rpcClient: Client;
  private signer: Account;
  private apiUrl: string;
  subaccount: Hash;
  assets: AssetInfo[] = [];
  config: SigningConfig | undefined;

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
    this.apiUrl = options.apiUrl;
    this.subaccount = buildAccountId(
      signer.address,
      ProductType.Spot,
      options.brokerId,
      0,
    );
  }

  async getAccountInfo() {
    return await this.rpcClient.request({
      method: 'account_get_account',
      params: [this.subaccount],
    });
  }

  async placeLimit(
    base: string,
    quote: string,
    side: Side,
    price: string,
    amount: string,
    flag_?: Partial<OrderFlag> | undefined,
  ) {
    const assets = await this.getAssets();
    const baseAsset = assets.find((t) => t.ticker === base);
    const quoteAsset = assets.find((t) => t.ticker === quote);
    const config = await this.getSigningConfig();

    assert(baseAsset && quoteAsset, 'Unknown assets');

    const nonce =
      (BigInt(Date.now() + 20_000) << 20n) | BigInt(randomInt(1000, 30000));
    const flag: OrderFlag =
      typeof flag_ === 'undefined'
        ? DEFAULT_ORDER_FLAG
        : Object.assign({}, DEFAULT_ORDER_FLAG, flag_);
    const exp = encodeFlag(flag);

    const signData = {
      domain: { ...EIP712_DOMAIN, verifyingContract: config.offchain_book },
      message: {
        accountId: this.subaccount,
        base: BigInt(baseAsset.asset_id),
        quote: BigInt(quoteAsset.asset_id),
        nonce: nonce,
        priceX18: parseEther(price),
        amount: side === 'bid' ? parseEther(amount) : -parseEther(amount),
        expiration: exp,
        triggerCondition: 0n,
      },
      primaryType: 'Order',
      types: {
        Order: [
          { type: 'bytes32', name: 'accountId' },
          { type: 'uint64', name: 'base' },
          { type: 'uint64', name: 'quote' },
          { type: 'int128', name: 'priceX18' },
          { type: 'int128', name: 'amount' },
          { type: 'uint64', name: 'expiration' },
          { type: 'uint64', name: 'nonce' },
          { type: 'uint128', name: 'triggerCondition' },
        ],
      },
    } as const;

    const signature = await this.signer.signTypedData(signData);

    const params = {
      method: 'ob_place_limit',
      params: [
        {
          account_id: this.subaccount,
          pair: [baseAsset.asset_id, quoteAsset.asset_id],
          side,
          price,
          amount,
          time_in_force: flag.timeInForce,
          expires_at: flag.expiresAt === 0 ? null : flag.expiresAt,
          is_market_order: flag.isMarketOrder,
          self_trade_behavior: flag.selfTradeBehavior,
          nonce: nonce.toString(),
        },
        signature,
      ],
    };

    await this.rpcClient.request(params);
  }

  private async getAssets() {
    if (this.assets.length) {
      return this.assets;
    }
    const res = await fetch(`${this.apiUrl}/asset/v1/supported-assets`);

    const assets = (await res.json()) as AssetInfo[];

    this.assets = assets;
    return this.assets;
  }

  private async getSigningConfig() {
    if (!this.config) {
      this.config = (await this.rpcClient.request({
        method: 'core_get_config',
      })) as SigningConfig;
    }

    return this.config;
  }
}

type SigningConfig = {
  endpoint: Address;
  offchain_book: Address;
  eip712_domain_name: string;
  eip712_domain_version: string;
  eip712_domain_chain_id: number;
};

type AssetInfo = {
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
