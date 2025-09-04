'use client';
import { useState } from 'react';
import { supabase } from '@lib/supabase';
import { PublicKey } from '@solana/web3.js';

export default function AllowlistManager() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<string[]>([]);

  const fetchAddresses = async () => {
    const { data, error } = await supabase.from('allowlist').select('wallet_address');
    if (error) {
      setError('Error fetching addresses: ' + error.message);
    } else {
      setAddresses(data?.map((item: { wallet_address: string }) => item.wallet_address) || []);
    }
  };

  const addAddress = async () => {
    setError(null);
    
    // Check if the wallet address is a valid Solana address
    try {
      new PublicKey(address); // Throws an error if the address is invalid
    } catch (err) {
      setError('Invalid Solana wallet address.');
      return;
    }

    const { error: insertError } = await supabase.from('allowlist').insert({
      wallet_address: address,
    });

    if (insertError) {
      setError('Error adding address: ' + insertError.message);
    } else {
      setAddress('');
      fetchAddresses();
    }
  };

  const removeAddress = async (addressToRemove: string) => {
    const { error } = await supabase
      .from('allowlist')
      .delete()
      .eq('wallet_address', addressToRemove);

    if (error) {
      setError('Error removing address: ' + error.message);
    } else {
      fetchAddresses();
    }
  };

  return (
    <div className="neon-panel">
      <h2 className="neon-title">Allowlist Manager</h2>
      {error && <p className="error-text">{error}</p>}
      <div className="form-group">
        <label className="neon-label">Wallet Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter wallet address"
          className="neon-input"
        />
      </div>
      <button onClick={addAddress} className="neon-button">
        Add Address
      </button>
      <div className="followed-wallets-list">
        {addresses.map((addr) => (
          <div key={addr} className="followed-wallet-card">
            <div className="wallet-info">
              <span className="wallet-address">{addr}</span>
            </div>
            <button
              className="unfollow-button"
              onClick={() => removeAddress(addr)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}