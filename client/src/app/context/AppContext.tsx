// context/AppContext.tsx
'use client';
import { createContext, useState, useCallback } from 'react';

interface RugCheckData {
  insiderCount: number;
  insiderHoldings: number;
  totalSupply: number;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  burnedPercentage: number;
  liquidityLocked: number;
  liquidityLockDuration: string;
  contractRenounced: boolean;
  upgradeable: boolean;
  riskScore: number;
  reasons: string[];
}

interface BubbleData {
  nodes: { id: string; balance: number }[];
  edges: { source: string; target: string; amount: number; timestamp: string }[];
}

interface AppContextType {
  contractAddress: string;
  setContractAddress: (address: string) => void;
  rugCheckData: RugCheckData | null;
  setRugCheckData: (data: RugCheckData | null) => void;
  bubbleData: BubbleData;
  setBubbleData: (data: BubbleData) => void;
  rugCheckLoading: boolean;
  setRugCheckLoading: (loading: boolean) => void;
  bubbleLoading: boolean;
  setBubbleLoading: (loading: boolean) => void;
  error: string;
  setError: (error: string) => void;
  fetchRugCheckData: () => Promise<void>;
  fetchBubbleData: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [contractAddress, setContractAddress] = useState<string>('');
  const [rugCheckData, setRugCheckData] = useState<RugCheckData | null>(null);
  const [bubbleData, setBubbleData] = useState<BubbleData>({ nodes: [], edges: [] });
  const [rugCheckLoading, setRugCheckLoading] = useState<boolean>(false);
  const [bubbleLoading, setBubbleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchRugCheckData = useCallback(async () => {
    if (!contractAddress) return;
    setRugCheckLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/rug-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contractAddress }),
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setRugCheckData(data);
    } catch (error: any) {
      setError(`Failed to load rug check data: ${error.message}`);
    } finally {
      setRugCheckLoading(false);
    }
  }, [contractAddress]);

  const fetchBubbleData = useCallback(async () => {
    if (!contractAddress) return;
    setBubbleLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/token-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: contractAddress, limit: 30 }),
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setBubbleData(data);
    } catch (error: any) {
      setError(`Failed to load bubble map data: ${error.message}`);
    } finally {
      setBubbleLoading(false);
    }
  }, [contractAddress]);

  return (
    <AppContext.Provider
      value={{
        contractAddress,
        setContractAddress,
        rugCheckData,
        setRugCheckData,
        bubbleData,
        setBubbleData,
        rugCheckLoading,
        setRugCheckLoading,
        bubbleLoading,
        setBubbleLoading,
        error,
        setError,
        fetchRugCheckData,
        fetchBubbleData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}