interface Props {
    isOpen: boolean;
    onClose: () => void;
  }
  
  export const RugCheckGuideModal = ({ isOpen, onClose }: Props) => {
    if (!isOpen) return null;
  
    const handleOutsideClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };
  
    return (
      <div className="modal-overlay" onClick={handleOutsideClick}>
        <div className="modal-content dystopian-panel">
          <h3 className="modal-title">Understanding Rug Check Analysis</h3>
          <p>
            A Rug Check evaluates a token's smart contract and on-chain activity to identify potential rug pull risks—a scam
            where developers abandon a project after collecting funds. Below are the key metrics analyzed:
          </p>
          <ul>
            <li>
              <strong>Insider Activity:</strong> Monitors wallets with suspicious trading patterns, such as large or
              coordinated transactions.
            </li>
            <li>
              <strong>Mint Authority:</strong> Checks if developers can mint new tokens, which could dilute the token's
              value.
            </li>
            <li>
              <strong>Freeze Authority:</strong> Verifies if developers can freeze token transfers, potentially locking user
              funds.
            </li>
            <li>
              <strong>Burn Status:</strong> Assesses the percentage of tokens burned to reduce supply and enhance scarcity.
            </li>
            <li>
              <strong>Liquidity Lock:</strong> Ensures liquidity is locked to prevent sudden withdrawals by developers.
            </li>
            <li>
              <strong>Contract Security:</strong> Confirms if the contract is renounced (immutable) or upgradeable
              (modifiable).
            </li>
          </ul>
          <p>
            The Risk Score combines these metrics to provide an overall risk assessment, with lower scores indicating safer
            tokens. Always conduct your own research before investing.
          </p>
          <button className="modal-button dystopian-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  };