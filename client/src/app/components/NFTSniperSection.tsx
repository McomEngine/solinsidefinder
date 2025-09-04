import { useState, useEffect } from 'react';
import './NFTSniperSection.css';

interface NFTListing {
  mint: string;
  name: string;
  price: number;
  collection: string;
  rarity: string;
  timestamp: string;
}

const NFTSniperSection: React.FC = () => {
  const [listings, setListings] = useState<NFTListing[]>([]);
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: Infinity,
    collection: '',
    minRarity: 0,
  });

  useEffect(() => {
    // Helius WebSocket ile yeni listelenmeleri dinle
    const ws = new WebSocket(
      `wss://ws.helius.xyz/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
    );

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: { event: 'nft_listings' },
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.listing) {
        const listing: NFTListing = {
          mint: data.listing.mint,
          name: data.listing.name || 'Unknown NFT',
          price: data.listing.price / 1e9 || 0, // SOL cinsine çevir
          collection: data.listing.collection || 'Unknown',
          rarity: data.listing.rarity || 'N/A',
          timestamp: new Date().toISOString(),
        };

        // Filtreleme
        if (
          listing.price >= filters.minPrice &&
          listing.price <= filters.maxPrice &&
          (!filters.collection || listing.collection.toLowerCase().includes(filters.collection.toLowerCase())) &&
          (!filters.minRarity || parseFloat(listing.rarity) >= filters.minRarity)
        ) {
          setListings((prev) => [listing, ...prev].slice(0, 50));
          if (Notification.permission === 'granted') {
            new Notification(`New NFT Listed: ${listing.name} at ${listing.price} SOL`);
          }
        }
      }
    };

    ws.onclose = () => console.log('WebSocket closed');

    return () => ws.close();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: name === 'collection' ? value : parseFloat(value) || 0,
    }));
  };

  return (
    <div className="cyber-widget dystopian-panel nft-sniper">
      <h2 className="widget-title">NFT Sniper</h2>
      <div className="filters">
        <input
          type="number"
          name="minPrice"
          placeholder="Min Price (SOL)"
          onChange={handleFilterChange}
          className="cyber-input dystopian-input"
        />
        <input
          type="number"
          name="maxPrice"
          placeholder="Max Price (SOL)"
          onChange={handleFilterChange}
          className="cyber-input dystopian-input"
        />
        <input
          type="text"
          name="collection"
          placeholder="Collection Name"
          onChange={handleFilterChange}
          className="cyber-input dystopian-input"
        />
        <input
          type="number"
          name="minRarity"
          placeholder="Min Rarity Score"
          onChange={handleFilterChange}
          className="cyber-input dystopian-input"
        />
      </div>
      <div className="listings">
        {listings.length === 0 ? (
          <p className="no-data">No new NFT listings found.</p>
        ) : (
          listings.map((listing) => (
            <div key={listing.mint} className="listing-item dystopian-panel">
              <p>{listing.name} - {listing.price} SOL</p>
              <p>Collection: {listing.collection}</p>
              <p>Rarity: {listing.rarity}</p>
              <p>Listed: {new Date(listing.timestamp).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NFTSniperSection;