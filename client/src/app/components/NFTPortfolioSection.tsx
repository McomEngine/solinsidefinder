// client/src/app/components/NFTPortfolioSection.tsx
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatNumber } from '../../utils/helpers';
import { fetchNFTs } from '../../utils/api';
import { NFT } from '../../utils/types';
import './NFTPortfolioSection.css';

const NFTPortfolioSection: React.FC = () => {
  const { publicKey } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNFTs = async () => {
      if (!publicKey) {
        setError('Please connect your wallet to view NFTs.');
        return;
      }

      setLoading(true);
      try {
        const walletAddress = publicKey.toBase58();
        const response = await fetchNFTs(walletAddress);
        setNfts(response);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load NFTs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadNFTs();
  }, [publicKey]);

  if (error) return <p className="error-text">{error}</p>;
  if (loading) return <p className="no-data">Loading NFTs...</p>;

  return (
    <div className="cyber-widget dystopian-panel nft-portfolio">
      <h2 className="widget-title">NFT Portfolio</h2>
      {nfts.length === 0 ? (
        <p className="no-data">No NFTs found in your wallet.</p>
      ) : (
        <div className="nft-table-container">
          <table className="insider-table">
            <thead>
              <tr>
                <th>NFT</th>
                <th>Floor Price (SOL)</th>
                <th>Purchase Price (SOL)</th>
                <th>Purchase Date</th>
                <th>Profit/Loss (SOL)</th>
              </tr>
            </thead>
            <tbody>
              {nfts.map((nft) => (
                <tr key={nft.mint}>
                  <td className="nft-info">
                    <img src={nft.image} alt={nft.name} className="nft-image" onError={(e) => (e.currentTarget.src = '/placeholder.png')} />
                    {nft.name}
                  </td>
                  <td>{formatNumber(nft.floorPrice)}</td>
                  <td>{formatNumber(nft.purchasePrice)}</td>
                  <td>{new Date(nft.purchaseDate).toLocaleDateString()}</td>
                  <td
                    className={
                      nft.floorPrice - nft.purchasePrice >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {formatNumber(nft.floorPrice - nft.purchasePrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NFTPortfolioSection;