'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface NewsItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  publishedAt: string;
  source: { name: string };
  urlToImage: string | null;
  content: string | null;
}

const CryptoNews: React.FC = () => {
  const [trumpNews, setTrumpNews] = useState<NewsItem[]>([]);
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY || 'YOUR_API_KEY';
        const trumpResponse = await fetch(
          `https://newsapi.org/v2/everything?q=Donald+Trump&apiKey=${apiKey}&language=en&sortBy=publishedAt&pageSize=10`
        );
        const trumpData = await trumpResponse.json();
        if (trumpData.status === 'ok') {
          const trumpArticles = trumpData.articles.map((article: any, index: number) => ({
            ...article,
            id: `trump-${index}-${Date.now()}`,
          }));
          setTrumpNews(trumpArticles);
        } else {
          setError('Trump haberleri yüklenemedi.');
        }
        const cryptoResponse = await fetch(
          `https://newsapi.org/v2/everything?q=cryptocurrency&apiKey=${apiKey}&language=en&sortBy=publishedAt&pageSize=10`
        );
        const cryptoData = await cryptoResponse.json();
        if (cryptoData.status === 'ok') {
          const cryptoArticles = cryptoData.articles.map((article: any, index: number) => ({
            ...article,
            id: `crypto-${index}-${Date.now()}`,
          }));
          setCryptoNews(cryptoArticles);
        } else {
          setError('Kripto haberleri yüklenemedi.');
        }
      } catch (err) {
        setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  if (loading) return <div className="dystopian-panel">Yükleniyor...</div>;
  if (error) return <div className="dystopian-panel">{error}</div>;

  return (
    <div className="dystopian-panel news-container">
      <h1>Kripto ve Trump Haberler</h1>
      <section className="news-section">
        <h2>Donald Trump ile İlgili Haberler</h2>
        <div className="news-grid">
          {trumpNews.map((item) => (
            <Link href={`/news/${item.id}`} key={item.id} className="news-card">
              {item.urlToImage && (
                <Image
                  src={item.urlToImage}
                  alt={item.title}
                  width={300}
                  height={200}
                  className="news-image"
                />
              )}
              <h3>{item.title}</h3>
              <p>{item.description || 'Açıklama mevcut değil.'}</p>
              <p className="news-meta">
                <small>
                  {item.source.name} - {new Date(item.publishedAt).toLocaleDateString()}
                </small>
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="news-section">
        <h2>Güncel Kripto Haberler</h2>
        <div className="news-grid">
          {cryptoNews.map((item) => (
            <Link href={`/news/${item.id}`} key={item.id} className="news-card">
              {item.urlToImage && (
                <Image
                  src={item.urlToImage}
                  alt={item.title}
                  width={300}
                  height={200}
                  className="news-image"
                />
              )}
              <h3>{item.title}</h3>
              <p>{item.description || 'Açıklama mevcut değil.'}</p>
              <p className="news-meta">
                <small>
                  {item.source.name} - {new Date(item.publishedAt).toLocaleDateString()}
                </small>
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CryptoNews;