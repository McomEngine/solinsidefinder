'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

export default function CyberNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { connected } = useWallet();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`cyber-navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Home butonu kaldırıldı, sadece başlık kalabilir veya tamamen kaldırılabilir */}
        <div className="cyber-title">DystoWorld</div>
        <button className="hamburger-menu" onClick={toggleMenu}>
          {isOpen ? '✖' : '☰'}
        </button>
        <div className={`navbar-menu ${isOpen ? 'open' : ''}`}>
          <div className="nav-buttons">
            <Link href="/dashboard">
              <button className={`nav-button ${pathname === '/dashboard' ? 'active' : ''}`}>
                Dashboard
              </button>
            </Link>
            <Link href="/timeline">
              <button className={`nav-button ${pathname === '/timeline' ? 'active' : ''}`}>
                Timeline
              </button>
            </Link>
            <Link href="/bubblemap">
              <button className={`nav-button ${pathname === '/bubblemap' ? 'active' : ''}`}>
                Bubble Map
              </button>
            </Link>
            <Link href="/raffle">
              <button className={`nav-button ${pathname === '/raffle' ? 'active' : ''}`}>
                Raffles
              </button>
            </Link>
          </div>
          <WalletMultiButton className="wallet-button--primary" />
        </div>
      </div>
    </nav>
  );
}