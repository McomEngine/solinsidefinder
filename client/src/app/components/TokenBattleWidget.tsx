import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { BattleArenaSectionProps } from '../../utils/types';

const TokenBattleWidget: React.FC<BattleArenaSectionProps> = ({
  tokenCompareData,
  contractAddress,
  favoriteTokens,
  addFavoriteToken,
  removeFavoriteToken,
}) => {
  const [token1, setToken1] = useState<string>('');
  const [token2, setToken2] = useState<string>('');
  const [data1, setData1] = useState<any | null>(null);
  const [data2, setData2] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBattleStarted, setIsBattleStarted] = useState<boolean>(false);

  // tokenCompareData'dan ilk iki token'ı al
  useEffect(() => {
    if (tokenCompareData.length >= 2) {
      setToken1(tokenCompareData[0].address);
      setToken2(tokenCompareData[1].address);
      setData1({
        address: tokenCompareData[0].address,
        healthScore: 50,
        insiderIntensity: 30,
        hypeScore: 5,
        priceChange24h: '0.00',
      });
      setData2({
        address: tokenCompareData[1].address,
        healthScore: 50,
        insiderIntensity: 30,
        hypeScore: 5,
        priceChange24h: '0.00',
      });
    } else {
      console.warn('tokenCompareData does not have enough tokens:', tokenCompareData);
      setData1(null);
      setData2(null);
    }
  }, [tokenCompareData]);

  // Hata ayıklama için data1 ve data2 logları
  useEffect(() => {
    console.log('data1:', data1);
    console.log('data2:', data2);
  }, [data1, data2]);

  const handleCompare = async () => {
    if (!token1 || !token2) {
      setError('Please enter two token addresses.');
      return;
    }
    setLoading(true);
    setError(null);
    setIsBattleStarted(true);
    try {
      const [health1, health2] = await Promise.all([
        fetchTokenHealth(token1),
        fetchTokenHealth(token2),
      ]);
      setData1(health1);
      setData2(health2);
    } catch (error) {
      setError('An error occurred during token comparison. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && isBattleStarted) {
      const timer = setTimeout(() => setIsBattleStarted(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, isBattleStarted]);

  const shareResults = async () => {
    if (!data1 || !data2) return;

    const resultsElement = document.querySelector('.battle-results');
    if (!resultsElement) return;

    try {
      const canvas = await html2canvas(resultsElement as HTMLElement);
      const imageData = canvas.toDataURL('image/png');

      const text =
        `⚔️ Token Battle Results! ${data1.address.slice(0, 6)} vs ${data2.address.slice(0, 6)}\n` +
        `Health: ${data1.healthScore}% vs ${data2.healthScore}%\n` +
        `Hype: ${data1.hypeScore}/10 vs ${data2.hypeScore}/10\n` +
        `#SolanaInsiderFinder`;

      const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
        imageData
      )}`;
      window.open(shareUrl, '_blank');
    } catch (err) {
      console.error('Screenshot error:', err);
      const text =
        `⚔️ Token Battle Results! ${data1.address.slice(0, 6)} vs ${data2.address.slice(0, 6)}\n` +
        `Health: ${data1.healthScore}% vs ${data2.healthScore}%\n` +
        `Hype: ${data1.hypeScore}/10 vs ${data2.hypeScore}/10\n` +
        `#SolanaInsiderFinder`;
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const winner = data1 && data2 ? (data1.healthScore > data2.healthScore ? 1 : 2) : null;

  // Progres barlar için gecikme hesaplayıcı
  const getProgressDelay = (index: number, metric: string) => {
    const baseDelay = index * 0.5;
    const metricDelay = { healthScore: 0, insiderIntensity: 0.3 }[metric] || 0;
    return baseDelay + metricDelay;
  };

  return (
    <div className="cyber-widget dystopian-panel battle-arena animate-scale-in">
      <h2 className="widget-title neon-pulse">Token Battle Arena</h2>
      <p>Contract Address: {contractAddress}</p>
      <div className="battle-controls">
        <input
          type="text"
          value={token1}
          onChange={(e) => setToken1(e.target.value)}
          placeholder="Token 1 Address"
          className="dystopian-input cyber-input"
          aria-label="Token 1 Address"
        />
        <input
          type="text"
          value={token2}
          onChange={(e) => setToken2(e.target.value)}
          placeholder="Token 2 Address"
          className="dystopian-input cyber-input"
          aria-label="Token 2 Address"
        />
        <button
          onClick={handleCompare}
          disabled={loading}
          className="dystopian-button cyber-button neon-glow"
          aria-label={loading ? 'Comparing Tokens' : 'Start Duel'}
        >
          {loading ? 'Comparing...' : 'Start Duel'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="favorite-tokens">
        <h3>Favorite Tokens</h3>
        {favoriteTokens.length > 0 ? (
          <div className="favorite-tokens-grid">
            {favoriteTokens.map((token) => (
              <div key={token} className="favorite-token-card dystopian-panel">
                <p>{token}</p>
                <div className="favorite-token-actions">
                  <button
                    onClick={() => removeFavoriteToken(token)}
                    className="dystopian-button cyber-button small-button"
                    aria-label={`Remove ${token} from favorites`}
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setToken1(token)}
                    className="dystopian-button cyber-button small-button"
                    aria-label={`Select ${token} as Token 1`}
                  >
                    Select as Token 1
                  </button>
                  <button
                    onClick={() => setToken2(token)}
                    className="dystopian-button cyber-button small-button"
                    aria-label={`Select ${token} as Token 2`}
                  >
                    Select as Token 2
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No favorite tokens added.</p>
        )}
        <button
          onClick={addFavoriteToken}
          className="dystopian-button cyber-button"
          aria-label="Add Favorite Token"
        >
          Add Favorite Token
        </button>
      </div>
      {data1 && data2 ? (
        <div className="battle-results">
          <div className={`battle-grid ${isBattleStarted ? 'battle-shake' : ''}`}>
            <div
              className={`battle-card dystopian-panel card-appear ${winner === 1 ? 'winner' : ''}`}
              data-index="0"
            >
              <h3>
                {data1.address.slice(0, 6)}...{data1.address.slice(-4)}
              </h3>
              <p>Health Score: {data1.healthScore}%</p>
              <div className="progress-bar">
                <div
                  className="progress-fill bg-accent-turquoise"
                  style={{
                    width: `${data1.healthScore}%`,
                    animationDelay: `${getProgressDelay(0, 'healthScore')}s`,
                  }}
                />
              </div>
              <p>Insider Intensity: {data1.insiderIntensity}%</p>
              <div className="progress-bar">
                <div
                  className="progress-fill bg-accent-purple"
                  style={{
                    width: `${data1.insiderIntensity}%`,
                    animationDelay: `${getProgressDelay(0, 'insiderIntensity')}s`,
                  }}
                />
              </div>
              <p>Hype Score: {data1.hypeScore}/10</p>
              <p>24h Price: {data1.priceChange24h}%</p>
            </div>
            <div className={`battle-vs ${isBattleStarted ? 'lightning-strike' : ''}`}>
              VS
            </div>
            <div
              className={`battle-card dystopian-panel card-appear ${winner === 2 ? 'winner' : ''}`}
              data-index="1"
            >
              <h3>
                {data2.address.slice(0, 6)}...{data2.address.slice(-4)}
              </h3>
              <p>Health Score: {data2.healthScore}%</p>
              <div className="progress-bar">
                <div
                  className="progress-fill bg-accent-turquoise"
                  style={{
                    width: `${data2.healthScore}%`,
                    animationDelay: `${getProgressDelay(1, 'healthScore')}s`,
                  }}
                />
              </div>
              <p>Insider Intensity: {data2.insiderIntensity}%</p>
              <div className="progress-bar">
                <div
                  className="progress-fill bg-accent-purple"
                  style={{
                    width: `${data2.insiderIntensity}%`,
                    animationDelay: `${getProgressDelay(1, 'insiderIntensity')}s`,
                  }}
                />
              </div>
              <p>Hype Score: {data2.hypeScore}/10</p>
              <p>24h Price: {data2.priceChange24h}%</p>
            </div>
          </div>
          <button
            onClick={shareResults}
            className="dystopian-button cyber-button battle-share neon-glow"
            aria-label="Share Results on X"
          >
            Share Results on X
          </button>
        </div>
      ) : (
        <p>No battle results to display.</p>
      )}
    </div>
  );
};

async function fetchTokenHealth(address: string): Promise<any> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/compare-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  if (!response.ok) {
    throw new Error('Token data could not be retrieved');
  }
  const data = await response.json();
  return {
    address,
    healthScore: data.healthScore || 50,
    insiderIntensity: data.insiderIntensity || 30,
    hypeScore: data.hypeScore || 5,
    priceChange24h: data.priceChange24h || '0.00',
  };
}

export default TokenBattleWidget;