'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getParsedNftAccountsByOwner } from '@nfteyez/sol-rayz';

interface NFT {
  mint: string;
  uri: string;
  name: string;
  image?: string;
}

interface ProfileData {
  username: string;
  bio: string;
  selectedNFT: string | null;
}

export const ProfileSection: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [profileData, setProfileData] = useState<ProfileData>({
    username: '',
    bio: '',
    selectedNFT: null,
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Varsayılan profil resmi (örneğin, public klasöründe bir dosya veya harici URL)
  const defaultPfp = '/default-pfp.png'; // Varsayılan PFP URL'si veya dosya yolu

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // NFT'leri yükleme
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!connected || !publicKey) return;
      setLoading(true);
      try {
        const nftAccounts = await getParsedNftAccountsByOwner({
          publicAddress: publicKey.toBase58(),
          connection,
        });
        const fetchedNFTs: NFT[] = await Promise.all(
          nftAccounts.map(async (nft: any) => {
            const response = await fetch(nft.data.uri);
            const metadata = await response.json();
            return {
              mint: nft.mint,
              uri: nft.data.uri,
              name: nft.data.name,
              image: metadata.image,
            };
          })
        );
        setNfts(fetchedNFTs);
      } catch (error) {
        console.error('Error fetching NFTs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [connected, publicKey, connection]);

  // Profil verilerini yerel depolamadan yükleme
  useEffect(() => {
    if (publicKey) {
      const savedProfile = localStorage.getItem(`profile_${publicKey.toBase58()}`);
      if (savedProfile) {
        setProfileData(JSON.parse(savedProfile));
      }
    }
  }, [publicKey]);

  // Profil verilerini kaydetme
  const saveProfile = () => {
    if (publicKey) {
      localStorage.setItem(`profile_${publicKey.toBase58()}`, JSON.stringify(profileData));
    }
  };

  // NFT seçme
  const handleSelectNFT = (mint: string) => {
    setProfileData((prev) => ({ ...prev, selectedNFT: mint }));
    saveProfile();
  };

  // Kullanıcı adı ve bio güncelleme
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  // Profil değişikliklerini kaydetme
  const handleSave = () => {
    saveProfile();
    alert('Profile saved!');
  };

  // Seçilen NFT veya varsayılan PFP'nin URL'sini al
  const getProfileImage = () => {
    if (profileData.selectedNFT) {
      return nfts.find((nft) => nft.mint === profileData.selectedNFT)?.image || defaultPfp;
    }
    return defaultPfp;
  };

  if (!connected) {
    return <div className="dystopian-panel">Please connect your wallet to view your profile.</div>;
  }

  return (
    <div className="dystopian-panel profile-section">
      <div className="profile-header">
        {/* Küçük PFP Görseli */}
        <div className="profile-avatar-container">
          <img src={getProfileImage()} alt="Profile Avatar" className="profile-avatar" />
          {profileData.username && <h3 className="profile-username">{profileData.username}</h3>}
        </div>
      </div>

      <h2 className="cyber-title">Your Profile</h2>
      <div className="profile-container">
        {/* Profil Resmi */}
        <div className="profile-image">
          <img
            src={getProfileImage()}
            alt="Profile NFT"
            className="selected-nft"
          />
        </div>

        {/* Kullanıcı Bilgileri */}
        <div className="profile-info">
          <label className="cyber-label">Username</label>
          <input
            type="text"
            name="username"
            value={profileData.username}
            onChange={handleInputChange}
            className="cyber-input dystopian-input"
            placeholder="Enter your username"
          />
          <label className="cyber-label">Bio</label>
          <textarea
            name="bio"
            value={profileData.bio}
            onChange={handleInputChange}
            className="cyber-input dystopian-input"
            placeholder="Tell us about yourself"
          />
          <button onClick={handleSave} className="cyber-button dystopian-button">
            Save Profile
          </button>
        </div>

        {/* NFT Galeri */}
        <div className="nft-gallery">
          <h3 className="cyber-title">Your NFTs</h3>
          {loading ? (
            <p>Loading NFTs...</p>
          ) : nfts.length === 0 ? (
            <p>No NFTs found in your wallet. Using default profile picture.</p>
          ) : (
            <div className="nft-grid">
              {nfts.map((nft) => (
                <div
                  key={nft.mint}
                  className={`nft-card ${profileData.selectedNFT === nft.mint ? 'selected' : ''}`}
                  onClick={() => handleSelectNFT(nft.mint)}
                >
                  <img src={nft.image} alt={nft.name} className="nft-image" />
                  <p>{nft.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};