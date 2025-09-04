import { useState, useEffect, useCallback } from 'react';
import { random, mean, std } from 'mathjs';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, ChartOptions, TooltipItem } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

// Prop tiplerini tanımlıyoruz
interface RugCheckData {
  insiderHoldings: number;
  totalSupply: number;
}

interface TimelineEvent {
  timestamp: string;
  price: number;
  buy?: { wallet: string; amount: number };
  sell?: { wallet: string; amount: number };
}

interface PriceSimulationWidgetProps {
  contractAddress: string;
  rugCheckData: RugCheckData | null;
  timelineData: TimelineEvent[];
}

const PriceSimulationWidget: React.FC<PriceSimulationWidgetProps> = ({
  rugCheckData = null,
  timelineData = [],
}) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0.01);
  const [simulationData, setSimulationData] = useState<number[][]>([]);
  const [volatility, setVolatility] = useState<number>(0.1);
  const [steps, setSteps] = useState<number>(30);
  const [simulations, setSimulations] = useState<number>(100);
  const [userVolatility, setUserVolatility] = useState<number>(volatility);
  const [userSteps, setUserSteps] = useState<number>(steps);
  const [userSimulations, setUserSimulations] = useState<number>(simulations);
  const [insiderSellImpact, setInsiderSellImpact] = useState<number>(0.05);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!timelineData || timelineData.length <= 1) {
      setError('Not enough schedule data found.');
      return;
    }

    try {
      const prices = timelineData.map((event) => event.price || 0.01);
      setCurrentPrice(prices[prices.length - 1]);

      const returns = prices.slice(1).map((price, index) => (price - prices[index]) / prices[index]);
      const calculatedVolatility = Number(std(returns)) || 0.1;
      setVolatility(calculatedVolatility);
      setUserVolatility(calculatedVolatility);
      setError(null);
    } catch (err) {
      console.error('Volatilite hesaplamasında hata:', err);
      setError('Veri işlenirken bir hata oluştu.');
    }
  }, [timelineData]);

  useEffect(() => {
    setVolatility(userVolatility);
    setSteps(userSteps);
    setSimulations(userSimulations);
  }, [userVolatility, userSteps, userSimulations]);

  const runMonteCarloSimulation = useCallback(() => {
    try {
      const results: number[][] = [];

      for (let i = 0; i < simulations; i++) {
        const simulation: number[] = [currentPrice];
        let price = currentPrice;

        for (let j = 0; j < steps; j++) {
          const change = price * volatility * (random() - 0.5);
          price += change;

          if (rugCheckData?.insiderHoldings && j % 10 === 0) {
            const sellRatio = rugCheckData.insiderHoldings / rugCheckData.totalSupply;
            price *= 1 - sellRatio * insiderSellImpact;
          }

          simulation.push(price > 0 ? price : 0.01);
        }
        results.push(simulation);
      }

      setSimulationData(results);
    } catch (err) {
      console.error('Monte Carlo simülasyonunda hata:', err);
      setError('Simülasyon çalıştırılırken bir hata oluştu.');
    }
  }, [currentPrice, volatility, steps, simulations, rugCheckData, insiderSellImpact]);

  useEffect(() => {
    if (currentPrice > 0) {
      runMonteCarloSimulation();
    }
  }, [currentPrice, volatility, steps, simulations, rugCheckData, insiderSellImpact, runMonteCarloSimulation]);

  const averageSimulation = simulationData.length
    ? simulationData[0].map((_, index) =>
        mean(simulationData.map((sim) => sim[index]))
      )
    : [];

  const chartData = {
    labels: Array.from({ length: steps + 1 }, (_, i) => `Day ${i}`),
    datasets: [
      {
        label: 'Average Price Simulation',
        data: averageSimulation,
        borderColor: 'var(--accent-turquoise)',
        fill: false,
      },
      ...simulationData.slice(0, 5).map((sim, index) => ({
        label: `Simulation ${index + 1}`,
        data: sim,
        borderColor: `rgba(128, 128, 128, 0.2)`,
        fill: false,
        borderWidth: 1,
      })),
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: TooltipItem<'line'>): string => {
            const day = context.dataIndex;
            const price = context.parsed.y.toFixed(2);
            const insiderEvent = timelineData?.find((event) => event.timestamp === `Day ${day}`);
            if (insiderEvent?.sell) {
              return `Price: $${price} (Insider Sell: ${insiderEvent.sell.amount} tokens)`;
            } else if (insiderEvent?.buy) {
              return `Price: $${price} (Insider Buy: ${insiderEvent.buy.amount} tokens)`;
            }
            return `Price: $${price}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category', // x ekseni için "category" ölçeğini açıkça belirtiyoruz
        title: { display: true, text: 'Days' },
        ticks: { maxTicksLimit: 10 },
      },
      y: {
        type: 'linear', // y ekseni için "linear" ölçeğini açıkça belirtiyoruz
        title: { display: true, text: 'Price (USD)' },
        beginAtZero: true,
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
  };

  if (error) {
    return <div className="cyber-widget dystopian-panel"><p className="error">{error}</p></div>;
  }

  return (
    <div className="cyber-widget dystopian-panel">
      <h2 className="widget-title">Price Simulation</h2>
      <div className="simulation-controls">
        <label>
          Simulation Duration (days):
          <input
            type="number"
            value={userSteps}
            onChange={(e) => setUserSteps(parseInt(e.target.value))}
            min="1"
            max="90"
            className="cyber-input dystopian-input"
          />
        </label>
        <label>
          Volatility (%):
          <input
            type="number"
            value={(userVolatility * 100).toFixed(2)}
            onChange={(e) => setUserVolatility(parseFloat(e.target.value) / 100)}
            min="0"
            max="100"
            step="0.1"
            className="cyber-input dystopian-input"
          />
        </label>
        <label>
          Number of Simulations:
          <input
            type="number"
            value={userSimulations}
            onChange={(e) => setUserSimulations(parseInt(e.target.value))}
            min="10"
            max="1000"
            className="cyber-input dystopian-input"
          />
        </label>
        <label>
          Insider Sell Impact (%):
          <input
            type="number"
            value={(insiderSellImpact * 100).toFixed(2)}
            onChange={(e) => setInsiderSellImpact(parseFloat(e.target.value) / 100)}
            min="0"
            max="50"
            step="0.1"
            className="cyber-input dystopian-input"
          />
        </label>
      </div>
      {timelineData.length > 0 ? (
        <div className="chart-container">
          <Line data={chartData} options={chartOptions} />
        </div>
      ) : (
        <p className="no-data">No price data available for simulation. Try another token address.</p>
      )}
    </div>
  );
};

export default PriceSimulationWidget;