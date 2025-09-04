'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Confetti from 'react-confetti';
import { PublicKey } from '@solana/web3.js';
import debounce from 'lodash/debounce';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Bileşenler
import BubbleMapWidget from '@components/BubbleMapWidget';
import InsidersSection from '@components/InsidersSection';
import { ConnectWalletModal } from '@components/ConnectWalletModal';
import { Navbar } from '@components/Navbar';
import { HeroSection } from '@components/HeroSection';
import { DashboardSection } from '@components/DashboardSection';
import { RugCheckSection } from '@components/RugCheckSection';
import { TimelineSection } from '@components/TimelineSection';
import { BattleArenaSection } from '@components/BattleArenaSection';
import { WalletDetailsModal } from '@components/WalletDetailsModal';
import TrendingNFTsSection from '@components/TrendingNFTsSection';
import NFTSniperSection from '@components/NFTSniperSection';
import { MonitoringSection } from '@components/MonitoringSection';
import { ProfileSection } from '@components/ProfileSection';
import CryptoNews from '@components/CryptoNews'; // Yeni import eklendi

// Yardımcı fonksiyonlar ve tipler
import { formatNumber } from '@utils/helpers';
import { Wallet, PieChartData, FilterState, Transaction, TokenCompareData } from '@utils/types';
import { useTokenData } from '@hooks/useTokenData';
import { useWalletMonitoring } from '@hooks/useWalletMonitoring';

// QueryClient'ı oluştur
const queryClient = new QueryClient();

