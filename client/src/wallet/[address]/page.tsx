"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface WalletProfile {
  address: string;
  totalTransactions: number;
  uniqueTokens: number;
  successRate: string;
  lastActive: string;
}

export default function WalletProfile() {
  const params = useParams();
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // useEffect'i koşulsuz olarak çağır
  useEffect(() => {
    // params kontrolünü useEffect içinde yap
    if (!params) return;

    const { address } = params as { address: string };
    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/wallet/${address}`);
        const data = await response.json();
        if (response.ok && data.profile) {
          setProfile(data.profile);
        } else {
          setError(data.error || "Unable to fetch wallet profile.");
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setError(`Error: ${errorMessage}. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params]); // Bağımlılık olarak params'ı ekle

  // params kontrolü burada yapılarak erken dönüş yapılır
  if (!params) {
    return <div className="min-h-screen bg-gray-900 text-white font-sans flex items-center justify-center">Error: Address parameter is missing.</div>;
  }
  const { address } = params as { address: string };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white font-sans flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-6 max-w-5xl">
        <h1 className="text-5xl font-extrabold text-center mb-10 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
          Wallet Profile
        </h1>

        {error && <p className="text-red-500 font-medium mb-4">{error}</p>}

        {profile && (
          <div className="bg-gray-800 neon-glow rounded-xl p-6">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">
              Wallet: {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-700 p-3 rounded-lg neon-glow text-center">
                <p className="text-sm font-bold text-cyan-400">Total Transactions</p>
                <p className="text-white">{profile.totalTransactions}</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg neon-glow text-center">
                <p className="text-sm font-bold text-cyan-400">Unique Tokens</p>
                <p className="text-white">{profile.uniqueTokens}</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg neon-glow text-center">
                <p className="text-sm font-bold text-cyan-400">Success Rate</p>
                <p className="text-white">{profile.successRate}%</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg neon-glow text-center">
                <p className="text-sm font-bold text-cyan-400">Last Active</p>
                <p className="text-white">{profile.lastActive}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}