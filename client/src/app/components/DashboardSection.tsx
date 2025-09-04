import { RefObject, useState, useEffect, useMemo } from 'react';
import WalletActivityWidget from './WalletActivityWidget';
import TokenHealthWidget from './TokenHealthWidget';
import FollowedWalletsWidget from './FollowedWalletsWidget';
import PriceSimulationWidget from './PriceSimulationWidget';
import NFTPortfolioSection from './NFTPortfolioSection';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, Legend } from 'chart.js';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { createJupiterApiClient } from '@jup-ag/api';

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend);

// Solana bağlantısı
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Jupiter API istemcisi
const jupiterQuoteApi = createJupiterApiClient();

interface DashboardSectionProps {
  connected: boolean;
  contractAddress: string;
  dexScreenerUrl: string;
  favoriteTokens: string[];
  followedWallets: string[];
  handleCopyAddress: () => void;
  newTokenAddress: string;
  setNewTokenAddress: (address: string) => void;
  addFavoriteToken: () => void;
  removeFavoriteToken: (address: string) => void;
  dashboardRef: RefObject<HTMLDivElement>;
  rugCheckData: any;
  timelineData: any[];
  followWallet: (address: string) => Promise<void>;
  monitoredTransactions: any[];
  publicKey: string | null;
  activeWidget: 'activity' | 'followed' | 'favorites' | 'insiderSuggestions' | 'nftPortfolio';
  setActiveWidget: (
    value: 'activity' | 'followed' | 'favorites' | 'insiderSuggestions' | 'nftPortfolio'
  ) => void;
  healthScore?: number;
  insiderIntensity?: number;
  healthReasons?: string[];
  healthBarColor?: string;
  intensityBarColor?: string;
}

// TokenSummaryWidget
const TokenSummaryWidget = ({ contractAddress, rugCheckData }: { contractAddress: string; rugCheckData: any }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`cyber-widget dystopian-panel ${isCollapsed ? 'collapsed' : ''} constrained-panel`}>
      <div className="widget-header">
        <h2 className="widget-title">Token Summary</h2>
        <button
          className="collapse-button dystopian-button small-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="widget-content">
          {rugCheckData ? (
            <div className="summary-stats-grid">
              <div className="summary-card">
                <span className="summary-label">Token Address</span>
                <p className="summary-value">{contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Supply</span>
                <p className="summary-value">{rugCheckData.totalSupply ? rugCheckData.totalSupply.toLocaleString() : 'N/A'}</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Liquidity Locked</span>
                <p className="summary-value">{rugCheckData.liquidityLocked ? `${rugCheckData.liquidityLocked}%` : 'N/A'}</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Burned Percentage</span>
                <p className="summary-value">{rugCheckData.burnedPercentage ? `${rugCheckData.burnedPercentage}%` : 'N/A'}</p>
              </div>
            </div>
          ) : (
            <p className="no-data">No summary data available.</p>
          )}
        </div>
      )}
    </div>
  );
};

// TrendingIndicator
const TrendingIndicator = ({ timelineData }: { timelineData: any[] }) => {
  const priceChange = timelineData.length > 0
    ? ((timelineData[timelineData.length - 1].price - timelineData[0].price) / timelineData[0].price) * 100
    : 0;

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`cyber-widget dystopian-panel compact ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="widget-header">
        <h2 className="widget-title">Trending</h2>
        <button
          className="collapse-button dystopian-button small-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="widget-content">
          <div className="stat-item">
            <span>Price Change (24h)</span>
            <p className={priceChange >= 0 ? 'positive' : 'negative'}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// InsiderSuggestionsWidget
const InsiderSuggestionsWidget = ({
  contractAddress,
  followWallet,
}: {
  contractAddress: string;
  followWallet: (address: string) => Promise<void>;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const suggestedWallets = [
    { address: '5J9k...aBcD', score: 85 },
    { address: '3K2m...xYzW', score: 72 },
  ];

  return (
    <div className={`cyber-widget dystopian-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="widget-header">
        <h2 className="widget-title">Insider Suggestions</h2>
        <button
          className="collapse-button dystopian-button small-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="widget-content">
          {suggestedWallets.length > 0 ? (
            <div className="insider-table-container">
              <table className="insider-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Score</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestedWallets.map((wallet) => (
                    <tr key={wallet.address}>
                      <td>{wallet.address}</td>
                      <td>{wallet.score}%</td>
                      <td>
                        <button
                          className="small-button dystopian-button follow"
                          onClick={() => followWallet(wallet.address)}
                        >
                          Follow
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No suggestions available.</p>
          )}
        </div>
      )}
    </div>
  );
};