export default function Home() {
  const [contractAddress, setContractAddress] = useState<string>('');
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'earlyBuyers' | 'holders' | 'activeTraders' | 'largeSellers'>(
    'earlyBuyers'
  );
  const [followedWallets, setFollowedWallets] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<
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
    | 'cryptoNews'
  >('dashboard');
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [favoriteTokens, setFavoriteTokens] = useState<string[]>([]);
  const [newTokenAddress, setNewTokenAddress] = useState<string>('');
  const [walletSearch, setWalletSearch] = useState<string>('');
  const [walletSort, setWalletSort] = useState<'score' | 'volume' | 'activity'>('score');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showHero, setShowHero] = useState<boolean>(true);
  const [bubbleFilters, setBubbleFilters] = useState<FilterState>({
    minAmount: 0,
    walletType: 'all',
    timeRange: 'all',
  });
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [liveMode, setLiveMode] = useState<boolean>(false);
  const [copyTooltip, setCopyTooltip] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [activeWidget, setActiveWidget] = useState<
    'activity' | 'followed' | 'favorites' | 'insiderSuggestions' | 'nftPortfolio'
  >('activity');

  const dashboardRef = useRef<HTMLDivElement>(null);

  const { publicKey, connected } = useWallet();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  // useTokenData hook'unu kullan
  const { tokenData, loading, error, setError, fetchTokenData } = useTokenData(API_URL);

  // Hata ayıklama: tokenData ve loading değerlerini konsola yazdır
  useEffect(() => {
    console.log('tokenData:', tokenData);
    console.log('tokenData.results:', tokenData?.results);
    console.log('tokenData.tokenCompareData:', tokenData?.tokenCompareData);
    console.log('loading:', loading);
    console.log('error from useTokenData:', error);
  }, [tokenData, loading, error]);

  // useWalletMonitoring hook'unu kullan
  const { monitoredTransactions, error: monitoringError } = useWalletMonitoring({
    contractAddress,
    liveMode,
    connected,
    activeSection,
    followedWallets,
    apiUrl: API_URL,
  });

  // Hata ayıklama: monitoredTransactions ve monitoringError değerlerini konsola yazdır
  useEffect(() => {
    console.log('monitoredTransactions:', monitoredTransactions);
    console.log('monitoringError from useWalletMonitoring:', monitoringError);
  }, [monitoredTransactions, monitoringError]);

  // Allowlist'i yükleme
  useEffect(() => {
    const fetchAllowlist = async () => {
      try {
        const response = await fetch('/allowlist.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch allowlist: ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          setAllowlist(data);
          console.log('Allowlist loaded:', data);
        } else {
          console.error('Allowlist is not an array:', data);
        }
      } catch (err: unknown) {
        console.error('Error fetching allowlist:', err);
      }
    };

    fetchAllowlist();
  }, []);

  // Allowlist kontrolü
  const isAllowed = useMemo(() => {
    if (!connected || !publicKey) return false;
    const walletAddress = publicKey.toBase58();
    return allowlist.includes(walletAddress);
  }, [connected, publicKey, allowlist]);

  // Konfeti efekti için kontrol
  useEffect(() => {
    if (connected && isAllowed && allowlist.length > 0) {
      setShowConfetti(true);
    } else {
      setShowConfetti(false);
    }
  }, [connected, isAllowed, allowlist]);

  // Allowlist dışı cüzdanlar için erişim kısıtlaması
  useEffect(() => {
    if (connected && publicKey && !isAllowed && allowlist.length > 0) {
      // Erişim kısıtlaması için bir şeyler yapılabilir, şu an boş
    }
  }, [connected, publicKey, isAllowed, allowlist]);

  const handleCopyAddress = async () => {
    if (contractAddress) {
      try {
        await navigator.clipboard.writeText(contractAddress);
        setCopyTooltip('Kopyalandı!');
        setTimeout(() => setCopyTooltip(null), 2000);
      } catch (error: unknown) {
        console.error('Kopyalama hatası:', error);
        setCopyTooltip('Kopyalama başarısız!');
        setTimeout(() => setCopyTooltip(null), 2000);
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector('.cyber-navbar') as HTMLElement;
      const cyberContainer = document.querySelector('.cyber-container') as HTMLElement;

      if (!navbar || !cyberContainer) return;

      const navbarHeight = navbar.offsetHeight;

      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      if (!showHero) {
        cyberContainer.style.paddingTop = `${navbarHeight}px`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [showHero]);

  const debouncedSetContractAddress = useCallback(
    debounce((value: string) => setContractAddress(value), 300),
    []
  );

  const handleDiveIn = () => {
    setTimeout(() => {
      setShowHero(false);
      dashboardRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  const handleTitleClick = useCallback(() => {
    setActiveSection('dashboard');
    setShowHero(true);
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      console.log('Bağlı cüzdan:', walletAddress);
      const savedWallets = localStorage.getItem(`followedWallets_${walletAddress}`);
      if (savedWallets) {
        const wallets = JSON.parse(savedWallets);
        console.log('Takip edilen cüzdanlar yüklendi:', wallets);
        setFollowedWallets(wallets);
      } else {
        setFollowedWallets([]);
      }
      const savedTokens = localStorage.getItem(`favoriteTokens_${walletAddress}`);
      if (savedTokens) {
        setFavoriteTokens(JSON.parse(savedTokens));
      } else {
        setFavoriteTokens([]);
      }
    } else {
      console.log('Cüzdan bağlantısı kesildi, takip edilen cüzdanlar temizleniyor');
      setFollowedWallets([]);
      setFavoriteTokens([]);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      localStorage.setItem(`favoriteTokens_${publicKey.toBase58()}`, JSON.stringify(favoriteTokens));
      localStorage.setItem(`followedWallets_${publicKey.toBase58()}`, JSON.stringify(followedWallets));
    }
  }, [favoriteTokens, followedWallets, connected, publicKey]);

  const handleSearch = useCallback(() => {
    if (contractAddress) {
      console.log('Searching for contract address:', contractAddress);
      fetchTokenData(contractAddress);
    } else {
      setError('Please enter a token address.');
    }
  }, [contractAddress, fetchTokenData, setError]);

  const followWallet = async (address: string) => {
    if (!connected) {
      alert('You can track wallets by connecting your wallet..');
      return;
    }
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }
    if (Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
    let newFollowed: string[];
    if (followedWallets.includes(address)) {
      newFollowed = followedWallets.filter((w) => w !== address);
      console.log('Wallet unfollowed:', address, 'Newly followed wallets:', newFollowed);
    } else {
      newFollowed = [...followedWallets, address];
      console.log('Wallet is being tracked:', address, 'Newly followed wallets:', newFollowed);
    }
    setFollowedWallets(newFollowed);
    if (publicKey) {
      localStorage.setItem(`followedWallets_${publicKey.toBase58()}`, JSON.stringify(newFollowed));
      console.log('Followed wallets saved to localStorage:', newFollowed);
    }
  };

  const healthBarColor = useMemo(() => {
    if (tokenData?.healthScore == null) return 'bg-accent-gray';
    if (tokenData.healthScore < 40) return 'bg-accent-purple';
    if (tokenData.healthScore <= 70) return 'bg-accent-gray';
    return 'bg-accent-turquoise';
  }, [tokenData?.healthScore]);

  const intensityBarColor = useMemo(() => {
    if (tokenData?.insiderIntensity == null) return 'bg-accent-gray';
    if (tokenData.insiderIntensity < 30) return 'bg-accent-turquoise';
    if (tokenData.insiderIntensity <= 60) return 'bg-accent-gray';
    return 'bg-accent-purple';
  }, [tokenData?.insiderIntensity]);

  const dexScreenerUrl = useMemo(
    () => (contractAddress ? `https://dexscreener.com/solana/${contractAddress}?embed=1&theme=dark&trades=0&info=0` : ''),
    [contractAddress]
  );

  const getChartData = (wallet: Wallet | undefined): PieChartData[] => {
    if (!wallet) {
      return [
        { title: 'SOL Profit', value: 0.01, color: 'var(--accent-turquoise)' },
        { title: 'Tokens Held', value: 0.01, color: 'var(--accent-purple)' },
        { title: 'Large Sell Impact', value: 0, color: '#FF4500' },
      ];
    }
    const profit = (wallet.profitEstimates ?? []).reduce((sum, p) => sum + p, 0) || 0;
    const totalVolume = wallet.totalVolume ?? 1;
    const holdingRatio = wallet.totalAmount > 0 ? (wallet.totalAmount / totalVolume) * 100 : 0;
    return [
      { title: 'SOL Profit', value: profit > 0 ? profit : 0.01, color: 'var(--accent-turquoise)' },
      { title: 'Tokens Held', value: holdingRatio > 0 ? holdingRatio : 0.01, color: 'var(--accent-purple)' },
      { title: 'Large Sell Impact', value: wallet.scoreDetails?.largeSellImpact ?? 0, color: '#FF4500' },
    ].filter((item) => item.value > 0);
  };

  const selectedWalletData = useMemo(() => {
    if (!selectedWallet || !tokenData?.results) return null;
    const wallet: Wallet | undefined = (tokenData.results.earlyBuyers ?? [])
      .concat(
        tokenData.results.holders ?? [],
        tokenData.results.activeTraders ?? [],
        tokenData.results.largeSellers ?? []
      )
      .find((w: Wallet) => w.address === selectedWallet);
    const node = tokenData?.bubbleData?.nodes?.find((n: { id: string; balance: number }) => n.id === selectedWallet);
    console.log('selectedWalletData - wallet:', wallet, 'node:', node);
    if (!wallet && !node) return null;
    return {
      address: selectedWallet,
      balance: node?.balance ?? 0,
      insiderScore: wallet?.score ?? null,
      walletLabel: wallet?.walletLabel ?? 'Bilinmiyor',
      totalVolume: wallet?.totalVolume ?? 0,
      buyCount: wallet?.buyCount ?? 0,
      sellCount: wallet?.sellCount ?? 0,
      lastTx: wallet?.lastTxTime ?? 'Yok',
      networkConnections: wallet?.networkConnections ?? [],
    };
  }, [selectedWallet, tokenData?.results, tokenData?.bubbleData]);

  const getBadgeTitle = (score: number | null): string => {
    if (score == null) return 'Yeni Başlayan';
    if (score >= 90) return 'Kripto İmparatoru';
    if (score >= 70) return 'Usta Trader';
    if (score >= 50) return 'Hacker';
    return 'Yeni Başlayan';
  };

  const addFavoriteToken = () => {
    if (!connected) {
      alert('Favori token eklemek için cüzdanınızı bağlayın.');
      return;
    }
    if (newTokenAddress && !favoriteTokens.includes(newTokenAddress)) {
      try {
        new PublicKey(newTokenAddress);
        setFavoriteTokens([...favoriteTokens, newTokenAddress]);
        setNewTokenAddress('');
      } catch (err: unknown) {
        console.error('Geçersiz token adresi:', err);
      }
    }
  };

  const removeFavoriteToken = (address: string) => {
    setFavoriteTokens(favoriteTokens.filter((token) => token !== address));
  };

  const exportWallets = () => {
    const data = (tokenData?.results?.[activeTab] ?? []).map((w: Wallet) => {
      const largestSale = (w.transactions ?? [])
        .filter((tx: Transaction) => tx.type === 'sell')
        .reduce((max: number, tx: Transaction) => Math.max(max, tx.amount ?? 0), 0);
      const largestSalePercent =
        tokenData?.rugCheckData && (tokenData.rugCheckData.totalSupply ?? 0) > 0
          ? ((largestSale / tokenData.rugCheckData.totalSupply) * 100).toFixed(2)
          : '0.00';
      return {
        address: w.address ?? 'Yok',
        insiderScore: w.score ?? 0,
        tokensHeld: w.totalAmount ?? 0,
        totalVolume: w.totalVolume ?? 0,
        buys: w.buyCount ?? 0,
        sells: w.sellCount ?? 0,
        label: w.walletLabel ?? 'Bilinmiyor',
        largestSalePercent,
      };
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallets_${activeTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRugCheck = () => {
    if (!tokenData?.rugCheckData) return;
    const data = {
      contractAddress,
      ...tokenData.rugCheckData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rug-check.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskDistributionData = useMemo(() => {
    if (!tokenData?.rugCheckData) return [];
    return [
      {
        title: 'Insider Aktivitesi',
        value:
          (tokenData.rugCheckData.insiderCount > 10 ||
          ((tokenData.rugCheckData.insiderHoldings ?? 0) / (tokenData.rugCheckData.totalSupply ?? 1) > 0.5))
            ? 40
            : 0,
        color: '#ff4500',
      },
      { title: 'Mint Yetkisi', value: tokenData.rugCheckData.mintAuthority ? 15 : 0, color: '#800080' },
      { title: 'Dondurma Yetkisi', value: tokenData.rugCheckData.freezeAuthority ? 15 : 0, color: '#4682b4' },
      { title: 'Yakım Durumu', value: (tokenData.rugCheckData.burnedPercentage ?? 0) < 10 ? 10 : 0, color: '#ff0000' },
      { title: 'Likidite', value: (tokenData.rugCheckData.liquidityLocked ?? 0) < 50 ? 10 : 0, color: '#00ff00' },
      {
        title: 'Kontrat Güvenliği',
        value: (tokenData.rugCheckData.contractRenounced ? 0 : 5) + (tokenData.rugCheckData.upgradeable ? 5 : 0),
        color: '#ffd700',
      },
    ].filter((item) => item.value > 0);
  }, [tokenData?.rugCheckData]);

  const fetchTokenPrice = async (contractAddress: string, timestamp: string): Promise<number> => {
    console.log(`Fetching token price for ${contractAddress} at ${timestamp}`);
    return 0.0001;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="cyber-container">
        {showConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={200}
            tweenDuration={3000}
          />
        )}

        <HeroSection showHero={showHero} handleDiveIn={handleDiveIn} />

        {!showHero && (
          <>
            {(error || monitoringError) && (
              <p className="error-text">
                {error || monitoringError || 'Veri yüklenemedi. Lütfen geçerli bir token adresi girin veya daha sonra tekrar deneyin.'}
              </p>
            )}

            {connected && isAllowed ? (
              <>
                <Navbar
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                  isMenuOpen={isMenuOpen}
                  setIsMenuOpen={setIsMenuOpen}
                  handleTitleClick={handleTitleClick}
                  connected={connected}
                  publicKey={publicKey}
                />

                <main>
                  {activeSection === 'dashboard' && (
                    <>
                      <div className="search-container dystopian-panel">
                        <input
                          type="text"
                          value={contractAddress}
                          onChange={(e) => debouncedSetContractAddress(e.target.value)}
                          placeholder="Enter the contract address"
                          className="cyber-input dystopian-input"
                        />
                        <button
                          onClick={handleSearch}
                          disabled={loading}
                          className="cyber-button dystopian-button"
                        >
                          {loading ? 'Scanning...' : 'Start Scanning'}
                        </button>
                      </div>
                      {(error || monitoringError) && (
                        <p className="error-text">
                          {error || monitoringError || 'Failed to load data. Please enter a valid token address or try again later.'}
                        </p>
                      )}
                      <DashboardSection
                        connected={connected}
                        contractAddress={contractAddress}
                        dexScreenerUrl={dexScreenerUrl}
                        favoriteTokens={favoriteTokens}
                        healthScore={tokenData?.healthScore ?? 0}
                        insiderIntensity={tokenData?.insiderIntensity ?? 0}
                        healthReasons={tokenData?.healthReasons ?? []}
                        followedWallets={followedWallets}
                        activeWidget={activeWidget}
                        setActiveWidget={setActiveWidget}
                        handleCopyAddress={handleCopyAddress}
                        newTokenAddress={newTokenAddress}
                        setNewTokenAddress={setNewTokenAddress}
                        addFavoriteToken={addFavoriteToken}
                        removeFavoriteToken={removeFavoriteToken}
                        healthBarColor={healthBarColor}
                        intensityBarColor={intensityBarColor}
                        dashboardRef={dashboardRef}
                        rugCheckData={tokenData?.rugCheckData ?? null}
                        timelineData={tokenData?.timelineData ?? []}
                        followWallet={followWallet}
                        monitoredTransactions={monitoredTransactions}
                        publicKey={publicKey ? publicKey.toBase58() : null}
                      />
                    </>
                  )}

                  {activeSection === 'rugCheck' && (
                    <RugCheckSection
                      loading={loading}
                      rugCheckData={tokenData?.rugCheckData ?? null}
                      contractAddress={contractAddress}
                      results={tokenData?.results ?? {}}
                      riskDistributionData={riskDistributionData}
                      handleCopyAddress={handleCopyAddress}
                      copyTooltip={copyTooltip}
                      showGuideModal={showGuideModal}
                      setShowGuideModal={setShowGuideModal}
                      exportRugCheck={exportRugCheck}
                      followWallet={followWallet}
                      followedWallets={followedWallets}
                    />
                  )}

                  {activeSection === 'bubbleMap' && (
                    <BubbleMapWidget
                      bubbleData={tokenData?.bubbleData ?? { nodes: [], edges: [] }}
                      results={tokenData?.results ?? {}}
                      zoomLevel={zoomLevel}
                      setZoomLevel={setZoomLevel}
                      selectedWallet={selectedWallet}
                      setSelectedWallet={setSelectedWallet}
                      followedWallets={followedWallets}
                      followWallet={followWallet}
                      formatNumber={formatNumber}
                      exportWallets={exportWallets}
                      bubbleFilters={bubbleFilters}
                      setBubbleFilters={setBubbleFilters}
                    />
                  )}

                  {activeSection === 'timeline' && (
                    <TimelineSection
                      timelineData={tokenData?.timelineData ?? []}
                      zoomLevel={zoomLevel}
                      setZoomLevel={setZoomLevel}
                      setSelectedWallet={setSelectedWallet}
                    />
                  )}

                  {activeSection === 'insiders' && (
                    <div>
                      <p className="info-text">
                        Not: Likidite havuzu cüzdanları, doğruluk için insider analizinden hariç tutulmuştur.
                      </p>
                      <InsidersSection
                        results={tokenData?.results ?? {}}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        walletSearch={walletSearch}
                        setWalletSearch={setWalletSearch}
                        walletSort={walletSort}
                        setWalletSort={setWalletSort}
                        followedWallets={followedWallets}
                        followWallet={followWallet}
                        exportWallets={exportWallets}
                        totalSupply={tokenData?.rugCheckData?.totalSupply ?? 0}
                        liveMode={liveMode}
                        setLiveMode={setLiveMode}
                        monitoredTransactions={monitoredTransactions}
                        contractAddress={contractAddress}
                        fetchTokenPrice={fetchTokenPrice}
                      />
                    </div>
                  )}

                  {activeSection === 'battleArena' && (
                    <BattleArenaSection
                      tokenCompareData={tokenData?.tokenCompareData ?? []}
                      contractAddress={contractAddress}
                      favoriteTokens={favoriteTokens}
                      addFavoriteToken={addFavoriteToken}
                      removeFavoriteToken={removeFavoriteToken}
                    />
                  )}

                  {activeSection === 'trendingNFTs' && null /* <TrendingNFTsSection /> */}
                  {activeSection === 'nftSniper' && null /* <NFTSniperSection /> */}

                  {activeSection === 'monitoring' && (
                    <MonitoringSection
                      followedWallets={followedWallets}
                      followWallet={followWallet}
                      results={tokenData?.results ?? {}}
                      contractAddress={contractAddress}
                    />
                  )}

                  {activeSection === 'profile' && <ProfileSection />}

                  {activeSection === 'cryptoNews' && <CryptoNews />}
                </main>

                {selectedWallet && selectedWalletData && (
                  <WalletDetailsModal
                    onClose={() => setSelectedWallet(null)}
                    walletData={selectedWalletData}
                    chartData={getChartData(
                      (tokenData?.results?.earlyBuyers ?? [])
                        .concat(
                          tokenData?.results?.holders ?? [],
                          tokenData?.results?.activeTraders ?? [],
                          tokenData?.results?.largeSellers ?? []
                        )
                        .find((w: Wallet) => w.address === selectedWallet)
                    )}
                    getBadgeTitle={getBadgeTitle}
                    followWallet={followWallet}
                    isFollowing={followedWallets.includes(selectedWallet)}
                  />
                )}
              </>
            ) : (
              <ConnectWalletModal connected={connected} isAllowed={isAllowed} allowlist={allowlist} />
            )}
          </>
        )}
      </div>
    </QueryClientProvider>
  );
}