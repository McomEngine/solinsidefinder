import { useState, useEffect, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { sendTelegramNotification } from '@utils/api';
import { formatNumber } from '@utils/helpers';
import { MonitoredTransaction } from '@utils/types';

interface UseWalletMonitoringProps {
  contractAddress: string;
  liveMode: boolean;
  connected: boolean;
  activeSection: string;
  followedWallets: string[];
  apiUrl: string;
}

interface UseWalletMonitoringReturn {
  monitoredTransactions: MonitoredTransaction[];
  error: string | null;
}

export const useWalletMonitoring = ({
  contractAddress,
  liveMode,
  connected,
  activeSection,
  followedWallets,
  apiUrl,
}: UseWalletMonitoringProps): UseWalletMonitoringReturn => {
  const [monitoredTransactions, setMonitoredTransactions] = useState<MonitoredTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!contractAddress || !liveMode || !connected || activeSection !== 'monitoring' || !followedWallets.length) {
      if (eventSourceRef.current) {
        console.log('SSE bağlantısı kapatılıyor: Koşullar sağlanmadı');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    try {
      new PublicKey(contractAddress);
    } catch (err: unknown) {
      console.error('Invalid contract address:', contractAddress, err);
      setError('Real-time monitoring is not possible with an invalid contract address.');
      return;
    }

    const walletsQuery = followedWallets.join(',');
    const url = `${apiUrl}/api/monitor?address=${encodeURIComponent(
      contractAddress
    )}&wallets=${encodeURIComponent(walletsQuery)}`;
    console.log('SSE bağlantısı başlatılıyor:', url);

    const connectSSE = () => {
      eventSourceRef.current = new EventSource(url);

      eventSourceRef.current.onopen = () => {
        console.log('SSE bağlantısı başarıyla kuruldu');
        reconnectAttempts.current = 0;
        setError(null);
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE verisi alındı:', data);
          if (data && Array.isArray(data)) {
            setMonitoredTransactions((prev) => {
              console.log('Yeni monitoredTransactions:', [...data, ...prev].slice(0, 100));
              return [...data, ...prev].slice(0, 100);
            });
            data.forEach((tx: MonitoredTransaction) => {
              if (tx.isLargeSell || tx.amount > 1_000_000) {
                const message = `🚨 *Insider Alert*: ${tx.wallet.slice(0, 6)}... ${tx.type} ${formatNumber(
                  tx.amount
                )} tokens at ${tx.timestamp}`;
                if (Notification.permission === 'granted') {
                  new Notification(message);
                }
                sendTelegramNotification(message, '1542453907').catch((err: unknown) => {
                  setError('Failed to send Telegram notification. Please check bot configuration.');
                });
              }
            });
          } else {
            console.warn('Invalid SSE data format:', data);
            setError('Received invalid data format from SSE. Please try again.');
          }
        } catch (err: unknown) {
          console.error('Error parsing SSE message:', err);
          setError('Failed to parse SSE message. Please try again.');
        }
      };

      eventSourceRef.current.addEventListener('heartbeat', () => {
        console.log('SSE Heartbeat received');
      });

      eventSourceRef.current.onerror = (event: Event) => {
        console.error('SSE Error:', event);
        const errorMessage = 'Failed to monitor wallets in real-time.';
        setError(errorMessage);

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          console.log(
            `SSE reconnect attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts} in ${delay}ms`
          );
          setTimeout(() => {
            reconnectAttempts.current += 1;
            connectSSE();
          }, delay);
        } else {
          console.error('Maximum reconnect attempts exceeded. SSE stopped.');
          setError(
            'Real-time monitoring stopped after multiple failed attempts. Please try again later.'
          );
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        console.log('SSE bağlantısı temizleniyor');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [contractAddress, liveMode, followedWallets, connected, activeSection, apiUrl]);

  return { monitoredTransactions, error };
};