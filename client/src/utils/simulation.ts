// src/app/utils/simulation.ts
import * as math from 'mathjs';
import { TimelineEvent } from './types';

export interface SimulationResult {
  newPrice: number;
  priceChangePercent: number;
  reasons: string[];
}

export const simulatePriceImpact = (
  currentPrice: number,
  totalSupply: number,
  liquidityLocked: number,
  sellAmount: number,
  timelineData: TimelineEvent[]
): SimulationResult => {
  // Fiyat hassasiyeti: Düşük likidite = yüksek etki
  const liquidityFactor = liquidityLocked < 50 ? 2.0 : liquidityLocked < 80 ? 1.0 : 0.5;

  // Satışın arz üzerindeki oranı
  const sellRatio = sellAmount / totalSupply;

  // Panik katsayısı: %5’ten büyük satışlar için ek etki
  const panicFactor = sellRatio > 0.05 ? 1.1 : 1.0;

  // Fiyat etkisi: Talep-arz modeli
  const priceImpact = sellRatio * liquidityFactor * panicFactor;
  const newPrice = currentPrice * (1 - priceImpact);

  // Geçmiş volatiliteyi hesapla
  const recentPrices: number[] = timelineData
    .slice(-10)
    .map((event) => (event.price !== undefined ? Number(event.price) : currentPrice)); // price yoksa currentPrice kullan
  const volatility =
    recentPrices.length > 1
      ? Number(math.std(recentPrices)) / Number(math.mean(recentPrices))
      : 0;
  const adjustedPrice = newPrice * (1 - volatility * 0.1);

  // Sonuçları hazırla
  const priceChangePercent = ((adjustedPrice - currentPrice) / currentPrice) * 100;
  const reasons: string[] = [];
  if (sellRatio > 0.05) reasons.push('Large sell detected, potential panic selling.');
  if (liquidityLocked < 50) reasons.push('Low liquidity increases price impact.');
  if (volatility > 0.2) reasons.push('High recent volatility may amplify price changes.');

  return {
    newPrice: Number(math.round(adjustedPrice, 4)),
    priceChangePercent: Number(math.round(priceChangePercent, 2)),
    reasons,
  };
};