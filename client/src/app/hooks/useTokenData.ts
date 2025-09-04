// client/src/hooks/useTokenData.ts
import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { fetchWithRetry, getFirst100Buyers } from '@utils/api';
import { formatNumber } from '@utils/helpers';
import { Wallet, TimelineEvent, BubbleData, RugCheckData, TokenCompareData } from '@utils/types';

interface TokenData {
  results: {
    earlyBuyers: Wallet[];
    holders: Wallet[];
    activeTraders: Wallet[];
    largeSellers: Wallet[];
  };
  healthScore: number | null;
  healthReasons: string[];
  insiderIntensity: number | null;
  timelineData: TimelineEvent[];
  bubbleData: BubbleData;
  rugCheckData: RugCheckData | null;
  tokenCompareData: TokenCompareData[];
}

interface UseTokenDataReturn {
  tokenData: TokenData;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  fetchTokenData: (contractAddress: string) => Promise<void>;
}

export const useTokenData = (apiUrl: string): UseTokenDataReturn => {
  const [tokenData, setTokenData] = useState<TokenData>({
    results: { earlyBuyers: [], holders: [], activeTraders: [], largeSellers: [] },
    healthScore: null,
    healthReasons: [],
    insiderIntensity: null,
    timelineData: [],
    bubbleData: { nodes: [], edges: [] },
    rugCheckData: null,
    tokenCompareData: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBubbleData = useCallback(
    async (contractAddress: string) => {
      if (!contractAddress) return;
      try {
        const data = await fetchWithRetry(
          `${apiUrl}/api/token-transfers`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: contractAddress, limit: 50 }),
          },
          3,
          1000
        );
        console.log('Bubble Data Response:', data);
        if (
          !data ||
          !Array.isArray(data.nodes) ||
          !Array.isArray(data.edges) ||
          !data.nodes.every((node: { id: string; balance: number }) => node?.id && typeof node.balance === 'number') ||
          !data.edges.every(
            (edge: { source: string; target: string; amount: number; timestamp: string }) =>
              edge?.source && edge?.target && edge?.timestamp && typeof edge.amount === 'number'
          )
        ) {
          console.warn(`Invalid bubble data: ${contractAddress}`, data);
          setTokenData((prev) => ({ ...prev, bubbleData: { nodes: [], edges: [] } }));
          setError('Ağ grafiği verisi bu token için bulunamadı. Başka bir token adresi deneyin.');
        } else {
          console.log(`Bubble data fetched: ${contractAddress}`, data);
          setTokenData((prev) => ({ ...prev, bubbleData: data }));
        }
      } catch (error: unknown) {
        console.error('Error fetching bubble data:', error);
        setError(
          `Ağ grafiği verisi yüklenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen token adresini kontrol edin.`
        );
        setTokenData((prev) => ({ ...prev, bubbleData: { nodes: [], edges: [] } }));
      }
    },
    [apiUrl]
  );

  const fetchRugCheckData = useCallback(
    async (contractAddress: string) => {
      if (!contractAddress) return;
      try {
        const data = await fetchWithRetry(
          `${apiUrl}/api/rug-check`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: contractAddress }),
          },
          3,
          1000
        );
        console.log('Rug Check Data Response:', data);
        if (!data || typeof data !== 'object') {
          throw new Error('Geçersiz rug check verisi.');
        }

        if (data.insiderHoldings > data.totalSupply) {
          console.warn(`Hata: insiderHoldings (${data.insiderHoldings}) totalSupply (${data.totalSupply})'yi aşıyor!`);
          data.insiderHoldings = Math.min(data.insiderHoldings, data.totalSupply);
          data.reasons = [
            ...(data.reasons || []),
            'Insider holdings anomali: Fazla token tespit edildi.',
          ];
        }

        if (data.totalSupply <= 0) {
          throw new Error('Toplam arz sıfır veya negatif, rug check verisi geçersiz.');
        }

        console.log(`Rug check data fetched: ${contractAddress}`, data);
        setTokenData((prev) => ({ ...prev, rugCheckData: data }));
      } catch (error: unknown) {
        console.error('Error fetching rug check data:', error);
        setError(
          `Rug check verisi yüklenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen token adresini kontrol edin.`
        );
        setTokenData((prev) => ({ ...prev, rugCheckData: null }));
      }
    },
    [apiUrl]
  );

  const fetchTokenCompareData = useCallback(
    async (contractAddress: string) => {
      if (!contractAddress) return;
      try {
        const data = await fetchWithRetry(
          `${apiUrl}/api/compare-tokens`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: contractAddress }),
          },
          3,
          1000
        );
        console.log('Token Compare Data Response:', data);
        const compareData = Array.isArray(data) ? data : [data];
        if (!compareData || compareData.length === 0) {
          throw new Error('Geçersiz token karşılaştırma verisi.');
        }
        setTokenData((prev) => ({ ...prev, tokenCompareData: compareData }));
      } catch (error: unknown) {
        console.error('Error fetching token compare data:', error);
        setError(
          `Token karşılaştırma verisi yüklenemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen token adresini kontrol edin.`
        );
        setTokenData((prev) => ({ ...prev, tokenCompareData: [] }));
      }
    },
    [apiUrl]
  );

  const fetchTokenData = useCallback(
    async (contractAddress: string) => {
      if (!contractAddress) {
        setError('Lütfen geçerli bir contract adresi girin.');
        return;
      }

      try {
        new PublicKey(contractAddress);
      } catch (err: unknown) {
        setError('Geçersiz Solana contract adresi.');
        return;
      }

      setLoading(true);
      setError(null);
      const searchHistoryRaw = localStorage.getItem('searchHistory');
      const searchHistory: string[] = searchHistoryRaw ? JSON.parse(searchHistoryRaw) : [];
      if (!searchHistory.includes(contractAddress)) {
        searchHistory.push(contractAddress);
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
      }

      try {
        const [searchData, healthData, timelineData, earlyBuyers] = await Promise.all([
          fetchWithRetry(
            `${apiUrl}/api/search`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: contractAddress }),
            },
            3,
            1000
          ).catch((err: unknown) => {
            console.error(`Search API error: ${contractAddress}`, err);
            return { results: { earlyBuyers: [], holders: [], activeTraders: [], largeSellers: [] } };
          }),
          fetchWithRetry(
            `${apiUrl}/api/health-score`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: contractAddress }),
            },
            3,
            1000
          ).catch((err: unknown) => {
            console.error(`Health score API error: ${contractAddress}`, err);
            return { healthScore: null, reasons: [], insiderIntensity: null };
          }),
          fetchWithRetry(
            `${apiUrl}/api/timeline`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ address: contractAddress }),
            },
            3,
            1000
          ).catch((err: unknown) => {
            console.error(`Timeline API error: ${contractAddress}`, err);
            return { events: [] };
          }),
          getFirst100Buyers(contractAddress).catch((err: unknown) => {
            console.error(`Helius first 100 buyers error: ${contractAddress}`, err);
            return [];
          }),
        ]);

        console.log('Search Data Response:', searchData);
        console.log('Health Data Response:', healthData);
        console.log('Timeline Data Response:', timelineData);
        console.log('Early Buyers Response:', earlyBuyers);

        const validatedResults = {
          earlyBuyers: Array.isArray(earlyBuyers) ? earlyBuyers : [],
          holders: Array.isArray(searchData?.results?.holders) ? searchData.results.holders : [],
          activeTraders: Array.isArray(searchData?.results?.activeTraders) ? searchData.results.activeTraders : [],
          largeSellers: Array.isArray(searchData?.results?.largeSellers) ? searchData.results.largeSellers : [],
        };
        setTokenData((prev) => ({
          ...prev,
          results: validatedResults,
          healthScore: healthData?.healthScore ?? null,
          healthReasons: healthData?.reasons || [],
          insiderIntensity: healthData?.insiderIntensity ?? null,
          timelineData: timelineData?.events || [],
          tokenCompareData: prev.tokenCompareData,
        }));

        await Promise.all([
          fetchBubbleData(contractAddress).catch((err: unknown) =>
            console.error(`Bubble data fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
          ),
          fetchRugCheckData(contractAddress).catch((err: unknown) =>
            console.error(`Rug check data fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
          ),
          fetchTokenCompareData(contractAddress).catch((err: unknown) =>
            console.error(`Token compare data fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
          ),
        ]);

        if (
          validatedResults.earlyBuyers.length === 0 &&
          validatedResults.holders.length === 0 &&
          validatedResults.activeTraders.length === 0 &&
          validatedResults.largeSellers.length === 0
        ) {
          setError('Bu token için insider cüzdan bulunamadı. Başka bir token adresi deneyin.');
        }
      } catch (err: unknown) {
        console.error('Search error:', err);
        setError(
          `Arama başarısız: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}. Lütfen contract adresini kontrol edin veya tekrar deneyin.`
        );
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, fetchBubbleData, fetchRugCheckData, fetchTokenCompareData]
  );

  return { tokenData, loading, error, setError, fetchTokenData };
};