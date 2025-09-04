'use client';

import { useState } from 'react';
import { formatNumber } from '../../utils/helpers';

interface Transaction {
  signature: string;
  wallet: string;
  amount: number;
  type: 'buy' | 'sell';
  timestamp: string;
}

interface WalletActivityWidgetProps {
  followedWallets: string[];
  contractAddress: string;
  monitoredTransactions?: Transaction[]; // Optional prop, varsayılan olarak []
}

export default function WalletActivityWidget({
  followedWallets,
  contractAddress,
  monitoredTransactions = [], // Varsayılan değer: boş dizi
}: WalletActivityWidgetProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Filtreleme: Sadece takip edilen cüzdanların işlemlerini göster
  const filteredActivity = monitoredTransactions.filter((tx) =>
    followedWallets.includes(tx.wallet)
  );

  const handleMouseEnter = (tx: Transaction, event: React.MouseEvent<HTMLDivElement>) => {
    const text = [
      `Wallet: ${tx.wallet.slice(0, 6)}...${tx.wallet.slice(-4)}`,
      `Type: ${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}`,
      `Amount: ${formatNumber(tx.amount)} tokens`,
      `Time: ${new Date(tx.timestamp).toLocaleString()}`,
    ].join('\n');
    const x = event.clientX;
    const y = event.clientY;
    setTooltip({ x, y, text });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="cyber-widget glassmorphic-panel">
      <h2 className="widget-title">Followed Wallets Activity</h2>
      <div className="transaction-list">
        {followedWallets.length === 0 ? (
          <p className="no-data">No wallets followed. Follow a wallet from the Wallets section.</p>
        ) : !contractAddress ? (
          <p className="no-data">Please enter a contract address to see wallet activity.</p>
        ) : filteredActivity.length > 0 ? (
          filteredActivity.slice(0, 10).map((tx, index) => (
            <div
              key={`${tx.signature}-${index}`}
              className={`transaction-item glassmorphic-panel ${tx.type}`}
              onMouseEnter={(e) => handleMouseEnter(tx, e)}
              onMouseLeave={handleMouseLeave}
            >
              <span className="transaction-icon">{tx.type === 'buy' ? '🟢' : '🔴'}</span>
              <div className="transaction-details">
                <p>
                  <a
                    href={`https://solscan.io/account/${tx.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wallet-link"
                  >
                    {tx.wallet.slice(0, 6)}...{tx.wallet.slice(-4)}
                  </a>{' '}
                  {tx.type === 'buy' ? 'bought' : 'sold'} {formatNumber(tx.amount)} tokens
                </p>
                <span className="transaction-time">{new Date(tx.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="no-data">No recent activity for followed wallets.</p>
        )}
      </div>
      {tooltip && (
        <div className="tooltip" style={{ top: tooltip.y - 50, left: tooltip.x + 10 }}>
          {tooltip.text.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}