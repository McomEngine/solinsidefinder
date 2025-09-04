'use client';

import { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';
import { WalletPerformanceDashboard } from '../components/WalletPerformanceDashboard';

interface MonitoringSectionProps {
  followedWallets: string[];
  followWallet: (address: string) => Promise<void>;
  results: any;
  contractAddress: string;
}

interface WalletStats {
  address: string;
  pnlUsd: number; // Toplam kâr/zarar (USD)
  winRate: number; // Başarılı işlem oranı (%)
}

export const MonitoringSection: React.FC<MonitoringSectionProps> = ({
  followedWallets,
  followWallet,
  results,
  contractAddress,
}) => {
  const [walletStats, setWalletStats] = useState<WalletStats[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Cüzdan performans metriklerini çekme
  useEffect(() => {
    const fetchWalletStats = async () => {
      if (!followedWallets.length) return;
      setLoading(true);
      setError(null);
      try {
        const stats = await Promise.all(
          followedWallets.map(async (address) => {
            try {
              const transactions = await fetchTransactions(address);
              const { pnlUsd, winRate } = calculateMetrics(transactions || []);
              return { address, pnlUsd, winRate };
            } catch (err) {
              console.error(`Error fetching stats for wallet ${address}:`, err);
              return { address, pnlUsd: 0, winRate: 0 }; // Hata durumunda varsayılan değer
            }
          })
        );
        setWalletStats(stats);
      } catch (error) {
        console.error('Error fetching wallet stats:', error);
        setError('Failed to load wallet stats. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchWalletStats();
  }, [followedWallets]);

  // Örnek API çağrısı (Helius veya kendi backend'inle değiştir)
  const fetchTransactions = async (address: string) => {
    try {
      const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
      if (!API_KEY) {
        throw new Error('Helius API key is missing. Please set NEXT_PUBLIC_HELIUS_API_KEY in your .env file.');
      }
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${API_KEY}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching transactions for ${address}:`, error);
      throw error; // Hata yukarıya fırlatılır
    }
  };

  // PnL ve win rate hesaplama (basitleştirilmiş)
  const calculateMetrics = (transactions: any[]) => {
    let pnlUsd = 0;
    let totalTrades = 0;
    let winningTrades = 0;

    if (!Array.isArray(transactions)) {
      return { pnlUsd: 0, winRate: 0 };
    }

    transactions.forEach((tx) => {
      if (tx?.type === 'SWAP') {
        totalTrades++;
        const profit = tx?.profitUsd || 0; // Null check
        pnlUsd += profit;
        if (profit > 0) winningTrades++;
      }
    });

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    return { pnlUsd, winRate };
  };

  const handleWalletClick = (address: string) => {
    setSelectedWallet(address);
  };

  return (
    <div className="dystopian-panel monitoring-section">
      <h2 className="cyber-title">Wallet Monitoring</h2>
      {loading ? (
        <p>Loading wallet stats...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : followedWallets.length === 0 ? (
        <p>No wallets followed yet.</p>
      ) : (
        <div className="wallet-list">
          <table className="wallet-table">
            <thead>
              <tr>
                <th>Wallet Address</th>
                <th>PnL (USD)</th>
                <th>Win Rate (%)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {walletStats.map((wallet) => (
                <tr key={wallet.address}>
                  <td onClick={() => handleWalletClick(wallet.address)} className="wallet-address">
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </td>
                  <td>{wallet.pnlUsd.toFixed(2)}</td>
                  <td>{wallet.winRate.toFixed(2)}%</td>
                  <td>
                    <button
                      onClick={() => followWallet(wallet.address)}
                      className="cyber-button dystopian-button"
                    >
                      {followedWallets.includes(wallet.address) ? 'Unfollow' : 'Follow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedWallet && (
        <WalletPerformanceDashboard
          walletAddress={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </div>
  );
};