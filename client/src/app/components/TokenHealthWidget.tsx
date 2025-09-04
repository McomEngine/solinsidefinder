'use client';

import { useState, useEffect, useMemo } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useWallet } from '@solana/wallet-adapter-react';
import { FaWallet, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

interface TokenHealth {
  address: string;
  healthScore: number | null;
  insiderIntensity: number | null;
  metrics: {
    holderScore: number;
    liquidityScore: number;
    accumulationScore: number;
    whaleScore: number;
    activityScore: number;
    giniScore: number;
    socialScore: number;
  };
  reasons: string[];
}

interface TokenHealthWidgetProps {
  favoriteTokens?: string[];
  contractAddress?: string;
  onCopyAddress?: () => void;
  className?: string; // Yeni eklenen prop
}

export default function TokenHealthWidget({
  favoriteTokens = [],
  contractAddress,
  onCopyAddress,
  className, // Yeni eklenen prop
}: TokenHealthWidgetProps) {
  const [currentTokenHealth, setCurrentTokenHealth] = useState<TokenHealth | null>(null);
  const [tokenHealth, setTokenHealth] = useState<TokenHealth[]>([]);
  const [portfolioTokens, setPortfolioTokens] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'favorites'>('portfolio');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchFailed, setFetchFailed] = useState<boolean>(false);

  const { publicKey, connected } = useWallet();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

  const debouncedFetchTokenHealth = useMemo(
    () =>
      debounce(async (tokens: string[]) => {
        setIsLoading(true);
        const healthData = await Promise.all(
          tokens.map(async (address) => {
            try {
              const response = await fetch(`${API_URL}/api/health-score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
              });
              if (!response.ok) throw new Error('Sağlık puanı alınamadı');
              const data = await response.json();
              return {
                address,
                healthScore: data.healthScore || null,
                insiderIntensity: data.insiderIntensity || null,
                metrics: {
                  holderScore: data.metrics?.holderScore || 0,
                  liquidityScore: data.metrics?.liquidityScore || 0,
                  accumulationScore: data.metrics?.accumulationScore || 0,
                  whaleScore: data.metrics?.whaleScore || 0,
                  activityScore: data.metrics?.activityScore || 0,
                  giniScore: data.metrics?.giniScore || 0,
                  socialScore: data.metrics?.socialScore || 0,
                },
                reasons: data.reasons || [],
              };
            } catch (error) {
              console.error(`Hata (${address}):`, error);
              return {
                address,
                healthScore: null,
                insiderIntensity: null,
                metrics: {
                  holderScore: 0,
                  liquidityScore: 0,
                  accumulationScore: 0,
                  whaleScore: 0,
                  activityScore: 0,
                  giniScore: 0,
                  socialScore: 0,
                },
                reasons: [],
              };
            }
          })
        );
        setTokenHealth(healthData);
        setIsLoading(false);
      }, 500),
    [API_URL]
  );

  const fetchPortfolioTokens = async () => {
    const cacheKey = `portfolioTokens_${publicKey?.toBase58()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setPortfolioTokens(JSON.parse(cached));
      return;
    }

    if (!connected || !publicKey || hasFetched || fetchFailed) {
      setPortfolioTokens([]);
      return;
    }

    setHasFetched(true);
    setErrorMessage(null);
    setIsLoading(true);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(
          `https://api.helius.xyz/v1/assets?ownerAddress=${publicKey.toBase58()}&api-key=${HELIUS_API_KEY}`
        );
        if (!response.ok) throw new Error(`HTTP hatası: ${response.status}`);
        const data = await response.json();
        const tokens = data.items
          .filter((item: any) => item.interface === 'FungibleToken')
          .map((item: any) => item.id);
        setPortfolioTokens(tokens);
        localStorage.setItem(cacheKey, JSON.stringify(tokens));
        setFetchFailed(false);
        break;
      } catch (error: any) {
        attempt++;
        if (attempt === maxRetries) {
          setPortfolioTokens([]);
          setErrorMessage('Portföy token’ları alınamadı. Lütfen tekrar deneyin.');
          setFetchFailed(true);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const fetchCurrentTokenHealth = async () => {
    if (!contractAddress) return;
    try {
      const response = await fetch(`${API_URL}/api/health-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contractAddress }),
      });
      if (!response.ok) throw new Error('Sağlık puanı alınamadı');
      const data = await response.json();
      setCurrentTokenHealth({
        address: contractAddress,
        healthScore: data.healthScore || null,
        insiderIntensity: data.insiderIntensity || null,
        metrics: {
          holderScore: data.metrics?.holderScore || 0,
          liquidityScore: data.metrics?.liquidityScore || 0,
          accumulationScore: data.metrics?.accumulationScore || 0,
          whaleScore: data.metrics?.whaleScore || 0,
          activityScore: data.metrics?.activityScore || 0,
          giniScore: data.metrics?.giniScore || 0,
          socialScore: data.metrics?.socialScore || 0,
        },
        reasons: data.reasons || [],
      });
    } catch (error) {
      console.error(`Hata (${contractAddress}):`, error);
      setCurrentTokenHealth({
        address: contractAddress,
        healthScore: null,
        insiderIntensity: null,
        metrics: {
          holderScore: 0,
          liquidityScore: 0,
          accumulationScore: 0,
          whaleScore: 0,
          activityScore: 0,
          giniScore: 0,
          socialScore: 0,
        },
        reasons: [],
      });
    }
  };

  useEffect(() => {
    fetchPortfolioTokens();
  }, [connected, publicKey]);

  useEffect(() => {
    fetchCurrentTokenHealth();
  }, [contractAddress, API_URL]);

  useEffect(() => {
    const allTokens = [...new Set([...favoriteTokens, ...portfolioTokens])];
    if (allTokens.length > 0) {
      debouncedFetchTokenHealth(allTokens);
    }
    return () => debouncedFetchTokenHealth.cancel();
  }, [favoriteTokens, portfolioTokens, debouncedFetchTokenHealth]);

  const handleCopyAddress = async () => {
    if (contractAddress && onCopyAddress) {
      try {
        await navigator.clipboard.writeText(contractAddress);
        onCopyAddress();
        setCopyTooltip('Kopyalandı!');
        setTimeout(() => setCopyTooltip(null), 2000);
      } catch (error) {
        setCopyTooltip('Kopyalama başarısız!');
        setTimeout(() => setCopyTooltip(null), 2000);
      }
    }
  };

  const handleRetry = () => {
    setHasFetched(false);
    setFetchFailed(false);
    fetchPortfolioTokens();
  };

  const getSummary = (metrics: TokenHealth['metrics']) => {
    const strengths: string[] = [];
    if (metrics.liquidityScore > 15) strengths.push('Yüksek Likidite');
    if (metrics.holderScore > 15) strengths.push('Geniş Sahip Tabanı');
    if (metrics.socialScore > 15) strengths.push('Aktif Topluluk');
    return strengths.length > 0 ? `Güçlü Yönler: ${strengths.join(', ')}` : 'Önemli bir güçlü yön tespit edilmedi.';
  };

  return (
    <div className={`cyber-widget token-health-widget ${className || ''}`}>
      <div className="widget-header">
        <h2 className="widget-title">Token Sağlığı Paneli</h2>
      </div>
      <div className="widget-content">
        {/* Hata Mesajı */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="error-message"
            >
              <FaExclamationTriangle />
              <span>{errorMessage}</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRetry}
                  className="dystopian-button small-button"
                  aria-label="Yeniden dene"
                >
                  Yeniden Dene
                </button>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-accent-purple hover:text-accent-turquoise"
                  aria-label="Hata mesajını kapat"
                >
                  <FaTimes />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Yükleme Durumu */}
        {isLoading && (
          <div className="flex justify-center mb-6">
            <div className="w-8 h-8 border-4 border-accent-turquoise border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Ana Token Kartı */}
        {contractAddress && currentTokenHealth && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="health-card cursor-pointer"
            onClick={() => setSelectedToken(currentTokenHealth.address)}
          >
            <div className="flex items-center justify-between mb-4">
              <a
                href={`https://solscan.io/token/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-turquoise hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
              </a>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyAddress();
                  }}
                  className="text-accent-gray hover:text-accent-turquoise"
                  aria-label="Sözleşme adresini kopyala"
                >
                  📋
                </button>
                {copyTooltip && <span className="text-sm text-accent-gray">{copyTooltip}</span>}
              </div>
            </div>
            <div className="flex items-center mb-4">
              <div className="w-20 h-20 circular-progressbar">
                <CircularProgressbar
                  value={currentTokenHealth.healthScore || 0}
                  text={`${currentTokenHealth.healthScore || 0}%`}
                  styles={buildStyles({
                    pathColor: currentTokenHealth.healthScore
                      ? currentTokenHealth.healthScore < 40
                        ? 'var(--accent-purple)'
                        : currentTokenHealth.healthScore <= 70
                        ? '#ecc94b'
                        : 'var(--accent-turquoise)'
                      : 'var(--accent-gray)',
                    textColor: 'var(--white)',
                    trailColor: 'var(--panel-bg)',
                  })}
                />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-white">Sağlık Puanı</h3>
                <p className="text-sm text-accent-gray">
                  {currentTokenHealth.healthScore
                    ? currentTokenHealth.healthScore < 40
                      ? 'Dikkat gerektiriyor'
                      : 'Kararlı'
                    : 'Veri yok'}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-white">
                İçeriden Bilgi Yoğunluğu:{' '}
                {currentTokenHealth.insiderIntensity ? `${currentTokenHealth.insiderIntensity}%` : 'Veri yok'}
              </p>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${
                    currentTokenHealth.insiderIntensity
                      ? currentTokenHealth.insiderIntensity < 30
                        ? 'bg-accent-turquoise'
                        : currentTokenHealth.insiderIntensity <= 60
                        ? 'bg-accent-gray'
                        : 'bg-accent-purple'
                      : 'bg-accent-gray'
                  }`}
                  style={{ width: `${currentTokenHealth.insiderIntensity || 0}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mb-4">
              <div className="flex items-center">
                <FaWallet className="text-accent-turquoise mr-2" />
                <span className="text-white">Sahipler: {currentTokenHealth.metrics.holderScore}</span>
              </div>
              <div className="flex items-center">
                <FaWallet className="text-accent-turquoise mr-2" />
                <span className="text-white">Likidite: {currentTokenHealth.metrics.liquidityScore}</span>
              </div>
            </div>
            <p className="text-sm text-accent-gray">{getSummary(currentTokenHealth.metrics)}</p>
          </motion.div>
        )}

        {/* Portföy ve Favoriler Sekmeleri */}
        {(portfolioTokens.length > 0 || favoriteTokens.length > 0) && !isLoading && (
          <div className="mb-6">
            <div className="tab-container">
              <button
                className={`tab-button ${activeTab === 'portfolio' ? 'active' : ''}`}
                onClick={() => setActiveTab('portfolio')}
              >
                Portföy
              </button>
              <button
                className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
                onClick={() => setActiveTab('favorites')}
              >
                Favoriler
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTab === 'portfolio' &&
                tokenHealth
                  .filter((token) => portfolioTokens.includes(token.address))
                  .map((token) => (
                    <motion.div
                      key={token.address}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="health-card cursor-pointer"
                      onClick={() => setSelectedToken(token.address)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <a
                          href={`https://solscan.io/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-turquoise hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </a>
                      </div>
                      <div className="flex items-center mb-4">
                        <div className="w-16 h-16 circular-progressbar">
                          <CircularProgressbar
                            value={token.healthScore || 0}
                            text={`${token.healthScore || 0}%`}
                            styles={buildStyles({
                              pathColor: token.healthScore
                                ? token.healthScore < 40
                                  ? 'var(--accent-purple)'
                                  : token.healthScore <= 70
                                  ? '#ecc94b'
                                  : 'var(--accent-turquoise)'
                                : 'var(--accent-gray)',
                              textColor: 'var(--white)',
                              trailColor: 'var(--panel-bg)',
                            })}
                          />
                        </div>
                        <div className="ml-4">
                          <h3 className="text-md font-semibold text-white">Sağlık Puanı</h3>
                          <p className="text-sm text-accent-gray">
                            {token.healthScore
                              ? token.healthScore < 40
                                ? 'Dikkat gerektiriyor'
                                : 'Kararlı'
                              : 'Veri yok'}
                          </p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-white">
                          İçeriden Bilgi Yoğunluğu:{' '}
                          {token.insiderIntensity ? `${token.insiderIntensity}%` : 'Veri yok'}
                        </p>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${
                              token.insiderIntensity
                                ? token.insiderIntensity < 30
                                  ? 'bg-accent-turquoise'
                                  : token.insiderIntensity <= 60
                                  ? 'bg-accent-gray'
                                  : 'bg-accent-purple'
                                : 'bg-accent-gray'
                            }`}
                            style={{ width: `${token.insiderIntensity || 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between mb-4">
                        <div className="flex items-center">
                          <FaWallet className="text-accent-turquoise mr-2" />
                          <span className="text-white">Sahipler: {token.metrics.holderScore}</span>
                        </div>
                        <div className="flex items-center">
                          <FaWallet className="text-accent-turquoise mr-2" />
                          <span className="text-white">Likidite: {token.metrics.liquidityScore}</span>
                        </div>
                      </div>
                      <p className="text-sm text-accent-gray">{getSummary(token.metrics)}</p>
                    </motion.div>
                  ))}
              {activeTab === 'favorites' &&
                tokenHealth
                  .filter((token) => favoriteTokens.includes(token.address))
                  .map((token) => (
                    <motion.div
                      key={token.address}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="health-card cursor-pointer"
                      onClick={() => setSelectedToken(token.address)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <a
                          href={`https://solscan.io/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-turquoise hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </a>
                      </div>
                      <div className="flex items-center mb-4">
                        <div className="w-16 h-16 circular-progressbar">
                          <CircularProgressbar
                            value={token.healthScore || 0}
                            text={`${token.healthScore || 0}%`}
                            styles={buildStyles({
                              pathColor: token.healthScore
                                ? token.healthScore < 40
                                  ? 'var(--accent-purple)'
                                  : token.healthScore <= 70
                                  ? '#ecc94b'
                                  : 'var(--accent-turquoise)'
                                : 'var(--accent-gray)',
                              textColor: 'var(--white)',
                              trailColor: 'var(--panel-bg)',
                            })}
                          />
                        </div>
                        <div className="ml-4">
                          <h3 className="text-md font-semibold text-white">Sağlık Puanı</h3>
                          <p className="text-sm text-accent-gray">
                            {token.healthScore
                              ? token.healthScore < 40
                                ? 'Dikkat gerektiriyor'
                                : 'Kararlı'
                              : 'Veri yok'}
                          </p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-white">
                          İçeriden Bilgi Yoğunluğu:{' '}
                          {token.insiderIntensity ? `${token.insiderIntensity}%` : 'Veri yok'}
                        </p>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${
                              token.insiderIntensity
                                ? token.insiderIntensity < 30
                                  ? 'bg-accent-turquoise'
                                  : token.insiderIntensity <= 60
                                  ? 'bg-accent-gray'
                                  : 'bg-accent-purple'
                                : 'bg-accent-gray'
                            }`}
                            style={{ width: `${token.insiderIntensity || 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between mb-4">
                        <div className="flex items-center">
                          <FaWallet className="text-accent-turquoise mr-2" />
                          <span className="text-white">Sahipler: {token.metrics.holderScore}</span>
                        </div>
                        <div className="flex items-center">
                          <FaWallet className="text-accent-turquoise mr-2" />
                          <span className="text-white">Likidite: {token.metrics.liquidityScore}</span>
                        </div>
                      </div>
                      <p className="text-sm text-accent-gray">{getSummary(token.metrics)}</p>
                    </motion.div>
                  ))}
            </div>
          </div>
        )}

        {/* Modal */}
        {selectedToken && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSelectedToken(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-panel-bg p-6 rounded-lg max-w-lg w-full border border-accent-turquoise"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-accent-turquoise">Token Sağlığı Raporu</h3>
              {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth) && (
                <>
                  <p className="mb-2 text-white">
                    Adres:{' '}
                    <a
                      href={`https://solscan.io/token/${selectedToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-turquoise hover:underline"
                    >
                      {selectedToken.slice(0, 6)}...{selectedToken.slice(-4)}
                    </a>
                  </p>
                  <p className="mb-2 text-white">
                    Sağlık Puanı:{' '}
                    {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.healthScore ||
                      'Veri yok'}%
                  </p>
                  <p className="mb-4 text-white">
                    İçeriden Bilgi Yoğunluğu:{' '}
                    {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.insiderIntensity ||
                      'Veri yok'}%
                  </p>
                  <h4 className="text-lg font-semibold mb-2 text-accent-turquoise">Metrikler</h4>
                  <ul className="list-disc list-inside mb-4 text-sm text-white">
                    <li>
                      Sahipler:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics.holderScore}
                    </li>
                    <li>
                      Likidite:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics
                        .liquidityScore}
                    </li>
                    <li>
                      Birikme:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics
                        .accumulationScore}
                    </li>
                    <li>
                      Balinalar:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics.whaleScore}
                    </li>
                    <li>
                      Aktivite:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics
                        .activityScore}
                    </li>
                    <li>
                      Dağılım:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics.giniScore}
                    </li>
                    <li>
                      Sosyal:{' '}
                      {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.metrics.socialScore}
                    </li>
                  </ul>
                  <h4 className="text-lg font-semibold mb-2 text-accent-turquoise">Puan Nedenleri</h4>
                  <ul className="list-disc list-inside mb-4 text-sm text-white">
                    {(tokenHealth.find((t) => t.address === selectedToken) || currentTokenHealth)!.reasons.map(
                      (reason, index) => (
                        <li key={index}>{reason}</li>
                      )
                    )}
                  </ul>
                  <button
                    className="dystopian-button w-full"
                    onClick={() => setSelectedToken(null)}
                  >
                    Kapat
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}