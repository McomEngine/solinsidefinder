'use client';

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { createPortal } from 'react-dom';
import { debounce } from 'lodash';

// Tür birleşimini tekrar kullanmak için bir tür tanımlayalım
type SectionType =
  | 'dashboard'
  | 'rugCheck'
  | 'bubbleMap'
  | 'timeline'
  | 'insiders'
  | 'battleArena'
  | 'trendingNFTs'
  | 'nftSniper'
  | 'monitoring'
  | 'profile'
  | 'cryptoNews';

interface NavbarProps {
  activeSection: SectionType;
  setActiveSection: (section: SectionType) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
  handleTitleClick: () => void;
  connected: boolean;
  publicKey: PublicKey | null;
}

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

// Token Dropdown Bileşeni
const TokenDropdown = ({
  activeSection,
  handleNavClick,
  handleNavTouch,
  wrapperRef,
}: {
  activeSection: SectionType;
  handleNavClick: (section: SectionType) => void;
  handleNavTouch: (section: SectionType) => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePosition = debounce(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    }, 10);

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      updatePosition.cancel();
    };
  }, [wrapperRef]);

  // document.body'nin mevcut olduğundan emin olalım (tarayıcı ortamı için)
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="token-dropdown"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
    >
      <button
        className={`nav-button dystopian-button ${activeSection === 'timeline' ? 'active' : ''}`}
        onClick={() => handleNavClick('timeline')}
        onTouchStart={() => handleNavTouch('timeline')}
      >
        Timeline
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'bubbleMap' ? 'active' : ''}`}
        onClick={() => handleNavClick('bubbleMap')}
        onTouchStart={() => handleNavTouch('bubbleMap')}
      >
        Bubble Map
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'insiders' ? 'active' : ''}`}
        onClick={() => handleNavClick('insiders')}
        onTouchStart={() => handleNavTouch('insiders')}
      >
        Insiders
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'rugCheck' ? 'active' : ''}`}
        onClick={() => handleNavClick('rugCheck')}
        onTouchStart={() => handleNavTouch('rugCheck')}
      >
        RUG Check
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'battleArena' ? 'active' : ''}`}
        onClick={() => handleNavClick('battleArena')}
        onTouchStart={() => handleNavTouch('battleArena')}
      >
        Battle Arena
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'monitoring' ? 'active' : ''}`}
        onClick={() => handleNavClick('monitoring')}
        onTouchStart={() => handleNavTouch('monitoring')}
      >
        Monitoring
      </button>
    </div>,
    document.body
  );
};

// NFT Dropdown Bileşeni
const NFTDropdown = ({
  activeSection,
  handleNavClick,
  handleNavTouch,
  wrapperRef,
}: {
  activeSection: SectionType;
  handleNavClick: (section: SectionType) => void;
  handleNavTouch: (section: SectionType) => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePosition = debounce(() => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    }, 10);

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      updatePosition.cancel();
    };
  }, [wrapperRef]);

  // document.body'nin mevcut olduğundan emin olalım (tarayıcı ortamı için)
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="nft-dropdown"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
    >
      <button
        className={`nav-button dystopian-button ${activeSection === 'trendingNFTs' ? 'active' : ''}`}
        onClick={() => handleNavClick('trendingNFTs')}
        onTouchStart={() => handleNavTouch('trendingNFTs')}
      >
        Trending NFTs
      </button>
      <button
        className={`nav-button dystopian-button ${activeSection === 'nftSniper' ? 'active' : ''}`}
        onClick={() => handleNavClick('nftSniper')}
        onTouchStart={() => handleNavTouch('nftSniper')}
      >
        NFT Sniper
      </button>
    </div>,
    document.body
  );
};

export const Navbar = ({
  activeSection,
  setActiveSection,
  isMenuOpen,
  setIsMenuOpen,
  handleTitleClick,
  connected,
  publicKey,
}: NavbarProps) => {
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);
  const [isNFTMenuOpen, setIsNFTMenuOpen] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { connected: walletConnected, publicKey: walletPublicKey } = useWallet();
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

  // Dropdown pozisyonları için ref'ler
  const tokenMenuRef = useRef<HTMLDivElement>(null);
  const nftMenuRef = useRef<HTMLDivElement>(null);

  // Log ortam değişkenini
  console.log('HELIUS_API_KEY:', HELIUS_API_KEY);

  // Varsayılan profil resmi
  const defaultPfp = '/default-pfp.png';

  // Mobil menü açıkken sayfa kaydırmasını engelle
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isMenuOpen]);

  // Navbar'ın kaydırma durumunu izle (yalnızca görsel efekt için)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Profil verilerini ve NFT'leri yükleme
  useEffect(() => {
    if (!walletConnected || !walletPublicKey || hasFetched || fetchFailed) {
      console.log('Skipping fetch: Not connected, no publicKey, already fetched, or fetch failed');
      setLoading(false);
      return;
    }

    const loadProfileData = async () => {
      const cacheKey = `nfts_${walletPublicKey.toBase58()}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.log('Using cached NFTs:', cached);
        setNfts(JSON.parse(cached));
        setLoading(false);
        return;
      }

      setHasFetched(true);
      setErrorMessage(null);
      setLoading(true);

      // Sahte veri kullan (Helius API çağrısını geçici olarak devre dışı bırak)
      const fetchedNFTs: NFT[] = [
        { mint: 'mockNFT1', uri: 'mockUri1', name: 'Mock NFT 1', image: 'mockImage1' },
        { mint: 'mockNFT2', uri: 'mockUri2', name: 'Mock NFT 2', image: 'mockImage2' },
      ];
      console.log('Using mock NFTs:', fetchedNFTs);
      setNfts(fetchedNFTs);
      localStorage.setItem(cacheKey, JSON.stringify(fetchedNFTs));
      setLoading(false);

      // Profil verilerini yerel depolamadan yükleme
      const savedProfile = localStorage.getItem(`profile_${walletPublicKey.toBase58()}`);
      if (savedProfile) {
        setProfileData(JSON.parse(savedProfile));
      }
    };

    loadProfileData();
  }, [walletConnected, walletPublicKey, hasFetched, fetchFailed]);

  // Cüzdan bağlantısı kesildiğinde state'leri sıfırla
  useEffect(() => {
    if (!walletConnected) {
      console.log('Wallet disconnected, resetting Navbar states');
      setHasFetched(false);
      setFetchFailed(false);
      setNfts([]);
      setProfileData(null);
      setErrorMessage(null);
      setLoading(true);
    }
  }, [walletConnected]);

  // Profil resmini alma
  const getProfileImage = () => {
    if (loading) return defaultPfp;
    if (profileData?.selectedNFT) {
      const selectedNFT = nfts.find((nft) => nft.mint === profileData.selectedNFT);
      console.log('Selected NFT for profile image:', selectedNFT);
      return selectedNFT?.image || defaultPfp;
    }
    return defaultPfp;
  };

  const handleNavClick = useCallback(
    (section: SectionType) => {
      console.log(`${section} button clicked`);
      setActiveSection(section);
      setIsMenuOpen(false);
      setIsTokenMenuOpen(false);
      setIsNFTMenuOpen(false);
    },
    [setActiveSection, setIsMenuOpen]
  );

  const handleNavTouch = useCallback(
    (section: SectionType) => {
      console.log(`${section} button touched`);
      setActiveSection(section);
      setIsMenuOpen(false);
      setIsTokenMenuOpen(false);
      setIsNFTMenuOpen(false);
    },
    [setActiveSection, setIsMenuOpen]
  );

  const toggleTokenMenu = useCallback(() => {
    setIsTokenMenuOpen((prev) => !prev);
    setIsNFTMenuOpen(false);
    console.log('Token menu toggled:', !isTokenMenuOpen);
  }, [isTokenMenuOpen]);

  const toggleNFTMenu = useCallback(() => {
    setIsNFTMenuOpen((prev) => !prev);
    setIsTokenMenuOpen(false);
    console.log('NFT menu toggled:', !isNFTMenuOpen);
  }, [isNFTMenuOpen]);

  const handleRetry = () => {
    setHasFetched(false);
    setFetchFailed(false);
    setLoading(true);
    console.log('Retry button clicked');
  };

  return (
    <nav className={`cyber-navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-logo-title">
          <img
            src="/default-pfp1.png"
            alt="Logo"
            className="navbar-logo"
            onClick={handleTitleClick}
            style={{ cursor: 'pointer' }}
          />
          <h1 className="cyber-title" onClick={handleTitleClick}>
            CULT TRADE
          </h1>
        </div>
        {errorMessage && (
          <div className="error-text">
            {errorMessage}
            <button className="cyber-button dystopian-button" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
        <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          ☰
        </button>
        <div className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
          <div className="nav-buttons">
            {/* Crypto News butonu en başta */}
            <button
              className={`nav-button dystopian-button ${activeSection === 'cryptoNews' ? 'active' : ''}`}
              onClick={() => handleNavClick('cryptoNews')}
              onTouchStart={() => handleNavTouch('cryptoNews')}
            >
              Crypto News
            </button>

            {/* Dashboard butonu Crypto News'dan sonra */}
            <button
              className={`nav-button dystopian-button ${activeSection === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
              onTouchStart={() => handleNavTouch('dashboard')}
            >
              Dashboard
            </button>

            <div className="token-menu-wrapper" ref={tokenMenuRef}>
              <button
                className={`nav-button dystopian-button ${isTokenMenuOpen ? 'active' : ''}`}
                onClick={toggleTokenMenu}
              >
                Token ▼
              </button>
              {isTokenMenuOpen && (
                <TokenDropdown
                  activeSection={activeSection}
                  handleNavClick={handleNavClick}
                  handleNavTouch={handleNavTouch}
                  wrapperRef={tokenMenuRef}
                />
              )}
            </div>

            <div className="nft-menu-wrapper" ref={nftMenuRef}>
              <button
                className={`nav-button dystopian-button ${isNFTMenuOpen ? 'active' : ''}`}
                onClick={toggleNFTMenu}
              >
                NFT ▼
              </button>
              {isNFTMenuOpen && (
                <NFTDropdown
                  activeSection={activeSection}
                  handleNavClick={handleNavClick}
                  handleNavTouch={handleNavTouch}
                  wrapperRef={nftMenuRef}
                />
              )}
            </div>

            {connected && (
              <button
                className={`nav-button dystopian-button profile-button ${activeSection === 'profile' ? 'active' : ''}`}
                onClick={() => handleNavClick('profile')}
                onTouchStart={() => handleNavTouch('profile')}
              >
                {!loading && (
                  <img src={getProfileImage()} alt="Profile Avatar" className="profile-avatar" />
                )}
                <span className="profile-text">Profile</span>
              </button>
            )}
          </div>

          <div className="wallet-button-container">
            <WalletMultiButton
              className={`dystopian-button wallet-button wallet-button--primary ${connected ? 'connected' : ''}`}
              aria-label={connected ? 'Disconnect Wallet' : 'Connect Wallet'}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};