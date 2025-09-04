'use client';

import { useState, useEffect } from 'react';

interface NFT {
  name: string;
  floorPrice: number; // SOL cinsinden
  volume24h: string; // SOL cinsinden
  marketCap: string; // USD cinsinden
  image: string;
}

const TrendingNFTsSection = () => {
  const [trendingNFTs, setTrendingNFTs] = useState<NFT[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingNFTs = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          'https://api-mainnet.magiceden.dev/v2/collections?offset=0&limit=5&sort=volume24h&direction=desc'
        );
        console.log('Magic Eden Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Magic Eden Error Response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        console.log('Magic Eden API Response:', data);

        // Veriyi uygun formata dönüştür
        const formattedNFTs: NFT[] = data.map((collection: any) => ({
          name: collection.name || 'Unknown',
          floorPrice: collection.floorPrice ? collection.floorPrice / 1_000_000_000 : 0, // Lamports -> SOL
          volume24h: collection.volume24h
            ? (collection.volume24h / 1_000_000_000).toLocaleString() // Lamports -> SOL
            : '0',
          marketCap: collection.marketCap
            ? `${(collection.marketCap / 1_000_000).toLocaleString()}M` // USD -> Milyon USD
            : '0M',
          image: collection.image || 'https://via.placeholder.com/50',
        }));

        setTrendingNFTs(formattedNFTs);
      } catch (error: any) {
        console.error('Error fetching trending NFTs:', error.message);
        setErrorMessage('Unable to fetch trending NFTs. Please try again later.');
        setTrendingNFTs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingNFTs();
  }, []);

  return (
    <div className="cyber-widget dystopian-panel">
      <h2 className="widget-title">Trending Solana NFTs</h2>
      {loading ? (
        <p className="loading-text">Loading trending NFTs...</p>
      ) : errorMessage ? (
        <p className="error-text">{errorMessage}</p>
      ) : trendingNFTs.length > 0 ? (
        <div className="nft-table-container">
          <table className="insider-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Floor Price (SOL)</th>
                <th>24h Volume</th>
                <th>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {trendingNFTs.map((nft) => (
                <tr key={nft.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <img
                        src={nft.image}
                        alt={nft.name}
                        style={{ width: '30px', height: '30px', borderRadius: '4px' }}
                      />
                      {nft.name}
                    </div>
                  </td>
                  <td>{nft.floorPrice.toFixed(2)} SOL</td>
                  <td>{nft.volume24h} SOL</td>
                  <td>${nft.marketCap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-data">No trending NFTs available.</p>
      )}
    </div>
  );
};

export default TrendingNFTsSection;