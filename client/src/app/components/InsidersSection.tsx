'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatNumber } from '../../utils/helpers';
import { Wallet, MonitoredTransaction } from '../../utils/types';

interface InsidersSectionProps {
  results: {
    earlyBuyers?: Wallet[];
    holders?: Wallet[];
    activeTraders?: Wallet[];
    largeSellers?: Wallet[];
  };
  activeTab: 'earlyBuyers' | 'holders' | 'activeTraders' | 'largeSellers';
  setActiveTab: (tab: 'earlyBuyers' | 'holders' | 'activeTraders' | 'largeSellers') => void;
  walletSearch: string;
  setWalletSearch: (search: string) => void;
  walletSort: 'score' | 'volume' | 'activity';
  setWalletSort: (sort: 'score' | 'volume' | 'activity') => void;
  followedWallets: string[];
  followWallet: (address: string) => Promise<void>;
  exportWallets: () => void;
  totalSupply: number;
  liveMode: boolean;
  setLiveMode: (mode: boolean) => void;
  monitoredTransactions: MonitoredTransaction[];
  contractAddress?: string;
  fetchTokenPrice: (contractAddress: string, timestamp: string) => Promise<number>;
}

// Badge konfigürasyonu
const badgeConfig = [
  { minScore: 90, title: 'Elite Insider', description: 'Yüksek insider aktivitesi ve karlılık gösteren seçkin yatırımcı.', color: '#FFD700' },
  { minScore: 70, title: 'Strategic Trader', description: 'Stratejik alım-satım yapan deneyimli yatırımcı.', color: '#4B0082' },
  { minScore: 50, title: 'Active Participant', description: 'Aktif olarak piyasada yer alan yatırımcı.', color: '#4682B4' },
  { minScore: 0, title: 'Emerging Investor', description: 'Piyasada yeni olan ve gelişmekte olan yatırımcı.', color: '#808080' },
];

// Badge başlığını ve stil bilgisini döndüren fonksiyon
const getBadgeTitleConfig = (score: number): { title: string; description: string; color: string } => {
  return badgeConfig.find((badge) => score >= badge.minScore) || badgeConfig[badgeConfig.length - 1];
};