// FavoriteTokensWidget
const FavoriteTokensWidget = ({
  favoriteTokens,
  newTokenAddress,
  setNewTokenAddress,
  addFavoriteToken,
  removeFavoriteToken,
  connected,
}: {
  favoriteTokens: string[];
  newTokenAddress: string;
  setNewTokenAddress: (address: string) => void;
  addFavoriteToken: () => void;
  removeFavoriteToken: (address: string) => void;
  connected: boolean;
}) => {
  const [sortBy, setSortBy] = useState<'health' | 'intensity'>('health');
  const [healthFilter, setHealthFilter] = useState<number>(0);
  const [intensityFilter, setIntensityFilter] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const enrichedTokens = favoriteTokens.map((token) => {
    const tokenHealth = Math.floor(Math.random() * 100);
    const tokenIntensity = Math.floor(Math.random() * 100);
    return {
      address: token,
      health: tokenHealth,
      intensity: tokenIntensity,
      healthColor: tokenHealth < 40 ? 'bg-accent-purple' : tokenHealth <= 70 ? 'bg-accent-gray' : 'bg-accent-turquoise',
      intensityColor: tokenIntensity < 30 ? 'bg-accent-turquoise' : tokenIntensity <= 60 ? 'bg-accent-gray' : 'bg-accent-purple',
    };
  });

  const filteredTokens = enrichedTokens.filter(
    (token) => token.health >= healthFilter && token.intensity >= intensityFilter
  );

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    if (sortBy === 'health') {
      return b.health - a.health;
    } else {
      return b.intensity - a.intensity;
    }
  });

  return (
    <div className={`cyber-widget dystopian-panel ${isCollapsed ? 'collapsed' : ''} constrained-panel`}>
      <div className="widget-header">
        <h2 className="widget-title">Favorite Tokens</h2>
        <button
          className="collapse-button dystopian-button small-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="widget-content">
          <div className="search-container">
            <input
              type="text"
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value)}
              placeholder="Enter token address"
              className="cyber-input dystopian-input"
              disabled={!connected}
            />
            <button
              onClick={addFavoriteToken}
              className="cyber-button dystopian-button"
              disabled={!connected}
            >
              Add
            </button>
          </div>

          <div className="filter-controls">
            <div className="filter-group">
              <label className="filter-label">Sort By:</label>
              <select
                className="cyber-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'health' | 'intensity')}
              >
                <option value="health">Health</option>
                <option value="intensity">Intensity</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Min Health:</label>
              <input
                type="range"
                className="cyber-slider"
                value={healthFilter}
                onChange={(e) => setHealthFilter(Number(e.target.value))}
                min={0}
                max={100}
              />
              <span>{healthFilter}%</span>
            </div>
            <div className="filter-group">
              <label className="filter-label">Min Intensity:</label>
              <input
                type="range"
                className="cyber-slider"
                value={intensityFilter}
                onChange={(e) => setIntensityFilter(Number(e.target.value))}
                min={0}
                max={100}
              />
              <span>{intensityFilter}%</span>
            </div>
          </div>

          <div className="favorite-tokens-list">
            {sortedTokens.length > 0 ? (
              sortedTokens.map((token) => (
                <div key={token.address} className="favorite-token-card dystopian-panel">
                  <div className="token-info">
                    <p className="token-address">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </p>
                    <div className="token-stats">
                      <div className="stat-item">
                        <p>Health: {token.health}%</p>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${token.healthColor}`}
                            style={{ width: `${token.health}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="stat-item">
                        <p>Intensity: {token.intensity}%</p>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${token.intensityColor}`}
                            style={{ width: `${token.intensity}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="remove-token-button dystopian-button"
                    onClick={() => removeFavoriteToken(token.address)}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="no-data">No tokens match filters.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// InsiderSellSimulation
const InsiderSellSimulation = ({ rugCheckData }: { rugCheckData: any }) => {
  const [sellPercentage, setSellPercentage] = useState(10);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const calculatePriceImpact = (percentage: number) => {
    const totalSupply = rugCheckData?.totalSupply || 1;
    const sellAmount = (percentage / 100) * totalSupply;
    return (sellAmount / totalSupply) * (rugCheckData?.liquidityLocked ? 100 / rugCheckData.liquidityLocked : 1);
  };

  const chartData = {
    labels: [0, 5, 10, 15, 20],
    datasets: [
      {
        label: 'Price Impact (%)',
        data: [0, 5, 10, 15, 20].map((perc) => calculatePriceImpact(perc)),
        borderColor: 'var(--accent-turquoise)',
        backgroundColor: 'rgba(45, 212, 191, 0.2)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'var(--accent-purple)',
        pointBorderColor: 'var(--white)',
        pointHoverBackgroundColor: 'var(--accent-purple)',
        pointHoverBorderColor: 'var(--accent-turquoise)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: 'Sell %', color: 'var(--white)', font: { family: 'Space Grotesk' } },
        ticks: { color: 'var(--white)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        title: { display: true, text: 'Price Impact %', color: 'var(--white)', font: { family: 'Space Grotesk' } },
        ticks: { color: 'var(--white)' },
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
    plugins: {
      legend: { labels: { color: 'var(--white)', font: { family: 'Space Grotesk' } } },
      tooltip: {
        backgroundColor: 'var(--panel-bg)',
        titleColor: 'var(--white)',
        bodyColor: 'var(--white)',
        borderColor: 'var(--accent-turquoise)',
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`cyber-widget dystopian-panel ${isCollapsed ? 'collapsed' : ''} constrained-panel`}>
      <div className="widget-header">
        <h3 className="widget-subtitle">Sell Impact</h3>
        <button
          className="collapse-button dystopian-button small-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="widget-content">
          <div className="simulation-controls">
            <input
              type="range"
              value={sellPercentage}
              onChange={(e) => setSellPercentage(Number(e.target.value))}
              className="cyber-slider"
              min={0}
              max={100}
            />
            <p>
              Drop for {sellPercentage}% sell: {calculatePriceImpact(sellPercentage).toFixed(2)}%
            </p>
          </div>
          <div className="chart-container constrained-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
};

// SwapWidget
const SwapWidget = ({
  connected,
  newTokenAddress,
  setNewTokenAddress,
}: {
  connected: boolean;
  newTokenAddress: string;
  setNewTokenAddress: (address: string) => void;
}) => {
  const { publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any | null>(null);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!newTokenAddress) return;
      try {
        const response = await fetch('https://tokens.jup.ag/tokens?addresses=' + newTokenAddress);
        const tokens = await response.json();
        if (tokens.length > 0) {
          setTokenSymbol(tokens[0].symbol || 'Unknown');
        } else {
          setTokenSymbol('Unknown');
        }
      } catch (err) {
        setTokenSymbol('Unknown');
        setError('Invalid token address');
      }
    };
    fetchTokenInfo();
  }, [newTokenAddress]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!newTokenAddress || !amount || Number(amount) <= 0) return;
      setIsLoading(true);
      setError(null);
      try {
        const quoteResponse = await jupiterQuoteApi.quoteGet({
          inputMint: newTokenAddress,
          outputMint: 'So11111111111111111111111111111111111111112',
          amount: Number(amount) * 1e6,
          slippageBps: 50,
        });
        if (quoteResponse) {
          setQuote(quoteResponse);
        } else {
          setError('No swap route found');
        }
      } catch (err) {
        setError('Failed to fetch swap quote: ' + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuote();
  }, [newTokenAddress, amount]);

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet');
      return;
    }
    if (!newTokenAddress || !amount || Number(amount) <= 0) {
      setError('Please enter a valid token address and amount');
      return;
    }
    if (!quote) {
      setError('No swap quote available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const swapResponse = await jupiterQuoteApi.swapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
        },
      });
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.message.recentBlockhash = blockhash;

      const signedTx = await signTransaction(transaction);
      const txId = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });
      await connection.confirmTransaction({ signature: txId, blockhash, lastValidBlockHeight }, 'confirmed');

      alert(`Swap successful! Transaction ID: ${txId}`);
      setAmount('');
      setNewTokenAddress('');
    } catch (err) {
      setError('Swap failed: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cyber-widget dystopian-panel swap-widget">
      <div className="widget-header">
        <h2 className="widget-title">Swap Tokens (Solana)</h2>
        <WalletMultiButton />
      </div>
      <div className="widget-content">
        <div className="swap-form">
          <div className="swap-field">
            <label className="swap-label">From (Token)</label>
            <input
              type="text"
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value)}
              placeholder="Enter token address (e.g., USDC)"
              className="cyber-input dystopian-input"
              disabled={!connected}
            />
            {tokenSymbol && <p className="token-info">Token: {tokenSymbol}</p>}
          </div>
          <div className="swap-field">
            <label className="swap-label">To</label>
            <input
              type="text"
              value="SOL"
              disabled
              className="cyber-input dystopian-input"
            />
          </div>
          <div className="swap-field">
            <label className="swap-label">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="cyber-input dystopian-input"
              disabled={!connected}
            />
          </div>
          {quote && (
            <p className="quote-info">
              Estimated Output: {(quote.outAmount / 1e9).toFixed(6)} SOL
            </p>
          )}
          {error && <p className="error-message">{error}</p>}
          <button
            className="cyber-button dystopian-button swap-button"
            onClick={handleSwap}
            disabled={!connected || isLoading || !quote}
          >
            {isLoading ? 'Swapping...' : 'Swap'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ChartLowerTabs
const ChartLowerTabs = ({
  rugCheckData,
  contractAddress,
  timelineData,
  favoriteTokens,
  newTokenAddress,
  setNewTokenAddress,
  addFavoriteToken,
  removeFavoriteToken,
  connected,
  handleCopyAddress,
}: {
  rugCheckData: any;
  contractAddress: string;
  timelineData: any[];
  favoriteTokens: string[];
  newTokenAddress: string;
  setNewTokenAddress: (address: string) => void;
  addFavoriteToken: () => void;
  removeFavoriteToken: (address: string) => void;
  connected: boolean;
  handleCopyAddress: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'sell' | 'price' | 'favorites' | 'health' | 'summary'>('sell');

  return (
    <div className="cyber-widget dystopian-panel chart-lower-tabs constrained-panel">
      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          Sell Impact
        </button>
        <button
          className={`tab-button ${activeTab === 'price' ? 'active' : ''}`}
          onClick={() => setActiveTab('price')}
        >
          Price Simulation
        </button>
        <button
          className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          Favorite Tokens
        </button>
        <button
          className={`tab-button ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Token Health
        </button>
        <button
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Token Summary
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'sell' && <InsiderSellSimulation rugCheckData={rugCheckData} />}
        {activeTab === 'price' && (
          <PriceSimulationWidget
            contractAddress={contractAddress}
            rugCheckData={rugCheckData}
            timelineData={timelineData}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoriteTokensWidget
            favoriteTokens={favoriteTokens}
            newTokenAddress={newTokenAddress}
            setNewTokenAddress={setNewTokenAddress}
            addFavoriteToken={addFavoriteToken}
            removeFavoriteToken={removeFavoriteToken}
            connected={connected}
          />
        )}
        {activeTab === 'health' && (
          <TokenHealthWidget
            favoriteTokens={favoriteTokens}
            contractAddress={contractAddress}
            onCopyAddress={handleCopyAddress}
            className="cyber-widget token-health-widget"
          />
        )}
        {activeTab === 'summary' && (
          <TokenSummaryWidget contractAddress={contractAddress} rugCheckData={rugCheckData} />
        )}
      </div>
    </div>
  );
};

// Yeni Bileşen: WalletInsightsTabs
const WalletInsightsTabs = ({
  followedWallets,
  contractAddress,
  followWallet,
  monitoredTransactions,
  timelineData,
}: {
  followedWallets: string[];
  contractAddress: string;
  followWallet: (address: string) => Promise<void>;
  monitoredTransactions: any[];
  timelineData: any[];
}) => {
  const [activeTab, setActiveTab] = useState<
    'activity' | 'followed' | 'insiderSuggestions' | 'nftPortfolio' | 'trending'
  >('activity');

  return (
    <div className="cyber-widget dystopian-panel chart-lower-tabs constrained-panel">
      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Wallet Activity
        </button>
        <button
          className={`tab-button ${activeTab === 'followed' ? 'active' : ''}`}
          onClick={() => setActiveTab('followed')}
        >
          Followed Wallets
        </button>
        <button
          className={`tab-button ${activeTab === 'insiderSuggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('insiderSuggestions')}
        >
          Insider Suggestions
        </button>
        <button
          className={`tab-button ${activeTab === 'nftPortfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('nftPortfolio')}
        >
          NFT Portfolio
        </button>
        <button
          className={`tab-button ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          Trending
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'activity' && (
          <WalletActivityWidget followedWallets={followedWallets} contractAddress={contractAddress} />
        )}
        {activeTab === 'followed' && (
          <FollowedWalletsWidget
            followedWallets={followedWallets}
            followWallet={followWallet}
            contractAddress={contractAddress}
            monitoredTransactions={monitoredTransactions}
          />
        )}
        {activeTab === 'insiderSuggestions' && (
          <InsiderSuggestionsWidget contractAddress={contractAddress} followWallet={followWallet} />
        )}
        {activeTab === 'nftPortfolio' && <NFTPortfolioSection />}
        {activeTab === 'trending' && <TrendingIndicator timelineData={timelineData} />}
      </div>
    </div>
  );
};

// DashboardSection
export const DashboardSection = ({
  connected,
  contractAddress,
  dexScreenerUrl,
  favoriteTokens,
  followedWallets,
  handleCopyAddress,
  newTokenAddress,
  setNewTokenAddress,
  addFavoriteToken,
  removeFavoriteToken,
  dashboardRef,
  rugCheckData,
  timelineData,
  followWallet,
  monitoredTransactions,
  publicKey,
  activeWidget,
  setActiveWidget,
}: DashboardSectionProps) => {
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Wallet adapter için cüzdanlar
  const network = WalletAdapterNetwork.Mainnet;
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <div className="dashboard-container">
          <div className="content-grid top-grid">
            <div className="chart-column constrained-column">
              {dexScreenerUrl && (
                <div className={`cyber-widget dystopian-panel ${isChartExpanded ? 'expanded' : ''} constrained-panel`}>
                  <div className="chart-header">
                    <h2 className="widget-title">Price Chart</h2>
                    <button
                      className="dystopian-button small-button"
                      onClick={() => setIsChartExpanded(!isChartExpanded)}
                    >
                      {isChartExpanded ? 'Collapse' : 'Full Screen'}
                    </button>
                  </div>
                  <iframe
                    src={dexScreenerUrl}
                    className="dexscreener-frame constrained-frame"
                    loading="lazy"
                    title="Dexscreener Chart"
                  />
                </div>
              )}
              <ChartLowerTabs
                rugCheckData={rugCheckData}
                contractAddress={contractAddress}
                timelineData={timelineData}
                favoriteTokens={favoriteTokens}
                newTokenAddress={newTokenAddress}
                setNewTokenAddress={setNewTokenAddress}
                addFavoriteToken={addFavoriteToken}
                removeFavoriteToken={removeFavoriteToken}
                connected={connected}
                handleCopyAddress={handleCopyAddress}
              />
            </div>
            <div className="swap-column">
              <SwapWidget
                connected={connected}
                newTokenAddress={newTokenAddress}
                setNewTokenAddress={setNewTokenAddress}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading dashboard...</p>
            </div>
          ) : (
            <div ref={dashboardRef} className="main-content">
              {connected ? (
                <div className="content-grid main-grid">
                  <WalletInsightsTabs
                    followedWallets={followedWallets}
                    contractAddress={contractAddress}
                    followWallet={followWallet}
                    monitoredTransactions={monitoredTransactions}
                    timelineData={timelineData}
                  />
                </div>
              ) : (
                <div className="error-card dystopian-panel">
                  <p className="error-text">Please connect your wallet and provide a contract address.</p>
                  <WalletMultiButton />
                </div>
              )}
            </div>
          )}
        </div>
      </WalletModalProvider>
    </WalletProvider>
  );
};