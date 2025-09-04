'use client';

import { useMemo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  BarController,
  BarElement,
  ChartData,
} from 'chart.js';
import { formatNumber } from '../../utils/helpers';

// Dinamik olarak Chart bileşenini yükle (SSR devre dışı)
const Chart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Chart), { ssr: false });

// Interface tanımları
interface TimelineEvent {
  timestamp: string;
  price: number;
  buy?: { wallet: string; amount: number };
  sell?: { wallet: string; amount: number };
}

interface TimelineWidgetProps {
  timelineData: TimelineEvent[];
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  setSelectedWallet: (wallet: string | null) => void;
}

interface FilterState {
  timeRange: '1h' | '24h' | '7d' | 'all';
  transactionType: 'all' | 'buy' | 'sell';
  minAmount: number;
}

// Rehber Modal Bileşeni
const TimelineGuideModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dystopian-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Understanding the Timeline</h3>
        <p>This widget visualizes token price movements and insider trading activity over time:</p>
        <ul>
          <li><strong>Price Line:</strong> Shows the token's price in SOL over time.</li>
          <li><strong>Buy/Sell Points:</strong> Turquoise dots represent buys, purple dots represent sells.</li>
          <li>
            <strong>Volume Histogram:</strong> Displays transaction volume per time period, with colors indicating buy/sell
            ratio (green for buy-heavy, red for sell-heavy).
          </li>
          <li><strong>Annotations:</strong> Red lines highlight price changes greater than 10%.</li>
        </ul>
        <button className="modal-button dystopian-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default function TimelineWidget({
  timelineData,
  zoomLevel,
  setZoomLevel,
  setSelectedWallet,
}: TimelineWidgetProps) {
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'all',
    transactionType: 'all',
    minAmount: 0,
  });

  useEffect(() => {
    Promise.all([
      import('chartjs-plugin-zoom').then((zoomPlugin) => zoomPlugin.default),
      import('chartjs-plugin-annotation').then((annotationPlugin) => annotationPlugin.default),
    ]).then(([zoomPlugin, annotationPlugin]) => {
      ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        ScatterController,
        BarController,
        BarElement,
        zoomPlugin,
        annotationPlugin
      );
    });
  }, []);

  // Veri gruplandırma ve filtreleme
  const filteredTimelineData = useMemo(() => {
    setIsLoading(true);
    let data = timelineData;

    // Zaman aralığı filtresi
    const now = Date.now();
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    data = data.filter((event) => now - new Date(event.timestamp).getTime() <= timeRanges[filters.timeRange]);

    // İşlem türü filtresi
    if (filters.transactionType !== 'all') {
      data = data.filter((event) => (filters.transactionType === 'buy' ? event.buy : event.sell));
    }

    // Minimum miktar filtresi
    data = data.filter(
      (event) => (event.buy?.amount || 0) >= filters.minAmount || (event.sell?.amount || 0) >= filters.minAmount
    );

    // Veriyi dakika bazında gruplandır
    const groupedData: TimelineEvent[] = [];
    const timeMap: Record<string, TimelineEvent> = {};
    data.forEach((event) => {
      const minute = new Date(event.timestamp).setSeconds(0, 0);
      if (!timeMap[minute]) {
        timeMap[minute] = {
          timestamp: new Date(minute).toISOString(),
          price: event.price,
          buy: event.buy ? { ...event.buy } : undefined,
          sell: event.sell ? { ...event.sell } : undefined,
        };
      } else {
        timeMap[minute].price = (timeMap[minute].price + event.price) / 2; // Ortalama fiyat
        if (event.buy) {
          timeMap[minute].buy = {
            wallet: event.buy.wallet,
            amount: (timeMap[minute].buy?.amount || 0) + event.buy.amount,
          };
        }
        if (event.sell) {
          timeMap[minute].sell = {
            wallet: event.sell.wallet,
            amount: (timeMap[minute].sell?.amount || 0) + event.sell.amount,
          };
        }
      }
    });

    const result = Object.values(timeMap).slice(-1000); // Son 1000 olayı al
    setIsLoading(false);
    return result;
  }, [timelineData, filters]);

  const timelineChartData = useMemo(() => {
    const labels = filteredTimelineData.map((event) => new Date(event.timestamp).toLocaleString());
    const prices = filteredTimelineData.map((event) => Number(event.price) || 0);
    const buys = filteredTimelineData
      .map((event, index) => ({
        x: index,
        y: event.buy ? Number(event.price) || 0 : null,
        wallet: event.buy?.wallet,
        amount: event.buy?.amount,
        timestamp: new Date(event.timestamp).toTimeString(),
      }))
      .filter((point) => point.y !== null) as {
        x: number;
        y: number;
        wallet?: string;
        amount?: number;
        timestamp: string;
      }[];
    const sells = filteredTimelineData
      .map((event, index) => ({
        x: index,
        y: event.sell ? Number(event.price) || 0 : null,
        wallet: event.sell?.wallet,
        amount: event.sell?.amount,
        timestamp: new Date(event.timestamp).toTimeString(),
      }))
      .filter((point) => point.y !== null) as {
        x: number;
        y: number;
        wallet?: string;
        amount?: number;
        timestamp: string;
      }[];

    const chartData: ChartData<'line' | 'scatter'> = {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: 'Price',
          data: prices,
          borderColor: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 3,
        },
        {
          type: 'scatter' as const,
          label: 'Buys',
          data: buys,
          backgroundColor: 'var(--accent-turquoise)',
          pointRadius: 8,
          pointHoverRadius: 12,
          pointStyle: 'circle',
          pointBorderColor: 'var(--accent-turquoise)',
          pointBorderWidth: 2,
        },
        {
          type: 'scatter' as const,
          label: 'Sells',
          data: sells,
          backgroundColor: 'var(--accent-purple)',
          pointRadius: 8,
          pointHoverRadius: 12,
          pointStyle: 'circle',
          pointBorderColor: 'var(--accent-purple)',
          pointBorderWidth: 2,
        },
      ],
    };

    return chartData;
  }, [filteredTimelineData]);

  // Bar grafiği için veri
  const volumeChartData = useMemo(() => {
    const timeBins = filteredTimelineData.map((event) => new Date(event.timestamp).getTime());
    const minTime = Math.min(...timeBins);
    const maxTime = Math.max(...timeBins);
    const timeRange = maxTime - minTime || 1;
    const binSize = timeRange / 20; // 20 zaman dilimi
    const bins: { volume: number; buyRatio: number; timestamp: string }[] = [];

    filteredTimelineData.forEach((event) => {
      const time = new Date(event.timestamp).getTime();
      const binIndex = Math.floor((time - minTime) / binSize);
      const buyAmount = event.buy?.amount || 0;
      const sellAmount = event.sell?.amount || 0;
      const totalVolume = buyAmount + sellAmount;
      const buyRatio = totalVolume > 0 ? buyAmount / totalVolume : 0.5;

      if (!bins[binIndex]) {
        bins[binIndex] = { volume: 0, buyRatio: 0, timestamp: new Date(minTime + binIndex * binSize).toLocaleString() };
      }
      bins[binIndex].volume += totalVolume;
      bins[binIndex].buyRatio = (bins[binIndex].buyRatio * bins[binIndex].volume + buyRatio * totalVolume) / (bins[binIndex].volume + totalVolume);
    });

    const labels = bins.map((bin) => bin?.timestamp || '');
    const volumes = bins.map((bin) => bin?.volume || 0);
    const buyRatios = bins.map((bin) => bin?.buyRatio || 0.5);

    return {
      labels,
      datasets: [
        {
          label: 'Transaction Volume',
          data: volumes,
          backgroundColor: buyRatios.map((ratio) => {
            const r = Math.round(255 * (1 - ratio));
            const g = Math.round(255 * ratio);
            return `rgba(${r}, ${g}, 0, 0.7)`;
          }),
          borderColor: buyRatios.map((ratio) => {
            const r = Math.round(255 * (1 - ratio));
            const g = Math.round(255 * ratio);
            return `rgba(${r}, ${g}, 0, 1)`;
          }),
          borderWidth: 1,
        },
      ],
    };
  }, [filteredTimelineData]);

  const annotations = useMemo(() => {
    const annotations: any[] = [];
    filteredTimelineData.forEach((event, index) => {
      if (index > 0) {
        const prevPrice = Number(filteredTimelineData[index - 1].price);
        const currPrice = Number(event.price);
        const change = Math.abs((currPrice - prevPrice) / prevPrice) * 100;
        if (change > 10) {
          annotations.push({
            type: 'line',
            xMin: index,
            xMax: index,
            yMin: Math.min(prevPrice, currPrice),
            yMax: Math.max(prevPrice, currPrice),
            borderColor: 'var(--neon-red)',
            borderWidth: 2,
            label: {
              content: `${change.toFixed(1)}%`,
              enabled: true,
              position: 'center',
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              color: '#fff',
            },
          });
        }
      }
    });
    return annotations;
  }, [filteredTimelineData]);

  const timelineSummary = useMemo(() => {
    const buys = filteredTimelineData.filter((event) => event.buy).length;
    const sells = filteredTimelineData.filter((event) => event.sell).length;
    const totalVolume = filteredTimelineData.reduce(
      (sum, event) => sum + (Number(event.buy?.amount) || 0) + (Number(event.sell?.amount) || 0),
      0
    );
    const priceChange =
      filteredTimelineData.length > 1
        ? ((Number(filteredTimelineData[filteredTimelineData.length - 1].price) -
            Number(filteredTimelineData[0].price)) /
            Number(filteredTimelineData[0].price)) *
          100
        : 0;
    return { buys, sells, totalVolume, priceChange };
  }, [filteredTimelineData]);

  const zoomTimeline = (direction: 'in' | 'out') => {
    setZoomLevel(Math.max(0.5, Math.min(3, direction === 'in' ? zoomLevel * 1.2 : zoomLevel / 1.2)));
  };

  return (
    <div className="cyber-widget timeline-widget full-width dystopian-panel" role="region" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="widget-title">
        Insider Trading Timeline
      </h2>
      <div className="filter-panel">
        <select
          value={filters.timeRange}
          onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as any })}
          className="cyber-input dystopian-input"
          aria-label="Select time range"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="all">All Time</option>
        </select>
        <select
          value={filters.transactionType}
          onChange={(e) => setFilters({ ...filters, transactionType: e.target.value as any })}
          className="cyber-input dystopian-input"
          aria-label="Select transaction type"
        >
          <option value="all">All Transactions</option>
          <option value="buy">Buys Only</option>
          <option value="sell">Sells Only</option>
        </select>
        <input
          type="number"
          value={filters.minAmount}
          onChange={(e) => setFilters({ ...filters, minAmount: Number(e.target.value) })}
          placeholder="Min Amount"
          className="cyber-input dystopian-input"
          aria-label="Minimum transaction amount"
        />
      </div>
      <div className="timeline-controls">
        <button
          className="zoom-button dystopian-button"
          onClick={() => zoomTimeline('in')}
          aria-label="Zoom in on timeline"
        >
          Zoom In
        </button>
        <button
          className="zoom-button dystopian-button"
          onClick={() => zoomTimeline('out')}
          aria-label="Zoom out on timeline"
        >
          Zoom Out
        </button>
        <button
          className="cyber-button dystopian-button"
          onClick={() => setIsGuideModalOpen(true)}
          aria-label="Learn more about timeline"
        >
          Learn More
        </button>
      </div>
      <div className="timeline-summary" aria-live="polite">
        <p>Buys: {timelineSummary.buys}</p>
        <p>Sells: {timelineSummary.sells}</p>
        <p>Volume: {formatNumber(timelineSummary.totalVolume)} tokens</p>
        <p>Price Change: {timelineSummary.priceChange.toFixed(2)}%</p>
      </div>
      {isLoading ? (
        <div className="loading-container" aria-live="polite">
          <div className="cyber-spinner" aria-label="Loading timeline data"></div>
        </div>
      ) : filteredTimelineData.length > 0 ? (
        <>
          <div
            className="timeline-container"
            role="figure"
            aria-label="Token price and transaction timeline chart"
            aria-describedby="timeline-description"
          >
            <p id="timeline-description" className="sr-only">
              This chart displays the token price in SOL over time, with turquoise dots for buy transactions and purple
              dots for sell transactions. Red lines indicate price changes greater than 10%.
            </p>
            <Chart
              type="line"
              data={timelineChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                  duration: 800,
                  easing: 'easeOutQuart',
                },
                plugins: {
                  legend: { position: 'top', labels: { color: '#fff', font: { size: 14 } } },
                  title: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    callbacks: {
                      label: (context: any) => {
                        if (context.dataset.label === 'Price') {
                          return `Price: ${context.parsed.y.toFixed(4)} SOL`;
                        }
                        const point = context.raw;
                        return [
                          `Wallet: ${point.wallet?.slice(0, 6)}...${point.wallet?.slice(-4)}`,
                          `Type: ${context.dataset.label}`,
                          `Amount: ${formatNumber(point.amount)} tokens`,
                          `Price: ${point.y.toFixed(4)} SOL`,
                          `Time: ${point.timestamp}`,
                        ];
                      },
                    },
                  },
                  zoom: {
                    zoom: {
                      wheel: { enabled: true },
                      pinch: { enabled: true },
                      mode: 'x',
                    },
                    pan: { enabled: true, mode: 'x' },
                  },
                  annotation: {
                    annotations,
                  },
                },
                scales: {
                  x: {
                    title: { display: true, text: 'Time', color: '#fff', font: { size: 14 } },
                    ticks: { color: '#fff', maxRotation: 45, minRotation: 45 },
                  },
                  y: {
                    title: { display: true, text: 'Price (SOL)', color: '#fff', font: { size: 14 } },
                    ticks: { color: '#fff' },
                  },
                },
                interaction: {
                  mode: 'nearest',
                  intersect: false,
                },
                onClick: (event: any, elements: any) => {
                  if (elements.length > 0) {
                    const point = elements[0].element.$context.raw;
                    if (point.wallet) {
                      setSelectedWallet(point.wallet);
                    }
                  }
                },
              }}
            />
          </div>
          <div
            className="volume-container"
            role="figure"
            aria-label="Transaction volume histogram"
            aria-describedby="volume-description"
          >
            <h3>Transaction Volume Histogram</h3>
            <p id="volume-description" className="sr-only">
              This histogram shows transaction volume over time, with bar height indicating total volume and color
              indicating buy/sell ratio (green for buy-heavy, red for sell-heavy).
            </p>
            <Chart
              type="bar"
              data={volumeChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    callbacks: {
                      label: (context: any) => [
                        `Volume: ${formatNumber(context.raw)} tokens`,
                        `Buy Ratio: ${(context.dataset.backgroundColor[context.dataIndex].includes('0, 255, 0') ? 100 : 0)}%`,
                      ],
                    },
                  },
                },
                scales: {
                  x: {
                    title: { display: true, text: 'Time', color: '#fff', font: { size: 14 } },
                    ticks: { color: '#fff', maxRotation: 45, minRotation: 45 },
                  },
                  y: {
                    title: { display: true, text: 'Volume (Tokens)', color: '#fff', font: { size: 14 } },
                    ticks: { color: '#fff' },
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
          <div
            className="timeline-table dystopian-panel"
            style={{ marginTop: '1rem', overflowX: 'auto' }}
            role="grid"
            aria-labelledby="transaction-details-title"
          >
            <h3 id="transaction-details-title">Transaction Details</h3>
            <table style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Wallet</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Price (SOL)</th>
                  <th scope="col">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimelineData
                  .filter((event) => event.buy || event.sell)
                  .map((event, index) => (
                    <tr key={index} className={event.buy ? 'buy' : 'sell'} role="row">
                      <td role="gridcell">{event.buy ? 'Buy' : 'Sell'}</td>
                      <td role="gridcell">
                        <a
                          href={`https://solscan.io/account/${event.buy ? event.buy.wallet : event.sell!.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                          aria-label={`View wallet ${event.buy ? event.buy.wallet : event.sell!.wallet} on Solscan`}
                        >
                          {(event.buy ? event.buy.wallet : event.sell!.wallet).slice(0, 6)}...
                          {(event.buy ? event.buy.wallet : event.sell!.wallet).slice(-4)}
                        </a>
                      </td>
                      <td role="gridcell">
                        {formatNumber(event.buy ? event.buy.amount : event.sell!.amount)} tokens
                      </td>
                      <td role="gridcell">{Number(event.price).toFixed(4)} SOL</td>
                      <td role="gridcell">{new Date(event.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="no-data" aria-live="polite">
          <p>No timeline data available. Possible reasons:</p>
          <ul>
            <li>Invalid token address. Please check the contract address.</li>
            <li>No transactions for this token. Try another token.</li>
            <li>Filters may have excluded all transactions. Adjust the filters and try again.</li>
          </ul>
        </div>
      )}
      <TimelineGuideModal isOpen={isGuideModalOpen} onClose={() => setIsGuideModalOpen(false)} />
    </div>
  );
}