// İlk 100 Satın Alma Paneli
const First100Buyers = ({
  wallets,
  totalSupply,
  contractAddress,
  fetchTokenPrice,
}: {
  wallets: Wallet[];
  totalSupply: number;
  contractAddress?: string;
  fetchTokenPrice: (contractAddress: string, timestamp: string) => Promise<number>;
}) => {
  const [sortBy, setSortBy] = useState<'totalBought' | 'totalSold' | 'buyRank'>('totalBought');
  const [prices, setPrices] = useState<{ [walletAddress: string]: number }>({}); // Fiyatları saklamak için

  // Birdeye API’den fiyatları toplu olarak çek
  useEffect(() => {
    const fetchPrices = async () => {
      if (!contractAddress) {
        setPrices({});
        return;
      }
      try {
        const pricePromises = wallets.map(async (wallet) => {
          const price = await fetchTokenPrice(contractAddress, wallet.lastTxTime);
          return { address: wallet.address, price };
        });
        const priceResults = await Promise.all(pricePromises);
        const priceMap = priceResults.reduce((acc, { address, price }) => {
          acc[address] = price;
          return acc;
        }, {} as { [address: string]: number });
        setPrices(priceMap);
      } catch (error) {
        console.error('Fiyatlar alınamadı:', error);
        setPrices({});
      }
    };
    fetchPrices();
  }, [wallets, contractAddress, fetchTokenPrice]);

  const first100Buyers = useMemo(() => {
    // Tüm satın alma işlemlerini topla
    const buyTxs = wallets
      .flatMap(wallet =>
        wallet.transactions
          .filter(tx => tx.type === 'buy')
          .map(tx => ({ ...tx, walletAddress: wallet.address }))
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, 100); // İlk 100 satın alma

    // Cüzdan bazlı toplam satın alma ve durum hesapla
    const buyerStats = wallets
      .map(wallet => {
        const walletBuys = buyTxs.filter(tx => tx.walletAddress === wallet.address);
        const totalBought = walletBuys.reduce((sum, tx) => sum + tx.amount, 0);
        const totalSold = wallet.transactions
          .filter(tx => tx.type === 'sell')
          .reduce((sum, tx) => sum + tx.amount, 0);
        const solValueSold = totalSold * (prices[wallet.address] || 0.0001); // Birdeye fiyatı veya varsayılan
        const isHolding = wallet.totalAmount > 0;
        const buyRank = totalBought > 0 ? buyTxs.findIndex(tx => tx.walletAddress === wallet.address) + 1 : -1;

        return {
          ...wallet,
          totalBought,
          totalSold,
          solValueSold,
          isHolding,
          buyRank,
        };
      })
      .filter(buyer => buyer.totalBought > 0) // Sadece alıcıları göster
      .sort((a, b) => {
        if (sortBy === 'totalBought') return b.totalBought - a.totalBought;
        if (sortBy === 'totalSold') return b.totalSold - a.totalSold;
        return a.buyRank - b.buyRank;
      });

    return buyerStats;
  }, [wallets, sortBy, prices]);

  return (
    <div className="first-100-buyers dystopian-panel">
      <h3>İlk 100 Satın Alma</h3>
      <div className="sort-controls">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'totalBought' | 'totalSold' | 'buyRank')}
          className="cyber-select dystopian-input"
        >
          <option value="totalBought">Alınan Miktara Göre</option>
          <option value="totalSold">Satılan Miktara Göre</option>
          <option value="buyRank">Satın Alma Sırasına Göre</option>
        </select>
      </div>
      {first100Buyers.length > 0 ? (
        <table className="insider-table">
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Cüzdan</th>
              <th>Alınan Miktar</th>
              <th>Durum</th>
              <th>Satış Bilgisi</th>
            </tr>
          </thead>
          <tbody>
            {first100Buyers.map((buyer, index) => (
              <tr key={buyer.address}>
                <td>#{index + 1}</td>
                <td>
                  <a
                    href={`https://solscan.io/account/${buyer.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wallet-link"
                  >
                    {buyer.address.slice(0, 6)}...{buyer.address.slice(-4)}
                  </a>
                </td>
                <td>{formatNumber(buyer.totalBought)} tokens</td>
                <td>
                  {buyer.isHolding ? (
                    <span className="badge still-holding">Still Holding</span>
                  ) : (
                    <span className="badge sold">Sold</span>
                  )}
                </td>
                <td>
                  {buyer.totalSold > 0
                    ? `${formatNumber(buyer.totalSold)} tokens (~${buyer.solValueSold.toFixed(2)} SOL)`
                    : 'Satış yok'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="no-data">İlk 100 satın alma verisi bulunamadı.</p>
      )}
    </div>
  );
};

export default function InsidersSection({
  results,
  activeTab,
  setActiveTab,
  walletSearch,
  setWalletSearch,
  walletSort,
  setWalletSort,
  followedWallets,
  followWallet,
  exportWallets,
  totalSupply,
  liveMode,
  setLiveMode,
  monitoredTransactions,
  contractAddress,
  fetchTokenPrice,
}: InsidersSectionProps) {
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [dynamicWallets, setDynamicWallets] = useState<Wallet[]>([]);
  const [highlightWallet, setHighlightWallet] = useState<string | null>(null);

  // Debug logları
  useEffect(() => {
    console.log('InsidersSection props:', {
      results: results[activeTab]?.length,
      activeTab,
      monitoredTransactions: monitoredTransactions?.length,
      dynamicWallets: dynamicWallets?.length,
      followedWallets: followedWallets?.length,
    });
  }, [results, activeTab, monitoredTransactions, dynamicWallets, followedWallets]);

  // Gerçek zamanlı işlemlerden cüzdanları güncelle
  useEffect(() => {
    if (!liveMode || !monitoredTransactions?.length) {
      console.log('Live mode off or no monitored transactions');
      return;
    }

    setDynamicWallets((prevWallets) => {
      const updatedWallets = [...prevWallets];
      monitoredTransactions.forEach((tx) => {
        const existingWalletIndex = updatedWallets.findIndex((w) => w.address === tx.wallet);
        const now = new Date().toISOString();
        const amount = tx.amount;
        const totalSupplyThreshold = totalSupply * 0.01;

        if (existingWalletIndex >= 0) {
          const wallet = updatedWallets[existingWalletIndex];
          wallet.transactions.push({
            signature: `temp_${Date.now()}`,
            amount,
            timestamp: tx.timestamp,
            type: tx.type,
            txTime: new Date(tx.timestamp).getTime(),
          });
          wallet.totalAmount += tx.type === 'buy' ? amount : -amount;
          wallet.totalVolume += amount;
          wallet.buyCount += tx.type === 'buy' ? 1 : 0;
          wallet.sellCount += tx.type === 'sell' ? 1 : 0;
          wallet.lastTxTime = now;
          wallet.avgTradeSize = wallet.totalVolume / (wallet.buyCount + wallet.sellCount);
          wallet.tradeFrequency = wallet.transactions.length / (wallet.holdingDuration / 24 || 1);

          if (tx.isLargeSell) {
            wallet.scoreDetails.largeSellImpact = Math.min((amount / totalSupplyThreshold) * 20, 30);
            wallet.walletLabel = wallet.walletLabel === 'Standard' ? 'Large Seller' : wallet.walletLabel;
          }

          wallet.score = Math.min(
            wallet.scoreDetails.earlyBuy +
              wallet.scoreDetails.profitability +
              wallet.scoreDetails.network +
              wallet.scoreDetails.time +
              wallet.scoreDetails.amount +
              wallet.scoreDetails.duration +
              wallet.scoreDetails.pumpDump +
              wallet.scoreDetails.largeSellImpact,
            100
          );

          setHighlightWallet(tx.wallet);
          setTimeout(() => setHighlightWallet(null), 3000);
        } else {
          const newWallet: Wallet = {
            address: tx.wallet,
            totalAmount: tx.type === 'buy' ? amount : -amount,
            score: tx.isLargeSell ? 30 : 10,
            scoreDetails: {
              earlyBuy: 0,
              profitability: 0,
              network: 0,
              time: 10,
              amount: Math.min(amount / 1000, 50),
              duration: 0,
              pumpDump: 0,
              largeSellImpact: tx.isLargeSell ? Math.min((amount / totalSupplyThreshold) * 20, 30) : 0,
            },
            firstTxTime: now,
            lastTxTime: now,
            holdingDuration: 0,
            buyCount: tx.type === 'buy' ? 1 : 0,
            sellCount: tx.type === 'sell' ? 1 : 0,
            totalVolume: amount,
            avgTradeSize: amount,
            tradeFrequency: 1,
            otherTokenActivity: 0,
            solBalance: 0,
            mostProfitableTrade: { amount: 0, timestamp: 'N/A' },
            profitableTradeRatio: 0,
            walletLabel: tx.isLargeSell ? 'Large Seller' : 'Standard',
            transactions: [
              {
                signature: `temp_${Date.now()}`,
                amount,
                timestamp: tx.timestamp,
                type: tx.type,
                txTime: new Date(tx.timestamp).getTime(),
              },
            ],
            isEarlyBuyer: false,
            isHolder: tx.type === 'buy',
            isActiveTrader: false,
            profitEstimates: [],
            isLongTermHolder: false,
            isWhale: false,
            networkConnections: [],
          };
          updatedWallets.push(newWallet);

          setHighlightWallet(tx.wallet);
          setTimeout(() => setHighlightWallet(null), 3000);
        }
      });

      console.log('Updated dynamicWallets:', updatedWallets.length);
      return updatedWallets;
    });
  }, [monitoredTransactions, liveMode, totalSupply]);

  // Filtrelenmiş cüzdanlar
  const filteredWallets = useMemo(() => {
    const staticWallets = results[activeTab] || [];
    const allWallets = [...staticWallets, ...dynamicWallets.filter((w) => {
      if (activeTab === 'earlyBuyers') return w.isEarlyBuyer;
      if (activeTab === 'holders') return w.isHolder || w.isLongTermHolder;
      if (activeTab === 'activeTraders') return w.isActiveTrader;
      if (activeTab === 'largeSellers') return w.scoreDetails.largeSellImpact > 0;
      return true;
    })];
    if (!Array.isArray(allWallets)) {
      console.warn(`Invalid wallets data for ${activeTab}:`, allWallets);
      return [];
    }

    let filtered = allWallets;
    if (walletSearch) {
      filtered = allWallets.filter((w) =>
        w.address.toLowerCase().includes(walletSearch.toLowerCase())
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      const aScore = a.score ?? 0;
      const bScore = b.score ?? 0;
      const aVolume = a.totalVolume ?? 0;
      const bVolume = b.totalVolume ?? 0;
      const aFrequency = a.tradeFrequency ?? 0;
      const bFrequency = b.tradeFrequency ?? 0;

      if (walletSort === 'score') return bScore - aScore;
      if (walletSort === 'volume') return bVolume - aVolume;
      return bFrequency - aFrequency;
    });

    console.log('Filtered wallets:', sorted.length, sorted.map(w => w.address));
    return sorted;
  }, [results, activeTab, walletSearch, walletSort, dynamicWallets]);

  return (
    <div className="cyber-widget insiders-widget full-width dystopian-panel">
      <h2 className="widget-title">Insider Wallets</h2>
      <p className="widget-subtitle">
        Explore top wallets with insider activity, categorized by their trading behavior.
      </p>
      <div className="insider-controls">
        <div className="tab-buttons">
          <button
            className={`tab-button dystopian-button ${activeTab === 'earlyBuyers' ? 'active' : ''}`}
            onClick={() => setActiveTab('earlyBuyers')}
          >
            Early Buyers
          </button>
          <button
            className={`tab-button dystopian-button ${activeTab === 'holders' ? 'active' : ''}`}
            onClick={() => setActiveTab('holders')}
          >
            Holders
          </button>
          <button
            className={`tab-button dystopian-button ${activeTab === 'activeTraders' ? 'active' : ''}`}
            onClick={() => setActiveTab('activeTraders')}
          >
            Active Traders
          </button>
          <button
            className={`tab-button dystopian-button ${activeTab === 'largeSellers' ? 'active' : ''}`}
            onClick={() => setActiveTab('largeSellers')}
          >
            Large Sellers
          </button>
        </div>
        <div className="insider-filters">
          <input
            type="text"
            value={walletSearch}
            onChange={(e) => setWalletSearch(e.target.value)}
            placeholder="Search wallet address"
            className="cyber-input dystopian-input insider-search"
          />
          <select
            value={walletSort}
            onChange={(e) =>
              setWalletSort(e.target.value as 'score' | 'volume' | 'activity')
            }
            className="cyber-select dystopian-input"
          >
            <option value="score">Sort by Score</option>
            <option value="volume">Sort by Volume</option>
            <option value="activity">Sort by Activity</option>
          </select>
          <button
            className={`cyber-button dystopian-button ${liveMode ? 'active' : ''}`}
            onClick={() => setLiveMode(!liveMode)}
          >
            {liveMode ? 'Disable Live Mode' : 'Enable Live Mode'}
          </button>
          <button className="cyber-button dystopian-button export-button" onClick={exportWallets}>
            Export Data
          </button>
        </div>
      </div>
      {results[activeTab] && (results[activeTab].length > 0 || dynamicWallets.length > 0) ? (
        filteredWallets.length > 0 ? (
          <div className="insider-table-container">
            <table className="insider-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Address</th>
                  <th>Insider Score</th>
                  <th>Tokens Held</th>
                  <th>Total Volume</th>
                  <th>Largest Sale (% Supply)</th>
                  <th>Role</th>
                  <th>Badge</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWallets.map((wallet, index) => {
                  const largestSale = wallet.transactions
                    .filter((tx) => tx.type === 'sell')
                    .reduce((max, tx) => Math.max(max, tx.amount), 0);
                  const largestSalePercent = totalSupply > 0 ? ((largestSale / totalSupply) * 100).toFixed(2) : '0.00';
                  return (
                    <tr
                      key={wallet.address}
                      className={`${expandedWallet === wallet.address ? 'expanded' : ''} ${
                        highlightWallet === wallet.address ? 'highlight' : ''
                      }`}
                      onClick={() => setExpandedWallet(expandedWallet === wallet.address ? null : wallet.address)}
                    >
                      <td>#{index + 1}</td>
                      <td>
                        <a
                          href={`https://solscan.io/account/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                        >
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </a>
                      </td>
                      <td>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${
                              (wallet.score ?? 0) < 40
                                ? 'bg-accent-purple'
                                : (wallet.score ?? 0) <= 70
                                ? 'bg-accent-gray'
                                : 'bg-accent-turquoise'
                            }`}
                            style={{ width: `${wallet.score ?? 0}%` }}
                          ></div>
                        </div>
                        {(wallet.score ?? 0).toFixed(0)}%
                      </td>
                      <td>{formatNumber(wallet.totalAmount ?? 0)}</td>
                      <td>{formatNumber(wallet.totalVolume ?? 0)} tokens</td>
                      <td>{largestSalePercent}%</td>
                      <td>
                        <span className={`badge ${wallet.walletLabel.toLowerCase().replace(' ', '-')}`}>
                          {wallet.walletLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge professional-badge"
                          style={{ backgroundColor: getBadgeTitleConfig(wallet.score ?? 0).color }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const tooltip = document.createElement('div');
                            tooltip.className = 'tooltip';
                            tooltip.innerText = getBadgeTitleConfig(wallet.score ?? 0).description;
                            document.body.appendChild(tooltip);
                            tooltip.style.position = 'absolute';
                            tooltip.style.left = `${rect.left + window.scrollX}px`;
                            tooltip.style.top = `${rect.top + window.scrollY - 40}px`;
                            e.currentTarget.dataset.tooltip = 'active';
                          }}
                          onMouseLeave={(e) => {
                            const tooltip = document.querySelector('.tooltip');
                            if (tooltip) tooltip.remove();
                            e.currentTarget.dataset.tooltip = '';
                          }}
                        >
                          {getBadgeTitleConfig(wallet.score ?? 0).title}
                        </span>
                      </td>
                      <td>
                        <div className="insider-actions">
                          <button
                            className={`cyber-button dystopian-button small-button ${
                              followedWallets.includes(wallet.address) ? 'unfollow' : 'follow'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              followWallet(wallet.address);
                            }}
                          >
                            {followedWallets.includes(wallet.address) ? 'Unfollow' : 'Follow'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* İlk 100 Satın Alma Paneli */}
            {activeTab === 'earlyBuyers' && (
              <First100Buyers
                wallets={filteredWallets}
                totalSupply={totalSupply}
                contractAddress={contractAddress}
                fetchTokenPrice={fetchTokenPrice}
              />
            )}
            {filteredWallets.map((wallet) =>
              expandedWallet === wallet.address ? (
                <div key={`${wallet.address}-details`} className="insider-details dystopian-panel">
                  <h3 className="details-title">Detailed Wallet Analysis</h3>
                  <div className="details-grid">
                    <div className="detail-item tooltip">
                      <span>SOL Balance:</span> {(wallet.solBalance ?? 0).toFixed(4)} SOL
                      <span className="tooltip-text">Current SOL balance in the wallet.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Holding Time:</span> {(wallet.holdingDuration ?? 0).toFixed(1)} hours
                      <span className="tooltip-text">Duration the wallet has held tokens.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Buys:</span> {wallet.buyCount ?? 0}
                      <span className="tooltip-text">Number of buy transactions.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Sells:</span> {wallet.sellCount ?? 0}
                      <span className="tooltip-text">Number of sell transactions.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Avg Trade Size:</span> {formatNumber(wallet.avgTradeSize ?? 0)} tokens
                      <span className="tooltip-text">Average size of trades made by this wallet.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Trade Frequency:</span> {(wallet.tradeFrequency ?? 0).toFixed(2)} trades/day
                      <span className="tooltip-text">Average number of trades per day.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Other Token Activity:</span> {wallet.otherTokenActivity ?? 0} tokens
                      <span className="tooltip-text">Number of other tokens this wallet interacts with.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Most Profitable Trade:</span> {formatNumber(wallet.mostProfitableTrade?.amount ?? 0)} SOL
                      <span className="tooltip-text">Highest profit from a single trade.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Profitable Trade Ratio:</span> {((wallet.profitableTradeRatio ?? 0) * 100).toFixed(1)}%
                      <span className="tooltip-text">Percentage of trades that were profitable.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>First Transaction:</span>{' '}
                      {wallet.firstTxTime ? new Date(wallet.firstTxTime).toLocaleString() : 'N/A'}
                      <span className="tooltip-text">Date and time of the wallet's first transaction.</span>
                    </div>
                    <div className="detail-item tooltip">
                      <span>Last Transaction:</span>{' '}
                      {wallet.lastTxTime ? new Date(wallet.lastTxTime).toLocaleString() : 'N/A'}
                      <span className="tooltip-text">Date and time of the wallet's most recent transaction.</span>
                    </div>
                  </div>
                  <div className="score-details">
                    <h4>Score Breakdown</h4>
                    <div className="score-grid">
                      <div className="score-item tooltip">
                        <span>Early Buy:</span> {(wallet.scoreDetails?.earlyBuy ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on early purchase timing.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Profitability:</span> {(wallet.scoreDetails?.profitability ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on profitable trades.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Network:</span> {(wallet.scoreDetails?.network ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on wallet connections.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Time:</span> {(wallet.scoreDetails?.time ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on activity duration.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Amount:</span> {(wallet.scoreDetails?.amount ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on token holdings.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Duration:</span> {(wallet.scoreDetails?.duration ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on holding duration.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Pump & Dump:</span> {(wallet.scoreDetails?.pumpDump ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on rapid buy-sell patterns.</span>
                      </div>
                      <div className="score-item tooltip">
                        <span>Large Sell Impact:</span> {(wallet.scoreDetails?.largeSellImpact ?? 0).toFixed(0)}%
                        <span className="tooltip-text">Score based on large sell transactions.</span>
                      </div>
                    </div>
                  </div>
                  <div className="transaction-table">
                    <h4>Recent Transactions</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Timestamp</th>
                          <th>Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(wallet.transactions || []).slice(0, 5).map((tx, idx) => (
                          <tr key={idx}>
                            <td>{tx.type}</td>
                            <td>{formatNumber(tx.amount ?? 0)} tokens</td>
                            <td>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A'}</td>
                            <td>
                              <a
                                href={`https://solscan.io/tx/${tx.signature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="wallet-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {tx.signature.slice(0, 6)}...{tx.signature.slice(-4)}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <p className="no-data">
            No wallets found for the current search or sort criteria. Try adjusting your filters.
          </p>
        )
      ) : (
        <p className="no-data">
          No insider wallets available for this token. Try searching for another token address.
        </p>
      )}
    </div>
  );
}