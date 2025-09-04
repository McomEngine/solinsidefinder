import { useState } from 'react';
import { RugCheckGuideModal } from './RugCheckGuideModal';
import { formatNumber } from '../../utils/helpers';
import { Wallet, PieChartData } from '../../utils/types';

interface RugCheckSectionProps {
  loading: boolean;
  rugCheckData: any;
  contractAddress: string;
  results: {
    earlyBuyers?: Wallet[];
    holders?: Wallet[];
    activeTraders?: Wallet[];
    largeSellers?: Wallet[];
  };
  riskDistributionData: PieChartData[];
  handleCopyAddress: () => void;
  copyTooltip: string | null;
  showGuideModal: boolean;
  setShowGuideModal: (value: boolean) => void;
  exportRugCheck: () => void;
  followWallet: (address: string) => Promise<void>;
  followedWallets: string[];
}

export const RugCheckSection = ({
  loading,
  rugCheckData,
  contractAddress,
  results,
  riskDistributionData,
  handleCopyAddress,
  copyTooltip,
  showGuideModal,
  setShowGuideModal,
  exportRugCheck,
  followWallet,
  followedWallets,
}: RugCheckSectionProps) => {
  const [sortBy, setSortBy] = useState<'tokens' | 'score'>('tokens');
  const [modalContent, setModalContent] = useState<string | null>(null);

  const sortedWallets = [
    ...new Map(
      (results.earlyBuyers ?? [])
        .concat(results.activeTraders ?? [], results.largeSellers ?? [])
        .map((wallet) => [wallet.address, wallet])
    ).values(),
  ]
    .sort((a, b) => {
      if (sortBy === 'tokens') {
        return b.totalAmount - a.totalAmount;
      }
      return (b.score ?? 0) - (a.score ?? 0);
    })
    .slice(0, 5);

  const getRiskIcon = (riskScore: number) => {
    if (riskScore < 40) return '✅';
    if (riskScore <= 70) return '⚠️';
    return '🚨';
  };

  const getRiskGradient = (riskScore: number) => {
    if (riskScore < 40) return 'url(#greenToBlue)';
    if (riskScore <= 70) return 'url(#blueToYellow)';
    return 'url(#purpleToRed)';
  };

  return (
    <div className="cyber-widget rug-check-widget full-width">
      <div className="rug-check-header">
        <h2 className="widget-title neon-pulse">RUG Check Scanner</h2>
        <button
          className="cyber-button dystopian-button guide-button"
          onClick={() => setShowGuideModal(true)}
        >
          Learn About Rug Checks
        </button>
      </div>
      <p className="rug-check-subtitle">
        Analyze the token's smart contract and on-chain activity to assess rug pull risks.
      </p>
      {loading ? (
        <div className="loading-container">
          <div className="neon-spinner"></div>
          <p>Scanning token...</p>
        </div>
      ) : rugCheckData ? (
        <div className="rug-check-container">
          <div className="rug-check-summary dystopian-panel">
            <h3 className="summary-title neon-pulse">Risk Assessment Summary</h3>
            <p>
              Risk Score:{' '}
              <span
                className={`risk-badge ${
                  rugCheckData.riskScore < 40
                    ? 'safe'
                    : rugCheckData.riskScore <= 70
                      ? 'warning'
                      : 'danger'
                }`}
              >
                {getRiskIcon(rugCheckData.riskScore)} {rugCheckData.riskScore}% (
                {rugCheckData.riskScore < 40
                  ? 'Low Risk'
                  : rugCheckData.riskScore <= 70
                    ? 'Moderate Risk'
                    : 'High Risk'}
                )
              </span>
            </p>
            <p>
              Key Concerns:{' '}
              {rugCheckData.reasons.length > 0 ? rugCheckData.reasons.join(', ') : 'None identified'}
            </p>
            <p>
              Contract Address:{' '}
              <a
                href={`https://solscan.io/token/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-link"
              >
                {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
              </a>
              <button
                className="copy-button dystopian-button glitch-hover"
                onClick={handleCopyAddress}
                title="Copy contract address"
                aria-label="Copy contract address"
              >
                📋
              </button>
              {copyTooltip && <span className="copy-tooltip fade-in">{copyTooltip}</span>}
            </p>
          </div>

          <div className="risk-score">
            <div
              className={`risk-indicator ${
                rugCheckData.riskScore < 40
                  ? 'safe'
                  : rugCheckData.riskScore <= 70
                    ? 'warning'
                    : 'danger'
              }`}
            >
              <div className="circular-progress">
                <svg viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="greenToBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#00FF00', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#00FFFF', stopOpacity: 1 }} />
                    </linearGradient>
                    <linearGradient id="blueToYellow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#00FFFF', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#FFFF00', stopOpacity: 1 }} />
                    </linearGradient>
                    <linearGradient id="purpleToRed" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#FF00FF', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#FF0000', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  <circle
                    className="progress-bg"
                    cx="50"
                    cy="50"
                    r="45"
                    strokeWidth="10"
                  />
                  <circle
                    className="progress-fill"
                    cx="50"
                    cy="50"
                    r="45"
                    strokeWidth="10"
                    strokeDasharray="282.6"
                    strokeDashoffset={282.6 * (1 - rugCheckData.riskScore / 100)}
                    stroke={getRiskGradient(rugCheckData.riskScore)}
                  />
                  <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dy=".3em"
                    className="progress-text"
                  >
                    {rugCheckData.riskScore}%
                  </text>
                </svg>
              </div>
              <p>Risk Score</p>
              <p className="risk-description typewriter">
                {rugCheckData.riskScore < 40
                  ? 'Low risk: The token appears safe based on current metrics.'
                  : rugCheckData.riskScore <= 70
                    ? 'Moderate risk: Exercise caution, some concerns detected.'
                    : 'High risk: Significant issues detected, proceed with extreme caution.'}
              </p>
            </div>
            <div className="risk-distribution">
              <h3 className="neon-pulse">Risk Distribution</h3>
              <div className="risk-cards">
                {riskDistributionData.map((data, index) => (
                  <div key={index} className="risk-card dystopian-panel">
                    <div className="risk-card-header">
                      <span className="risk-icon">
                        {data.title === 'Insider Activity' && '👛'}
                        {data.title === 'Mint Authority' && '🔒'}
                        {data.title === 'Freeze Authority' && '❄️'}
                        {data.title === 'Burn Status' && '🔥'}
                        {data.title === 'Liquidity' && '💧'}
                        {data.title === 'Contract Security' && '🛡️'}
                      </span>
                      <h4>{data.title}</h4>
                    </div>
                    <div className="risk-bar">
                      <div
                        className="risk-fill"
                        style={{ width: `${data.value}%`, background: data.color }}
                      ></div>
                    </div>
                    <p>{data.value}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rug-check-list">
            {[
              {
                title: 'Insider Activity',
                description: 'Number of wallets with suspicious trading patterns and their share of the token supply.',
                content: (
                  <>
                    <p className={rugCheckData.insiderCount > 10 ? 'warning' : 'safe'}>
                      {rugCheckData.insiderCount} insider wallets detected
                    </p>
                    <p
                      className={
                        rugCheckData.insiderHoldings / rugCheckData.totalSupply > 0.5 ? 'danger' : 'safe'
                      }
                    >
                      Insiders hold{' '}
                      {(rugCheckData.insiderHoldings / rugCheckData.totalSupply * 100).toFixed(2)}% of
                      supply
                    </p>
                    {rugCheckData.insiderCount > 10 && (
                      <p className="reason">High insider activity may indicate coordinated trading.</p>
                    )}
                  </>
                ),
              },
              {
                title: 'Mint Authority',
                description: 'If active, developers can create new tokens, potentially diluting value.',
                content: (
                  <>
                    <p className={rugCheckData.mintAuthority ? 'danger' : 'safe'}>
                      Mint Authority: {rugCheckData.mintAuthority ? 'Active' : 'Disabled'}
                    </p>
                    {rugCheckData.mintAuthority && (
                      <p className="reason">Active mint authority increases rug pull risk.</p>
                    )}
                  </>
                ),
              },
              {
                title: 'Freeze Authority',
                description: 'If active, developers can freeze token transfers, locking user funds.',
                content: (
                  <>
                    <p className={rugCheckData.freezeAuthority ? 'danger' : 'safe'}>
                      Freeze Authority: {rugCheckData.freezeAuthority ? 'Active' : 'Disabled'}
                    </p>
                    {rugCheckData.freezeAuthority && (
                      <p className="reason">Active freeze authority can block transfers.</p>
                    )}
                  </>
                ),
              },
              {
                title: 'Burn Status',
                description: 'Percentage of tokens burned to reduce supply and increase scarcity.',
                content: (
                  <>
                    <p className={rugCheckData.burnedPercentage < 10 ? 'warning' : 'safe'}>
                      {rugCheckData.burnedPercentage}% of tokens burned
                    </p>
                    {rugCheckData.burnedPercentage < 10 && (
                      <p className="reason">Low burn percentage may indicate risk.</p>
                    )}
                  </>
                ),
              },
              {
                title: 'Liquidity',
                description: 'Percentage of liquidity locked and duration of the lock period.',
                content: (
                  <>
                    <p className={rugCheckData.liquidityLocked < 50 ? 'danger' : 'safe'}>
                      {rugCheckData.liquidityLocked}% of liquidity locked
                    </p>
                    <p className={rugCheckData.liquidityLockDuration === 'None' ? 'danger' : 'safe'}>
                      Lock Duration: {rugCheckData.liquidityLockDuration}
                    </p>
                    {rugCheckData.liquidityLocked < 50 && (
                      <p className="reason">Low liquidity lock increases withdrawal risk.</p>
                    )}
                  </>
                ),
              },
              {
                title: 'Contract Security',
                description: 'Checks if the contract is renounced (no further changes) or upgradeable (potential risks).',
                content: (
                  <>
                    <p className={rugCheckData.contractRenounced ? 'safe' : 'warning'}>
                      Renounced: {rugCheckData.contractRenounced ? 'Yes' : 'No'}
                    </p>
                    <p className={rugCheckData.upgradeable ? 'danger' : 'safe'}>
                      Upgradeable: {rugCheckData.upgradeable ? 'Yes' : 'No'}
                    </p>
                    {rugCheckData.upgradeable && (
                      <p className="reason">Upgradeable contracts may pose modification risks.</p>
                    )}
                  </>
                ),
              },
            ].map((item, index) => (
              <div
                key={index}
                className="rug-check-item dystopian-panel"
                onClick={() => setModalContent(item.description)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && setModalContent(item.description)}
              >
                <h3 className="tooltip">
                  {item.title}
                  <span className="tooltip-text">{item.description}</span>
                </h3>
                {item.content}
              </div>
            ))}
            <div className="rug-check-item dystopian-panel">
              <h3>Top Insider Wallets</h3>
              <div className="sort-controls">
                <label className="sort-label">Sort By:</label>
                <select
                  className="cyber-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'tokens' | 'score')}
                >
                  <option value="tokens">Tokens</option>
                  <option value="score">Score</option>
                </select>
              </div>
              <table className="insider-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Tokens</th>
                    <th>Score</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWallets.map((wallet) => (
                    <tr key={wallet.address}>
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
                      <td>{formatNumber(wallet.totalAmount)}</td>
                      <td>{wallet.score ?? 0}%</td>
                      <td>
                        <button
                          className={`cyber-button dystopian-button small-button ${
                            followedWallets.includes(wallet.address) ? 'unfollow' : 'follow'
                          }`}
                          onClick={() => followWallet(wallet.address)}
                          aria-label={
                            followedWallets.includes(wallet.address)
                              ? `Unfollow wallet ${wallet.address}`
                              : `Follow wallet ${wallet.address}`
                          }
                        >
                          {followedWallets.includes(wallet.address) ? 'Unfollow' : 'Follow'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            className="cyber-button dystopian-button export-button data-download glitch-hover"
            onClick={exportRugCheck}
            aria-label="Download rug check report"
          >
            Download Report
          </button>
        </div>
      ) : (
        <div className="error-container">
          <p className="no-data">No rug check data available. Try searching a token.</p>
          <button className="cyber-button dystopian-button">Retry</button>
        </div>
      )}
      <RugCheckGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
      {modalContent && (
        <div className="modal-overlay" onClick={() => setModalContent(null)}>
          <div className="modal-content dystopian-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">More Information</h3>
            <p>{modalContent}</p>
            <button
              className="cyber-button dystopian-button"
              onClick={() => setModalContent(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};