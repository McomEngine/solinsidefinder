'use client';

import { useState, useEffect } from 'react';
import { Connection } from '@solana/web3.js';

interface Transaction {
  type: 'BUY' | 'SELL';
  token: string;
  amount: number;
  usdValue: number;
  timestamp: string;
}

interface WalletPerformanceDashboardProps {
  walletAddress: string;
  onClose: () => void;
}

export const WalletPerformanceDashboard: React.FC<WalletPerformanceDashboardProps> = ({
  walletAddress,
  onClose,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Anlık işlemleri çekme (WebSocket ile)
  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchInitialTransactions = async () => {
      try {
        const txs = await fetchTransactions(walletAddress); // İlk işlemler
        setTransactions(txs);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setError('Failed to load transactions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialTransactions();

    // WebSocket ile gerçek zamanlı güncellemeler
    const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
    if (!API_KEY) {
      setError('Helius API key is missing. Please set NEXT_PUBLIC_HELIUS_API_KEY in your .env file.');
      return;
    }

    const ws = new WebSocket(`wss://api.helius.xyz/v0/websocket?api-key=${API_KEY}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ method: 'subscribe', params: { account: walletAddress } }));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.transaction) {
          const newTx = parseTransaction(data.transaction);
          setTransactions((prev) => [newTx, ...prev].slice(0, 50)); // Son 50 işlemi tut
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    ws.onclose = () => console.log('WebSocket closed');
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection failed. Please try again later.');
    };

    return () => ws.close();
  }, [walletAddress]);

  // Örnek API çağrısı (Helius veya kendi backend'inle değiştir)
  const fetchTransactions = async (address: string): Promise<Transaction[]> => {
    const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
    if (!API_KEY) {
      throw new Error('Helius API key is missing. Please set NEXT_PUBLIC_HELIUS_API_KEY in your .env file.');
    }
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${API_KEY}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }
    const txs = await response.json();
    return txs.map(parseTransaction);
  };

  // İşlem verisini parse etme (basitleştirilmiş)
  const parseTransaction = (tx: any): Transaction => ({
    type: tx?.type === 'SWAP' && tx?.amount > 0 ? 'BUY' : 'SELL',
    token: tx?.tokenSymbol || 'Unknown',
    amount: Math.abs(tx?.amount || 0),
    usdValue: tx?.usdValue || 0,
    timestamp: tx?.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A',
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content dystopian-panel">
        <h2 className="cyber-title">Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</h2>
        <button onClick={onClose} className="modal-close cyber-button dystopian-button">
          Close
        </button>
        {loading ? (
          <p>Loading transactions...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : transactions.length === 0 ? (
          <p>No recent transactions found.</p>
        ) : (
          <div className="transaction-list">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>USD Value</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index}>
                    <td className={tx.type === 'BUY' ? 'buy' : 'sell'}>{tx.type}</td>
                    <td>{tx.token}</td>
                    <td>{tx.amount.toFixed(4)}</td>
                    <td>${tx.usdValue.toFixed(2)}</td>
                    <td>{tx.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};