import Client, { HTTPTransport, RequestManager, WebSocketTransport, } from '@open-rpc/client-js';
import { type Hash, type LocalAccount, parseUnits } from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import {
  buildAccountId,
  DEFAULT_ORDER_FLAG,
  type OrderFlag,
  ProductType,
  type Side,
} from '@foundation-network/core';
import { encodeSpotFlag, PRECISION } from "@foundation-network/core/src";
import {
  AccountInfo,
  AssetInfo,
  GetOrderHistoryParams, GetTradeHistoryParams,
  MarketDepth,
  PendingOrder,
  SpotConfig,
  SpotMarket
} from "./types";
import { getNonce } from './utils';

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
  config: SpotConfig | undefined;

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

  async getOpenMarkets() {
    return await this.rpcClient.request({
      method: 'ob_get_open_markets',
      params: []
    }) as SpotMarket[];
  }

  async getAccountInfo() {
    return await this.rpcClient.request({
      method: 'account_get_account',
      params: [this.subaccount],
    }) as AccountInfo;
  }

  async placeLimit(
    marketId: number,
    side: Side,
    price: string,
    amount: string,
    flag_?: Partial<OrderFlag> | undefined,
  ) {
    const nonce = getNonce()
    const flag: OrderFlag =
      typeof flag_ === 'undefined'
        ? DEFAULT_ORDER_FLAG
        : Object.assign({}, DEFAULT_ORDER_FLAG, flag_);
    const exp = encodeSpotFlag(flag);

    const config = await this.getSigningConfig();

    const signData = {
      domain: {
        name: config?.signing_config.eip712_domain_name,
        chainId: config?.signing_config.eip712_domain_chain_id,
        version: config?.signing_config.eip712_domain_version,
        verifyingContract: config?.signing_config.offchain_book
      },
      message: {
        accountId: this.subaccount,
        market: BigInt(marketId),
        price: parseUnits(price, PRECISION),
        amount: side === 'bid' ? parseUnits(amount, PRECISION) : -parseUnits(amount, PRECISION),
        expiration: exp,
        nonce: nonce,
        triggerCondition: BigInt(0),
      },
      primaryType: 'Order',
      types: {
        Order: [
          { name: 'accountId', type: 'bytes32' },
          { name: 'market', type: 'uint64' },
          { name: 'price', type: 'int128' },
          { name: 'amount', type: 'int128' },
          { name: 'expiration', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
          { name: 'triggerCondition', type: 'uint128' },
        ],
      },
    } as const;

    const signature = await this.signer.signTypedData(signData);

    const params = {
      method: 'ob_place_limit',
      params: [
        {
          account_id: this.subaccount,
          market_id: marketId,
          side,
          price: price,
          amount: amount,
          time_in_force: flag.timeInForce,
          expires_at: flag.expiresAt || null,
          is_market_order: flag.isMarketOrder,
          self_trade_behavior: flag.selfTradeBehavior || null,
          nonce: nonce.toString(),
        },
        signature,
      ],
    };

    return await this.rpcClient.request(params);
  }

  async getAssets() {
    if (this.assets.length) {
      return this.assets;
    }
    const res = await fetch(`${this.apiUrl}/asset/v1/supported-assets`);

    this.assets = (await res.json()) as AssetInfo[];
    return this.assets;
  }

  async getSigningConfig() {
    if (!this.config) {
      this.config = (await this.rpcClient.request({
        method: 'core_get_config',
      })) as SpotConfig;
    }

    return this.config;
  }

  async getPendingOrders(marketId: number) {
    return await this.rpcClient.request({
      method: 'ob_get_pending_orders',
      params: [marketId, this.subaccount]
    }) as PendingOrder[];
  }

  async cancel(marketId: number, orderId: number) {
    const nonce = getNonce();

    const config = await this.getSigningConfig();

    const signData = {
      domain: {
        name: config?.signing_config.eip712_domain_name,
        chainId: config?.signing_config.eip712_domain_chain_id,
        version: config?.signing_config.eip712_domain_version,
        verifyingContract: config?.signing_config.offchain_book
      },
      message: {
        accountId: this.subaccount,
        marketId: BigInt(marketId),
        orderId: BigInt(orderId),
        nonce: nonce,
      },
      primaryType: 'Order',
      types: {
        Order: [
          { name: 'accountId', type: 'bytes32' },
          { name: 'marketId', type: 'uint64' },
          { name: 'orderId', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
    } as const;

    const signature = await this.signer.signTypedData(signData);
    return await this.rpcClient.request({
      method: 'ob_cancel',
      params: [{
        account_id: this.subaccount,
        market_id: marketId,
        order_id: orderId,
        nonce: nonce.toString()
      }, signature]
    })
  }

  async cancelAll(marketId: number) {
    const nonce = getNonce();

    const config = await this.getSigningConfig();

    const signData = {
      domain: {
        name: config?.signing_config.eip712_domain_name,
        chainId: config?.signing_config.eip712_domain_chain_id,
        version: config?.signing_config.eip712_domain_version,
        verifyingContract: config?.signing_config.offchain_book
      },
      message: {
        accountId: this.subaccount,
        marketId: BigInt(marketId),
        nonce: nonce,
      },
      primaryType: 'Order',
      types: {
        Order: [
          { name: 'accountId', type: 'bytes32' },
          { name: 'marketId', type: 'uint64' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
    } as const;

    const signature = await this.signer.signTypedData(signData);
    return await this.rpcClient.request({
      method: 'ob_cancel_all',
      params: [{
        account_id: this.subaccount,
        market_id: marketId,
        nonce: nonce.toString()
      }, signature]
    })
  }

  async getDepth(marketId: number, take: number) {
    return await this.rpcClient.request({
      method: 'ob_get_depth',
      params: [marketId, take]
    }) as MarketDepth;
  }

  async getOrderHistory(params: Partial<GetOrderHistoryParams>) {
    if (!params.account) throw new Error('Account not found!');
    let str = Object.entries(params).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');
    const res = await fetch(`${this.apiUrl}/indexer/v1/perp/order-history` + `?${str}`)
    return await res.json()
  }

  async getOrderDetail(marketId: number, orderId: number) {
    const res = await fetch(`${this.apiUrl}/indexer/v1/perp/order-history?marketId=${marketId}&orderId=${orderId}`)
    return await res.json()
  }

  async getTradingHistory(params: Partial<GetTradeHistoryParams>) {
    if (!params.account) throw new Error('Account not found!');
    let str = Object.entries(params).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');
    const res = await fetch(`${this.apiUrl}/indexer/v1/perp/trade-history` + `?${str}`)
    return await res.json()
  }
}