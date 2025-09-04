// client/src/app/utils/api.ts
import { Wallet, NFT } from './types';

interface DexScreenerResponse {
  pairs?: { priceUsd: string }[];
}

interface SolscanResponse {
  priceUsdt?: number;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching ${url} (attempt ${i + 1})`);
      const response = await fetch(url, options);
      if (!response.ok) {
        console.error(`HTTP error for ${url}: ${response.status}`);
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (error: unknown) {
      const err = error as Error;
      if (i === retries - 1) throw err;
      console.warn(`Retrying ${url} (attempt ${i + 1}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('fetchWithRetry failed after all retries');
}

export async function fetchTokenPrice(contractAddress: string, timestamp: string = new Date().toISOString()): Promise<number> {
  try {
    const response = await fetchWithRetry(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      { method: 'GET' },
      3,
      1000
    );
    const pair = response?.pairs?.[0];
    const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0.0001;
    return price;
  } catch (error) {
    console.error('Failed to fetch price data from Dexscreener API:', error);
    try {
      const response = await fetchWithRetry(
        `https://public-api.solscan.io/market/token/${contractAddress}`,
        { method: 'GET' },
        3,
        1000
      );
      const price = response?.priceUsdt || 0.0001;
      return price;
    } catch (error) {
      console.error('Failed to fetch price data from Solscan API:', error);
      return 0.0001;
    }
  }
}

export async function sendTelegramNotification(message: string, chatId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Telegram bot token is missing.');
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram notification failed:', data.description);
      return false;
    }
    console.log('Telegram notification sent:', message);
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

export async function getFirst100Buyers(mintAddress: string): Promise<Wallet[]> {
  try {
    const transactions = await fetchWithRetry(
      `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${
        process.env.HELIUS_API_KEY || '777a1ea7-8afd-43dc-bd6b-ba265d6f7258'
      }`,
      { method: 'GET' },
      3,
      1000
    );
    const buyTxs = transactions
      .filter((tx: any) => tx.type === 'buy' || (tx.type === 'TOKEN_TRANSFER' && tx.destination))
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, 100);

    const buyerStats: Record<string, Wallet> = buyTxs.reduce((acc: Record<string, Wallet>, tx: any) => {
      const walletAddress = tx.destination || tx.owner;
      if (!acc[walletAddress]) {
        acc[walletAddress] = {
          address: walletAddress,
          totalAmount: 0,
          score: 10,
          scoreDetails: {
            earlyBuy: 0,
            profitability: 0,
            network: 0,
            time: 10,
            amount: 0,
            duration: 0,
            pumpDump: 0,
            largeSellImpact: 0,
          },
          firstTxTime: tx.timestamp,
          lastTxTime: tx.timestamp,
          holdingDuration: 0,
          buyCount: 0,
          sellCount: 0,
          totalVolume: 0,
          avgTradeSize: 0,
          tradeFrequency: 0,
          otherTokenActivity: 0,
          solBalance: 0,
          mostProfitableTrade: { amount: 0, timestamp: 'N/A' },
          profitableTradeRatio: 0,
          walletLabel: 'Standard',
          transactions: [],
          isEarlyBuyer: true,
          isHolder: false,
          isActiveTrader: false,
          profitEstimates: [],
          isLongTermHolder: false,
          isWhale: false,
          networkConnections: [],
        };
      }
      acc[walletAddress].totalAmount += tx.amount || 0;
      acc[walletAddress].totalVolume += tx.amount || 0;
      acc[walletAddress].buyCount += 1;
      acc[walletAddress].transactions.push({
        signature: tx.signature || `temp_${Date.now()}`,
        amount: tx.amount || 0,
        timestamp: tx.timestamp,
        type: 'buy',
        txTime: new Date(tx.timestamp).getTime(),
      });
      acc[walletAddress].lastTxTime = tx.timestamp;
      acc[walletAddress].avgTradeSize = acc[walletAddress].totalVolume / acc[walletAddress].buyCount;
      acc[walletAddress].tradeFrequency =
        acc[walletAddress].transactions.length / (acc[walletAddress].holdingDuration / 24 || 1);
      return acc;
    }, {});

    const wallets: Wallet[] = Object.values(buyerStats);
    for (const wallet of wallets) {
      const sellTxs = transactions.filter((tx: any) => tx.type === 'sell' && tx.owner === wallet.address);
      wallet.totalAmount -= sellTxs.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
      wallet.sellCount = sellTxs.length;
      wallet.isHolder = wallet.totalAmount > 0;
      wallet.avgTradeSize = wallet.totalVolume / (wallet.buyCount + wallet.sellCount) || 0;
      wallet.transactions.push(
        ...sellTxs.map((tx: any) => ({
          signature: tx.signature || `temp_${Date.now()}`,
          amount: tx.amount || 0,
          timestamp: tx.timestamp,
          type: 'sell',
          txTime: new Date(tx.timestamp).getTime(),
        }))
      );
    }

    return wallets.slice(0, 100);
  } catch (error) {
    console.error('Failed to fetch first 100 buyers from Helius:', error);
    return [];
  }
}

export const fetchNFTs = async (walletAddress: string): Promise<NFT[]> => {
  try {
    const response = await fetchWithRetry(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/nfts?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`,
      { method: 'GET' },
      3,
      1000
    );

    return response.map((nft: any) => ({
      mint: nft.mint,
      name: nft.name || 'Unknown NFT',
      image: nft.image || '/placeholder.png',
      floorPrice: nft.floorPrice ? nft.floorPrice / 1e9 : 0, // SOL cinsine çevir
      purchasePrice: nft.purchasePrice ? nft.purchasePrice / 1e9 : 0, // Varsayılan
      purchaseDate: nft.purchaseDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to fetch NFTs from Helius:', error);
    throw error;
  }
};