// components/FollowedWalletsWidget.tsx
'use client';

import { useState } from 'react';
import WalletActivityPanel from './WalletActivityPanel';

interface FollowedWalletsWidgetProps {
  followedWallets: string[];
  followWallet: (address: string) => Promise<void>;
  contractAddress?: string;
  monitoredTransactions: any[]; // page.tsx'den gelen veri
}

export default function FollowedWalletsWidget({
  followedWallets,
  followWallet,
  contractAddress,
  monitoredTransactions,
}: FollowedWalletsWidgetProps) {
  const [copyTooltip, setCopyTooltip] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyTooltip(`Copied ${address.slice(0, 6)}...`);
      setTimeout(() => setCopyTooltip(null), 2000);
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      setCopyTooltip('Copy failed!');
      setTimeout(() => setCopyTooltip(null), 2000);
    }
  };

  return (
    <div className="cyber-widget dystopian-panel">
      <h2 className="widget-title">Followed Wallets</h2>
      {followedWallets.length > 0 ? (
        <div className="followed-wallets-list">
          {followedWallets.map((wallet) => (
            <div key={wallet} className="followed-wallet-card dystopian-panel">
              <div className="wallet-info">
                <p className="wallet-address">
                  <span
                    onClick={() => setSelectedWallet(wallet)}
                    style={{ cursor: 'pointer', color: '#00ff00' }}
                    title="Click to view activity"
                  >
                    {wallet.slice(0, 6)}...{wallet.slice(-4)}
                  </span>
                  <button
                    className="copy-button"
                    onClick={() => handleCopyAddress(wallet)}
                    title="Copy address"
                  >
                    📋
                  </button>
                  {copyTooltip && copyTooltip.includes(wallet.slice(0, 6)) && (
                    <span className="copy-tooltip">{copyTooltip}</span>
                  )}
                </p>
              </div>
              <button
                className="unfollow-button dystopian-button small-button"
                onClick={() => followWallet(wallet)}
              >
                Unfollow
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-data">No followed wallets yet.</p>
      )}
      <WalletActivityPanel
        walletAddress={selectedWallet}
        onClose={() => setSelectedWallet(null)}
        contractAddress={contractAddress}
        monitoredTransactions={monitoredTransactions}
      />
    </div>
  );
}