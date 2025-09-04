// components/WalletActivityPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '../../utils/helpers';

interface TransactionDetail {
  signature: string;
  type: 'buy' | 'sell' | 'transfer';
  tokenAddress: string;
  amount: number;
  solAmount: number;
  timestamp: string;
  pricePerToken: number;
  tokenName: string;
  profit?: number;
}

interface WalletActivityPanelProps {
  walletAddress: string | null;
  onClose: () => void;
  contractAddress?: string;
  monitoredTransactions: any[];
}

export default function WalletActivityPanel({
  walletAddress,
  onClose,
  contractAddress,
  monitoredTransactions,
}: WalletActivityPanelProps) {
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);

  // monitoredTransactions'dan veri çekme
  useEffect(() => {
    if (!walletAddress || !monitoredTransactions.length) return;

    const walletTxs = monitoredTransactions
      .filter((tx) => tx.wallet === walletAddress && tx.amount > 0)
      .map((tx) => ({
        signature: `monitor_${tx.timestamp}_${tx.wallet}`,
        type: tx.type,
        tokenAddress: contractAddress || tx.tokenAddress || 'Unknown',
        amount: tx.amount,
        solAmount: tx.solAmount || 0.0001, // Helius API'den gelmezse varsayılan
        timestamp: tx.timestamp,
        pricePerToken: tx.solAmount && tx.amount ? tx.solAmount / tx.amount : 0.0001,
        tokenName: tx.tokenName || contractAddress?.slice(0, 6) || 'Unknown',
      }));

    console.log('monitoredTransactions filtrelendi:', walletTxs);
    setTransactions((prev) => {
      const combined = [...walletTxs, ...prev];
      const unique = Array.from(new Map(combined.map((tx) => [tx.signature, tx])).values()).slice(0, 50);
      console.log('Birleştirilmiş işlemler (monitor):', unique);
      return unique;
    });
  }, [monitoredTransactions, walletAddress, contractAddress]);

  // Helius API ile veri çekme
  const { data: apiActivity, isLoading: isApiLoading, error: apiError } = useQuery({
    queryKey: ['walletActivity', walletAddress],
    queryFn: async () => {
      const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${
        process.env.HELIUS_API_KEY || 'YOUR_HELIUS_API_KEY'
      }`;
      console.log('Helius API isteği:', url);
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        console.error('Helius API hatası:', response.status, response.statusText);
        throw new Error('Failed to fetch wallet activity');
      }
      const data = await response.json();
      console.log('Helius API ham verisi:', data);
      const filteredData = data
        .filter((tx: any) => {
          const isRelevant =
            ['buy', 'sell', 'TOKEN_TRANSFER'].includes(tx.type) &&
            (!contractAddress || tx.tokenAddress === contractAddress);
          console.log('İşlem filtresi:', tx.signature, tx.type, isRelevant);
          return isRelevant;
        })
        .map((tx: any) => ({
          signature: tx.signature || `temp_${Date.now()}`,
          type: tx.type === 'buy' ? 'buy' : tx.type === 'sell' ? 'sell' : 'transfer',
          tokenAddress: tx.tokenAddress || contractAddress || 'Unknown',
          amount: tx.amount || 0,
          solAmount: tx.solAmount || 0.0001,
          timestamp: tx.timestamp || new Date().toISOString(),
          pricePerToken: tx.solAmount && tx.amount ? tx.solAmount / tx.amount : 0.0001,
          tokenName: tx.tokenName || tx.tokenAddress?.slice(0, 6) || 'Unknown',
        }));
      console.log('Filtrelenmiş Helius verisi:', filteredData);
      return filteredData;
    },
    enabled: !!walletAddress,
    refetchInterval: 30000,
  });

  // Helius API'den gelen verileri ekleme
  useEffect(() => {
    if (apiActivity && Array.isArray(apiActivity)) {
      setTransactions((prev) => {
        const combined = [...apiActivity, ...prev];
        const unique = Array.from(new Map(combined.map((tx) => [tx.signature, tx])).values()).slice(0, 50);
        console.log('Birleştirilmiş işlemler (Helius):', unique);
        return unique;
      });
    }
  }, [apiActivity]);

  // Hata loglama
  useEffect(() => {
    if (apiError) {
      console.error('Helius API useQuery hatası:', apiError);
    }
  }, [apiError]);

  // Kar/zarar hesaplama
  const calculateProfit = (tx: TransactionDetail, prevTxs: TransactionDetail[]): number | undefined => {
    if (tx.type !== 'sell') return undefined;

    const buyTxs = prevTxs.filter(
      (t) => t.type === 'buy' && t.tokenAddress === tx.tokenAddress && t.timestamp < tx.timestamp
    );
    if (!buyTxs.length) return undefined;

    const avgBuyPrice = buyTxs.reduce((sum, t) => sum + t.solAmount, 0) / buyTxs.reduce((sum, t) => sum + t.amount, 0);
    const sellPrice = tx.solAmount / tx.amount;
    return (sellPrice - avgBuyPrice) * tx.amount;
  };

  const processedTransactions = transactions.map((tx) => ({
    ...tx,
    profit: calculateProfit(tx, transactions),
  }));

  if (!walletAddress) return null;

  return (
    <div className="wallet-activity-panel dystopian-panel">
      <div className="panel-header">
        <h3>Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</h3>
        <button className="close-button dystopian-button" onClick={onClose}>
          ✕
        </button>
      </div>
      {isApiLoading && !transactions.length ? (
        <div className="cyber-spinner" />
      ) : processedTransactions.length ? (
        <ul className="transaction-list">
          {processedTransactions.map((tx, index) => (
            <li
              key={tx.signature || index}
              className={`transaction-item ${tx.type} ${tx.profit && tx.profit < 0 ? 'loss' : ''}`}
            >
              <div className="transaction-details">
                <p>
                  <strong>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</strong>{' '}
                  {formatNumber(tx.amount)} {tx.tokenName} for {formatNumber(tx.solAmount)} SOL
                </p>
                <p className="timestamp">{new Date(tx.timestamp).toLocaleString()}</p>
                {tx.profit !== undefined && (
                  <p className={`profit ${tx.profit >= 0 ? 'positive' : 'negative'}`}>
                    {tx.profit >= 0 ? '+' : ''}{formatNumber(tx.profit)} SOL ({tx.profit >= 0 ? 'Profit' : 'Loss'})
                  </p>
                )}
                <a
                  href={`https://solscan.io/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-link"
                >
                  View Transaction
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-data">No recent activity found.</p>
      )}
    </div>
  );
}