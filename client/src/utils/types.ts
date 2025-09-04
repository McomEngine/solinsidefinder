// src/app/utils/types.ts
export interface Wallet {
  address: string;
  totalAmount: number;
  score: number;
  scoreDetails: {
    earlyBuy: number;
    profitability: number;
    network: number;
    time: number;
    amount: number;
    duration: number;
    pumpDump: number;
    largeSellImpact: number;
  };
  firstTxTime: string;
  lastTxTime: string;
  holdingDuration: number;
  buyCount: number;
  sellCount: number;
  totalVolume: number;
  avgTradeSize: number;
  tradeFrequency: number;
  otherTokenActivity: number;
  solBalance: number;
  mostProfitableTrade: { amount: number; timestamp: string };
  profitableTradeRatio: number;
  walletLabel: string;
  transactions: Transaction[];
  isEarlyBuyer: boolean;
  isHolder: boolean;
  isActiveTrader: boolean;
  profitEstimates: number[];
  isLongTermHolder: boolean;
  isWhale: boolean;
  networkConnections: { address: string; sharedTxCount: number; score: number }[];
}

export interface Transaction {
  signature: string;
  amount: number;
  timestamp: string;
  type: 'buy' | 'sell';
  txTime: number;
}

export interface BubbleData {
  nodes: { id: string; balance: number }[];
  edges: { source: string; target: string; amount: number; timestamp: string }[];
}

export interface FilterState {
  minAmount: number;
  walletType: 'all' | 'earlyBuyers' | 'holders' | 'activeTraders' | 'largeSellers';
  timeRange: '24h' | '7d' | '30d' | 'all';
}

export interface TimelineEvent {
  timestamp: string;
  eventType: string;
  wallet: string;
  amount: number;
  type: 'buy' | 'sell';
  price?: number; // Yeni eklenen alan, isteğe bağlı
}

export interface RugCheckData {
  totalSupply: number;
  insiderCount: number;
  insiderHoldings: number;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  burnedPercentage: number;
  liquidityLocked: number;
  contractRenounced: boolean;
  upgradeable: boolean;
  reasons: string[];
}

export interface MonitoredTransaction {
  wallet: string;
  type: 'buy' | 'sell';
  amount: number;
  timestamp: string;
  isLargeSell?: boolean;
}

export interface PieChartData {
  title: string;
  value: number;
  color: string;
}

export interface NFT {
  mint: string;
  name: string;
  image: string;
  floorPrice: number;
  purchasePrice: number;
  purchaseDate: string;
}

export interface NFTListing {
  mint: string;
  name: string;
  price: number;
  collection: string;
  rarity: string;
  timestamp: string;
}

export interface TokenCompareData {
  address: string;
  name: string;
  price: number;
  volume: number;
  marketCap: number;
}

export interface TokenData {
  results?: {
    earlyBuyers?: Wallet[];
    holders?: Wallet[];
    activeTraders?: Wallet[];
    largeSellers?: Wallet[];
  };
  rugCheckData?: RugCheckData;
  healthScore?: number;
  insiderIntensity?: number;
  healthReasons?: string[];
  timelineData?: TimelineEvent[];
  bubbleData?: BubbleData;
  tokenCompareData?: TokenCompareData[];
}

export interface BattleArenaSectionProps {
  tokenCompareData: TokenCompareData[];
  contractAddress: string;
  favoriteTokens: string[];
  addFavoriteToken: () => void;
  removeFavoriteToken: (address: string) => void;
}

export interface WalletDetailsModalProps {
  onClose: () => void;
  walletData: {
    address: string;
    balance: number;
    insiderScore: number | null;
    walletLabel: string;
    totalVolume: number;
    buyCount: number;
    sellCount: number;
    lastTx: string;
    networkConnections: { address: string; sharedTxCount: number; score: number }[];
  };
  chartData: PieChartData[];
  getBadgeTitle: (score: number | null) => string;
  followWallet: (address: string) => void;
  isFollowing: boolean;
}

export interface ConnectWalletModalProps {
  connected: boolean;
  isAllowed: boolean;
  allowlist: string[];
}