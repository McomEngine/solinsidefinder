'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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

interface NewsDetailProps {
  params: { id: string };
}

const NewsDetail: React.FC<NewsDetailProps> = ({ params }) => {
  const router = useRouter();
  const [newsItem, setNewsItem] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchNewsDetail = async () => {
      try {
        setLoading(true);
        const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY || 'YOUR_API_KEY';
        const response = await fetch(
          `https://newsapi.org/v2/everything?q=Donald+Trump+OR+cryptocurrency&apiKey=${apiKey}&language=en`
        );
        const data = await response.json();
        if (data.status === 'ok') {
          const article = data.articles.find((item: any, index: number) => {
            const generatedId = item.source.name.includes('Trump')
              ? `trump-${index}-${Date.now()}`
              : `crypto-${index}-${Date.now()}`;
            return generatedId === params.id;
          });
          if (article) {
            setNewsItem({ ...article, id: params.id });
          } else {
            setError('Haber bulunamadı.');
          }
        } else {
          setError('Haber yüklenemedi.');
        }
      } catch (err) {
        setError('Bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };

    fetchNewsDetail();
  }, [params.id]);

  if (loading) {
    return (
      <div className="dystopian-panel">
        <h1>Haber Yükleniyor</h1>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (error || !newsItem) {
    return (
      <div className="dystopian-panel">
        <h1>Hata</h1>
        <p>{error || 'Haber bulunamadı.'}</p>
        <button className="cyber-button dystopian-button" onClick={() => router.push('/crypto-news')}>
          Geri Dön
        </button>
      </div>
    );
  }

  return (
    <div className="dystopian-panel news-detail">
      <button
        className="cyber-button dystopian-button"
        onClick={() => router.push('/crypto-news')}
        style={{ marginBottom: '1rem' }}
      >
        Geri Dön
      </button>
      <h1>{newsItem.title}</h1>
      {newsItem.urlToImage && (
        <Image
          src={newsItem.urlToImage} // Düzeltildi: item yerine newsItem
          alt={newsItem.title}
          width={600}
          height={400}
          className="news-detail-image"
        />
      )}
      <p className="news-meta">
        <strong>{newsItem.source.name}</strong> -{' '}
        {new Date(newsItem.publishedAt).toLocaleDateString()}
      </p>
      <p>{newsItem.description || 'Açıklama mevcut değil.'}</p>
      {newsItem.content && <p>{newsItem.content}</p>}
      <a
        href={newsItem.url}
        target="_blank"
        rel="noopener noreferrer"
        className="cyber-button dystopian-button"
      >
        Haberi Kaynakta Oku
      </a>
    </div>
  );
};

export default NewsDetail;