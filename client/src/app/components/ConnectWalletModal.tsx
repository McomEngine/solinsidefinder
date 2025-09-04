import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ConnectWalletModalProps } from '../../utils/types';

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  connected,
  isAllowed,
  allowlist,
}) => {
  return (
    <div className="modal-overlay">
      <div className="connect-wallet-modal dystopian-panel">
        <h3>Unlock Insider Insights</h3>
        {!connected ? (
          <p>
            Connect your wallet to access the dashboard and uncover hidden token secrets on Solana's blockchain.
            <br />
            <span style={{ fontStyle: 'italic', color: '#a3a3a3' }}>
              (Exclusive access for Sygorm subscribers only)
            </span>
          </p>
        ) : !isAllowed ? (
          <p>
            Your wallet is not in the allowlist. Please contact support to gain access.
            <br />
            <span style={{ fontStyle: 'italic', color: '#a3a3a3' }}>
              Allowlist wallets: {allowlist.length > 0 ? allowlist.slice(0, 3).join(', ') + (allowlist.length > 3 ? '...' : '') : 'None'}
            </span>
          </p>
        ) : (
          <p>
            Your wallet is connected and authorized! You can now access the dashboard.
          </p>
        )}
        {!connected && (
          <WalletMultiButton className="modal-button dystopian-button wallet-button--primary" />
        )}
      </div>
    </div>
  );
};

export default ConnectWalletModal;