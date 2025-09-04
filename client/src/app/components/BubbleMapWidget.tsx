'use client';

import { useEffect, useRef } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import { formatNumber } from '@utils/helpers';
import { FilterState, Wallet, BubbleData } from '@utils/types';

interface BubbleMapWidgetProps {
  bubbleData: BubbleData;
  results: {
    earlyBuyers: Wallet[];
    holders: Wallet[];
    activeTraders: Wallet[];
    largeSellers: Wallet[];
  };
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  selectedWallet: string | null;
  setSelectedWallet: (wallet: string | null) => void;
  followedWallets: string[];
  followWallet: (address: string) => Promise<void>;
  formatNumber: (num: number) => string;
  exportWallets: () => void;
  bubbleFilters: FilterState;
  setBubbleFilters: (filters: FilterState) => void;
}

export default function BubbleMapWidget({
  bubbleData,
  results,
  zoomLevel,
  setZoomLevel,
  selectedWallet,
  setSelectedWallet,
  followedWallets,
  followWallet,
  formatNumber,
  exportWallets,
  bubbleFilters,
  setBubbleFilters,
}: BubbleMapWidgetProps) {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<Core | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Filtreleme fonksiyonu
  const filterBubbleData = (): BubbleData => {
    if (!bubbleData?.nodes || !bubbleData?.edges) {
      console.warn('BubbleMapWidget: No nodes or edges provided');
      return { nodes: [], edges: [] };
    }

    const now = Date.now();
    const timeRanges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      all: Infinity,
    } as const;

    type TimeRangeKey = keyof typeof timeRanges;

    const filteredEdges = bubbleData.edges
      .map((edge: { source: string; target: string; amount: number; timestamp: string }) => ({
        ...edge,
        amount: Number(edge.amount),
      }))
      .filter((edge: { source: string; target: string; amount: number; timestamp: string }) => {
        if (
          !edge?.source ||
          !edge?.target ||
          !edge?.timestamp ||
          edge?.amount === undefined ||
          isNaN(edge.amount)
        ) {
          console.warn('Invalid edge data:', edge);
          return false;
        }
        const edgeTimestamp = new Date(edge.timestamp).getTime();
        const timeRangeValue = timeRanges[bubbleFilters.timeRange as TimeRangeKey] || Infinity;
        const isWithinTimeRange = now - edgeTimestamp <= timeRangeValue;
        const isAboveMinAmount = edge.amount >= bubbleFilters.minAmount;
        return isWithinTimeRange && isAboveMinAmount;
      });

    const nodeIds = new Set<string>();
    filteredEdges.forEach((edge: { source: string; target: string }) => {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    });

    const walletTypeOptions = ['earlyBuyers', 'holders', 'activeTraders', 'largeSellers', 'all'] as const;
    type WalletType = (typeof walletTypeOptions)[number];

    if (bubbleFilters.walletType !== 'all' && walletTypeOptions.includes(bubbleFilters.walletType as WalletType)) {
      const walletType = bubbleFilters.walletType as keyof typeof results;
      const relevantWallets = results[walletType]?.map((w: Wallet) => w.address) || [];
      nodeIds.forEach((id) => {
        if (!relevantWallets.includes(id)) {
          nodeIds.delete(id);
        }
      });
      filteredEdges.splice(
        0,
        filteredEdges.length,
        ...filteredEdges.filter((edge: { source: string; target: string }) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      );
    }

    // Top 150 cüzdanı seç
    const filteredNodes = bubbleData.nodes
      .map((node: { id: string; balance: number }) => ({
        ...node,
        balance: Number(node.balance),
      }))
      .filter((node: { id: string; balance: number }) => {
        if (!node?.id || node?.balance === undefined || isNaN(node.balance)) {
          console.warn('Invalid node data:', node);
          return false;
        }
        return nodeIds.has(node.id);
      })
      .sort((a: { balance: number }, b: { balance: number }) => b.balance - a.balance) // Bakiyeye göre sırala
      .slice(0, 150); // En büyük 150 cüzdanı al

    // Filtrelenmiş node'lara uygun edge'ları güncelle
    const finalNodeIds = new Set(filteredNodes.map((node: { id: string }) => node.id));
    const finalEdges = filteredEdges.filter(
      (edge: { source: string; target: string }) => finalNodeIds.has(edge.source) && finalNodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: finalEdges };
  };

  const filteredBubbleData = filterBubbleData();

  // Initialize Cytoscape for Bubble Map
  useEffect(() => {
    if (!cyRef.current || !filteredBubbleData.nodes.length || !filteredBubbleData.edges.length) {
      console.log('BubbleMapWidget: No valid data to render');
      return;
    }

    // Toplam token arzını hesapla (rug pull tespiti için)
    const totalSupply = filteredBubbleData.nodes.reduce((sum: number, node: { balance: number }) => sum + node.balance, 0);

    const cy = cytoscape({
      container: cyRef.current,
      elements: [
        ...filteredBubbleData.nodes.map((node: { id: string; balance: number }) => ({
          data: { id: node.id, balance: node.balance, label: `${node.id.slice(0, 6)}...${node.id.slice(-4)}` },
        })),
        ...filteredBubbleData.edges.map((edge: { source: string; target: string; amount: number; timestamp: string }) => ({
          data: {
            source: edge.source,
            target: edge.target,
            amount: edge.amount,
            timestamp: edge.timestamp,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: NodeSingular) => {
              const wallet = results.earlyBuyers
                .concat(results.holders, results.activeTraders, results.largeSellers)
                .find((w) => w.address === ele.data('id'));
              const balance = Number(ele.data('balance'));
              // Rug pull riski: Toplam arzın %10'undan fazlasını tutan cüzdanlar kırmızı
              if (totalSupply > 0 && balance / totalSupply > 0.1) {
                return '#ff0000'; // Potansiyel balina veya rug pull riski
              }
              return wallet?.isEarlyBuyer
                ? 'var(--accent-turquoise)'
                : wallet?.isHolder
                ? 'var(--accent-purple)'
                : wallet?.isActiveTrader
                ? 'var(--accent-gray)'
                : '#4b5563';
            },
            label: 'data(label)',
            width: (ele: NodeSingular) => {
              const balance = Number(ele.data('balance'));
              return isNaN(balance) ? 20 : Math.max(20, Math.min(100, Math.log(balance + 1) * 10)); // Logaritmik ölçek
            },
            height: (ele: NodeSingular) => {
              const balance = Number(ele.data('balance'));
              return isNaN(balance) ? 20 : Math.max(20, Math.min(100, Math.log(balance + 1) * 10)); // Logaritmik ölçek
            },
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            color: '#e2e8f0',
            'overlay-color': 'var(--accent-turquoise)',
            'overlay-opacity': 0,
            'overlay-padding': 5,
            'transition-property': 'background-color, overlay-opacity',
            'transition-duration': '0.3s' as any,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'var(--accent-turquoise)',
            width: (ele: EdgeSingular) => {
              const amount = Number(ele.data('amount'));
              return isNaN(amount) ? 1 : Math.log(amount + 1) * 2; // Logaritmik ölçek
            },
            'curve-style': 'bezier',
            'opacity': 0.7,
            'transition-property': 'opacity, line-color',
            'transition-duration': 300, // 0.3s = 300ms
          },
        },
        {
          selector: 'node:hover',
          style: {
            'overlay-opacity': 0.5,
            'overlay-padding': 8,
          },
        },
        {
          selector: 'edge:hover',
          style: {
            'line-color': 'var(--accent-purple)',
            opacity: 1,
          },
        },
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: () => 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: () => 400000,
        edgeElasticity: () => 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
      zoom: zoomLevel,
      minZoom: 0.5,
      maxZoom: 3,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      const nodeId = node.data('id') as string;
      if (nodeId) {
        setSelectedWallet(nodeId);
        cy.edges(`[source="${nodeId}"],[target="${nodeId}"]`).animate(
          {
            style: { 'line-color': 'var(--accent-purple)', opacity: 1 },
          },
          { duration: 500 }
        ).delay(500).animate(
          {
            style: { 'line-color': 'var(--accent-turquoise)', opacity: 0.7 },
          },
          { duration: 500 }
        );
      }
    });

    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      const nodeId = node.data('id') as string;
      const balance = Number(node.data('balance'));
      const wallet = results.earlyBuyers
        .concat(results.holders, results.activeTraders, results.largeSellers)
        .find((w) => w.address === nodeId);

      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip dystopian-panel';
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${evt.originalEvent.clientY - 50}px`;
      tooltip.style.left = `${evt.originalEvent.clientX + 10}px`;
      tooltip.innerHTML = `
        Wallet: ${nodeId.slice(0, 6)}...${nodeId.slice(-4)}<br/>
        Balance: ${formatNumber(balance)} tokens<br/>
        Type: ${wallet?.walletLabel || 'Unknown'}<br/>
        Supply Share: ${totalSupply > 0 ? ((balance / totalSupply) * 100).toFixed(2) : 'N/A'}%
      `;
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    });

    cy.on('mouseout', 'node', () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    });

    cyInstanceRef.current = cy;

    return () => {
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
    };
  }, [filteredBubbleData, zoomLevel, results, setSelectedWallet, formatNumber]);

  // Update zoom level
  useEffect(() => {
    if (cyInstanceRef.current) {
      cyInstanceRef.current.zoom(zoomLevel);
      cyInstanceRef.current.center();
    }
  }, [zoomLevel]);

  // selectedWalletData hesaplaması
  const selectedWalletData = selectedWallet
    ? results.earlyBuyers
        .concat(results.holders, results.activeTraders, results.largeSellers)
        .find((w) => w.address === selectedWallet) || null
    : null;

  const zoomBubbleMap = (direction: 'in' | 'out') => {
    setZoomLevel(Math.max(0.5, Math.min(3, direction === 'in' ? zoomLevel * 1.2 : zoomLevel / 1.2)));
  };

  return (
    <div className="cyber-widget bubble-map-widget full-width dystopian-panel">
      <h2 className="widget-title">Bubble Map Galaxy</h2>
      <div className="bubble-controls">
        <div className="filter-controls">
          <div className="filter-group">
            <label className="filter-label">Min Transfer Amount:</label>
            <input
              type="range"
              min="0"
              max="1000000"
              step="1000"
              value={bubbleFilters.minAmount}
              onChange={(e) =>
                setBubbleFilters({ ...bubbleFilters, minAmount: Number(e.target.value) })
              }
              className="bubble-slider dystopian-input"
            />
            <span className="filter-value">{formatNumber(bubbleFilters.minAmount)} tokens</span>
          </div>
          <div className="filter-group">
            <label className="filter-label">Wallet Type:</label>
            <select
              value={bubbleFilters.walletType}
              onChange={(e) =>
                setBubbleFilters({
                  ...bubbleFilters,
                  walletType: e.target.value as FilterState['walletType'],
                })
              }
              className="cyber-select dystopian-input"
            >
              <option value="all">All</option>
              <option value="earlyBuyers">Early Buyers</option>
              <option value="holders">Holders</option>
              <option value="activeTraders">Active Traders</option>
              <option value="largeSellers">Large Sellers</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Time Range:</label>
            <select
              value={bubbleFilters.timeRange}
              onChange={(e) =>
                setBubbleFilters({
                  ...bubbleFilters,
                  timeRange: e.target.value as FilterState['timeRange'],
                })
              }
              className="cyber-select dystopian-input"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        <div className="zoom-controls">
          <button className="zoom-button dystopian-button" onClick={() => zoomBubbleMap('in')}>
            Zoom In
          </button>
          <button className="zoom-button dystopian-button" onClick={() => zoomBubbleMap('out')}>
            Zoom Out
          </button>
          <button className="cyber-button dystopian-button" onClick={() => cyInstanceRef.current?.fit()}>
            Fit to View
          </button>
          <button className="cyber-button dystopian-button export-button" onClick={exportWallets}>
            Export Graph
          </button>
        </div>
      </div>
      {filteredBubbleData.nodes.length > 0 && filteredBubbleData.edges.length > 0 ? (
        <div className="bubble-map-container dystopian-panel">
          <div ref={cyRef} className="bubble-map" style={{ width: '100%', height: '500px' }} />
          <div className="map-hint">Click to pin a wallet, hover for details</div>
          {selectedWalletData && (
            <div className="bubble-details dystopian-panel">
              <h3>Selected Wallet</h3>
              <p>
                <span>Address:</span>{' '}
                <a
                  href={`https://solscan.io/account/${selectedWalletData.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wallet-link"
                >
                  {selectedWalletData.address.slice(0, 6)}...{selectedWalletData.address.slice(-4)}
                </a>
              </p>
              <p>
                <span>Balance:</span> {formatNumber(selectedWalletData.totalAmount)} tokens
              </p>
              <p>
                <span>Insider Score:</span> {selectedWalletData.score ?? 'N/A'}%
              </p>
              <p>
                <span>Type:</span> {selectedWalletData.walletLabel}
              </p>
              <p>
                <span>Total Volume:</span> {formatNumber(selectedWalletData.totalVolume)} tokens
              </p>
              <p>
                <span>Buys:</span> {selectedWalletData.buyCount}
              </p>
              <p>
                <span>Sells:</span> {selectedWalletData.sellCount}
              </p>
              <p>
                <span>Last Tx:</span> {selectedWalletData.lastTxTime}
              </p>
              <div className="bubble-actions">
                <button
                  className={`cyber-button dystopian-button ${
                    followedWallets.includes(selectedWalletData.address) ? 'unfollow' : 'follow'
                  }`}
                  onClick={() => followWallet(selectedWalletData.address)}
                >
                  {followedWallets.includes(selectedWalletData.address) ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  className="cyber-button dystopian-button"
                  onClick={() => setSelectedWallet(null)}
                >
                  Unpin
                </button>
              </div>
            </div>
          )}
          <div className="bubble-legend dystopian-panel">
            <h3>Legend</h3>
            <p>
              <span className="legend-color bg-accent-turquoise"></span> Early Buyers
            </p>
            <p>
              <span className="legend-color bg-accent-purple"></span> Holders
            </p>
            <p>
              <span className="legend-color bg-accent-gray"></span> Active Traders
            </p>
            <p>
              <span className="legend-color bg-dark-gray"></span> Unknown
            </p>
            <p>
              <span className="legend-color" style={{ backgroundColor: '#ff0000' }}></span> Potential Whale/Rug Pull Risk
            </p>
            <p>Node Size: Wallet Balance</p>
            <p>Edge Width: Transfer Amount</p>
          </div>
        </div>
      ) : (
        <div className="no-data">
          <p>No bubble map data available for the selected filters. Try:</p>
          <ul>
            <li>Reducing the minimum transfer amount ({formatNumber(bubbleFilters.minAmount)} tokens)</li>
            <li>Selecting a broader time range (currently {bubbleFilters.timeRange})</li>
            <li>Choosing "All" wallet types (currently {bubbleFilters.walletType})</li>
          </ul>
        </div>
      )}
    </div>
  );
}