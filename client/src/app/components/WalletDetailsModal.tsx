import { formatNumber } from '../../utils/helpers';
import { WalletDetailsModalProps } from '../../utils/types';

export const WalletDetailsModal: React.FC<WalletDetailsModalProps> = ({
  onClose,
  walletData,
  chartData,
  getBadgeTitle,
  followWallet,
  isFollowing,
}) => {
  if (!walletData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content dystopian-panel">
        <h3 className="modal-title">Wallet Details</h3>
        <div className="modal-stats">
          <p>
            <span>Address:</span>{' '}
            <a
              href={`https://solscan.io/account/${walletData.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="wallet-link"
            >
              {walletData.address.slice(0, 6)}...{walletData.address.slice(-4)}
            </a>
          </p>
          <p>
            <span>Token Balance:</span> {formatNumber(walletData.balance)} tokens
          </p>
          {walletData.insiderScore !== null && (
            <p>
              <span>Insider Score:</span> {walletData.insiderScore.toFixed(0)}%
            </p>
          )}
          <p>
            <span>Wallet Type:</span> {walletData.walletLabel} ({getBadgeTitle(walletData.insiderScore)})
          </p>
          {walletData.totalVolume > 0 && (
            <p>
              <span>Total Volume:</span> {formatNumber(walletData.totalVolume)} tokens
            </p>
          )}
          <p>
            <span>Buys:</span> {walletData.buyCount}
          </p>
          <p>
            <span>Sells:</span> {walletData.sellCount}
          </p>
          <p>
            <span>Last Transaction:</span> {walletData.lastTx}
          </p>
          {walletData.networkConnections.length > 0 && (
            <div>
              <h4>Connected Wallets</h4>
              <table className="insider-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Shared Transactions</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {walletData.networkConnections.slice(0, 5).map((conn) => (
                    <tr key={conn.address}>
                      <td>
                        <a
                          href={`https://solscan.io/account/${conn.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                        >
                          {conn.address.slice(0, 6)}...{conn.address.slice(-4)}
                        </a>
                      </td>
                      <td>{conn.sharedTxCount}</td>
                      <td>{conn.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {chartData.length > 0 && (
            <div>
              <h4>Wallet Stats</h4>
              <ul>
                {chartData.map((item) => (
                  <li key={item.title}>
                    {item.title}: {item.value} ({item.color})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button
            className={`modal-button dystopian-button ${isFollowing ? 'unfollow' : 'follow'}`}
            onClick={() => followWallet(walletData.address)}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
          <button className="modal-button dystopian-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletDetailsModal;