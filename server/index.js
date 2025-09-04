const express = require("express");
const { Connection, PublicKey } = require("@solana/web3.js");
const cors = require("cors");
const axios = require("axios");
const redis = require("redis");
const { Metaplex } = require("@metaplex-foundation/js");
require("dotenv").config();

// Üretim ortamında gereksiz logları kapat
if (process.env.NODE_ENV === "production") {
  console.log = () => {};
  console.info = () => {};
}

console.log("Starting server initialization...");

const app = express();

// Ortam değişkenlerini kontrol et
console.log("REDIS_URL:", process.env.REDIS_URL ? "Defined" : "Undefined");
console.log("RPC_URL:", process.env.RPC_URL ? "Defined" : "Undefined");
console.log("NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL ? "Defined" : "Undefined");
console.log("HELIUS_API_KEY:", process.env.HELIUS_API_KEY ? "Defined" : "Undefined");
console.log("NODE_ENV:", process.env.NODE_ENV || "development");

// Ortam değişkenlerini doğrula
if (!process.env.REDIS_URL) {
  console.error("Hata: REDIS_URL ortam değişkeni tanımlı değil. Lütfen .env dosyasında REDIS_URL'yi kontrol edin.");
  process.exit(1);
}

if (!process.env.RPC_URL) {
  console.error("Hata: RPC_URL ortam değişkeni tanımlı değil. Lütfen .env dosyasını kontrol edin.");
  process.exit(1);
}

if (!process.env.HELIUS_API_KEY) {
  console.error("Hata: HELIUS_API_KEY ortam değişkeni tanımlı değil. Lütfen .env dosyasını kontrol edin.");
  process.exit(1);
}

// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: false,
    connectTimeout: 10000,
    keepAlive: 5000,
    reconnectStrategy: (retries) => {
      console.log(`Redis reconnect attempt ${retries}`);
      if (retries >= 5) return new Error("Max retries reached for Redis");
      return Math.min(retries * 1000, 5000);
    },
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("Redis Client Connected");
});

redisClient.on("ready", () => {
  console.log("Redis Client Ready");
});

redisClient.on("reconnecting", () => {
  console.log("Redis Client Reconnecting");
});

// Redis bağlantısını asenkron olarak başlat
async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("Redis connection established");
  } catch (err) {
    console.error("Redis Connection Failed:", err.message);
  }
}
connectRedis();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3002",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/health", (req, res) => {
  console.log("Health endpoint called");
  res.json({ status: "Server is running" });
});

const connection = new Connection(process.env.RPC_URL, "confirmed");
const metaplex = Metaplex.make(connection);

// Retry fonksiyonu (tüm endpoint'ler için)
async function withRetry(fn, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.message.includes("429") && i < retries - 1) {
        console.log(`429 Too Many Requests, retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries reached");
}

// Genel fiyat alma fonksiyonu (Dexscreener birincil)
async function getTokenPrice(address, timestamp = null) {
  const cacheKey = `price:${address}:${timestamp || "latest"}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for price: ${address}`);
      return parseFloat(cached);
    }

    // Dexscreener'dan fiyat al
    let price = await getTokenPriceFromDexscreener(address);
    if (price === 0) {
      console.warn(`No price data for ${address}, using default`);
      price = 0.01; // Varsayılan fiyat
    }

    await redisClient.setEx(cacheKey, 300, price.toString()); // Önbellek süresi 5 dakika
    return price;
  } catch (err) {
    console.error(`Price fetch error for ${address}: ${err.message}`);
    return 0.01; // Hata durumunda varsayılan fiyat
  }
}

// Fetch price from Dexscreener API (birincil kaynak)
async function getTokenPriceFromDexscreener(address) {
  const cacheKey = `price:dexscreener:${address}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for Dexscreener price: ${address}`);
      return parseFloat(cached);
    }

    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { timeout: 5000 } // 5 saniye timeout
    );
    const pair = response.data.pairs?.[0];
    const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
    await redisClient.setEx(cacheKey, 300, price.toString()); // Önbellek süresi 5 dakika
    return price;
  } catch (err) {
    console.error(`Dexscreener price fetch error for ${address}: ${err.message}`);
    return 0;
  }
}

// Yeni uç nokta: Token fiyatını almak için
app.get('/api/token-price', async (req, res) => {
  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ error: 'Contract address is required' });
  }

  try {
    const price = await getTokenPrice(address);
    res.json({ price });
  } catch (error) {
    console.error('Error fetching token price:', error.message);
    res.status(500).json({ error: `Failed to fetch token price: ${error.message}` });
  }
});

// Helper function for batch RPC calls
async function batchGetSignatures(addresses) {
  const batch = addresses.map((address) => ({
    method: "getSignaturesForAddress",
    params: [address, { limit: 25 }],
  }));

  try {
    const response = await axios.post(process.env.RPC_URL, batch, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data.map((res) => res.result || []);
  } catch (err) {
    console.error(`Batch signatures fetch error: ${err.message}`);
    return [];
  }
}

// Helper function to split array into chunks
const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// Calculate Gini coefficient
function calculateGiniCoefficient(holders) {
  const sortedBalances = holders
    .map((h) => h.totalAmount)
    .sort((a, b) => a - b);
  const n = sortedBalances.length;
  let sumOfDifferences = 0;
  let sumOfBalances = 0;
  sortedBalances.forEach((balance, i) => {
    sumOfBalances += balance;
    sumOfDifferences += balance * (n - i);
  });
  const gini = sumOfBalances
    ? 1 - (2 * sumOfDifferences) / (n * sumOfBalances)
    : 0;
  return gini;
}

// Calculate accumulation details
function calculateAccumulationDetails(walletMap, totalSupply) {
  const holders = Object.values(walletMap).filter(
    (wallet) => wallet.totalAmount > 0
  );
  const totalWallets = holders.length || 1;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const longTermHolders = holders.filter(
    (wallet) =>
      wallet.firstTxTime < sevenDaysAgo &&
      wallet.transactions.every((tx) => tx.type !== "sell")
  ).length;

  const traders = holders.filter((wallet) =>
    wallet.transactions.some(
      (tx) => tx.timestamp > sevenDaysAgo && tx.type === "sell"
    )
  ).length;

  const whaleThreshold = totalSupply * 0.05;
  const whales = holders.filter(
    (wallet) => wallet.totalAmount > whaleThreshold
  ).length;

  return {
    longTermHolderRatio: (longTermHolders / totalWallets) * 100,
    traderRatio: (traders / totalWallets) * 100,
    whaleRatio: (whales / totalWallets) * 100,
    accumulationScore: Math.min((longTermHolders / totalWallets) * 100, 100),
  };
}

// Helper function to get total token supply
async function getTokenSupply(tokenAddress) {
  try {
    const mintInfo = await metaplex
      .tokens()
      .findMintByAddress({ address: new PublicKey(tokenAddress) });
    return (
      Number(mintInfo.supply.basisPoints) / Math.pow(10, mintInfo.decimals) || 1
    );
  } catch (err) {
    console.error(`Error fetching total supply for ${tokenAddress}: ${err.message}`);
    return 1;
  }
}

// Wallet analysis function
async function analyzeWallets(transactions, signatures, tokenAddress) {
  console.log(`Starting wallet analysis for ${tokenAddress}, transactions: ${transactions.length}`);
  const walletMap = {};
  const totalSupply = await getTokenSupply(tokenAddress);
  const largeSellThreshold = totalSupply * 0.01;
  const firstTxTime = signatures[0]?.blockTime
    ? new Date(signatures[0].blockTime * 1000).getTime()
    : Date.now();
  const now = Date.now();
  const tokenAgeHours = (now - firstTxTime) / (1000 * 60 * 60);
  const earlyBuyThreshold = tokenAgeHours < 24 ? 1 : tokenAgeHours < 168 ? 12 : 48;

  transactions.forEach((tx, index) => {
    if (
      !tx ||
      !tx.meta ||
      !tx.transaction ||
      !tx.meta.preTokenBalances ||
      !tx.meta.postTokenBalances
    ) {
      console.log(`Skipping invalid transaction at index ${index}`);
      return;
    }

    const timestamp = signatures[index].blockTime
      ? new Date(signatures[index].blockTime * 1000).toISOString()
      : "Unknown";
    const txTime = signatures[index].blockTime
      ? new Date(signatures[index].blockTime * 1000).getTime()
      : now;

    tx.meta.postTokenBalances.forEach((postBalance, idx) => {
      const owner = postBalance.owner;
      if (
        !postBalance.uiTokenAmount ||
        !tx.meta.preTokenBalances[idx]?.uiTokenAmount
      ) {
        console.log(`Skipping invalid balance for owner ${owner} at index ${idx}`);
        return;
      }

      const preBalance = tx.meta.preTokenBalances[idx].uiTokenAmount.uiAmount || 0;
      const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
      const amount = postAmount - preBalance;
      const type = amount > 0 ? "buy" : amount < 0 ? "sell" : "neutral";

      if (amount !== 0) {
        if (!walletMap[owner]) {
          walletMap[owner] = {
            address: owner,
            transactions: [],
            totalAmount: 0,
            score: 0,
            scoreDetails: {
              earlyBuy: 0,
              profitability: 0,
              network: 0,
              time: 0,
              amount: 0,
              duration: 0,
              pumpDump: 0,
              largeSellImpact: 0,
            },
            firstTxTime: timestamp,
            lastTxTime: timestamp,
            holdingDuration: 0,
            isEarlyBuyer: false,
            isHolder: true,
            isActiveTrader: false,
            buyCount: 0,
            sellCount: 0,
            totalVolume: 0,
            avgTradeSize: 0,
            tradeFrequency: 0,
            otherTokenActivity: 0,
            solBalance: 0,
            mostProfitableTrade: { amount: 0, timestamp: "N/A" },
            profitableTradeRatio: 0,
            walletLabel: "Standard",
            buyTimestamps: [],
            sellTimestamps: [],
            profitEstimates: [],
            isLongTermHolder: false,
            isWhale: false,
          };
        }

        walletMap[owner].transactions.push({
          signature: signatures[index].signature,
          amount: Math.abs(amount),
          timestamp,
          type,
          txTime,
        });
        walletMap[owner].totalAmount += amount;
        walletMap[owner][type === "buy" ? "buyCount" : "sellCount"] += 1;
        walletMap[owner].totalVolume += Math.abs(amount);
        walletMap[owner].lastTxTime = timestamp;

        if (type === "sell" && Math.abs(amount) > largeSellThreshold) {
          walletMap[owner].scoreDetails.largeSellImpact += Math.min(
            (Math.abs(amount) / largeSellThreshold) * 20,
            30
          );
          walletMap[owner].walletLabel =
            walletMap[owner].walletLabel === "Standard"
              ? "Large Seller"
              : walletMap[owner].walletLabel;
        }

        if (type === "buy") {
          walletMap[owner].buyTimestamps.push(txTime);
        } else if (type === "sell") {
          walletMap[owner].sellTimestamps.push(txTime);
        }

        if (txTime - firstTxTime < earlyBuyThreshold * 3600000 && type === "buy") {
          walletMap[owner].isEarlyBuyer = true;
          walletMap[owner].scoreDetails.earlyBuy = 25;
        }

        if (type === "sell") {
          walletMap[owner].isHolder = false;
        }

        if (walletMap[owner].buyCount + walletMap[owner].sellCount >= 2) {
          walletMap[owner].isActiveTrader = true;
        }

        walletMap[owner].holdingDuration = Math.max(
          walletMap[owner].holdingDuration,
          (now - txTime) / (1000 * 60 * 60)
        );

        if (
          type === "sell" &&
          Math.abs(amount) > walletMap[owner].mostProfitableTrade.amount
        ) {
          walletMap[owner].mostProfitableTrade = {
            amount: Math.abs(amount),
            timestamp,
          };
        }

        const timeScore = Math.max(100 - index * 1, 10);
        const amountScore = Math.min(Math.abs(amount) / 1000, 50);
        const durationScore = Math.min(walletMap[owner].holdingDuration / 24, 20);
        walletMap[owner].scoreDetails.time = timeScore;
        walletMap[owner].scoreDetails.amount = amountScore;
        walletMap[owner].scoreDetails.duration = durationScore;
      }
    });
  });

  const walletKeys = Object.keys(walletMap);
  const whaleThreshold = totalSupply * 0.1;

  const chunks = chunkArray(walletKeys, 50);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (owner) => {
        try {
          const walletCacheKey = `wallet:${owner}:${tokenAddress}`;
          const cachedWallet = await redisClient.get(walletCacheKey);
          if (cachedWallet) {
            walletMap[owner] = JSON.parse(cachedWallet);
            return;
          }

          const wallet = walletMap[owner];
          if (wallet.transactions.length > 0) {
            wallet.avgTradeSize =
              wallet.totalVolume / (wallet.buyCount + wallet.sellCount);
            const txTimes = wallet.transactions
              .map((tx) => new Date(tx.timestamp).getTime())
              .sort((a, b) => a - b);
            const durationHours =
              (txTimes[txTimes.length - 1] - txTimes[0]) / (1000 * 60 * 60);
            wallet.tradeFrequency =
              durationHours > 0
                ? wallet.transactions.length / durationHours
                : wallet.transactions.length;

            // Profitability hesaplamasını sadeleştir
            wallet.scoreDetails.profitability = wallet.sellCount > 0 ? 10 : 0;

            // Network ve pump-dump'ı basitleştir
            wallet.scoreDetails.network = Math.min(wallet.transactions.length * 2, 20);
            wallet.scoreDetails.pumpDump = wallet.sellTimestamps.length > 0 ? 10 : 0;

            wallet.isLongTermHolder =
              wallet.holdingDuration > 7 * 24 && !wallet.isActiveTrader;
            wallet.isWhale = wallet.totalAmount > whaleThreshold;

            wallet.walletLabel =
              wallet.isLongTermHolder ? "Long-Term Holder" :
              wallet.isActiveTrader ? "Active Trader" :
              wallet.isWhale ? "Whale" : "Standard";

            // RPC yükünü azaltmak için devre dışı
            wallet.otherTokenActivity = 0;
            wallet.solBalance = await connection
              .getBalance(new PublicKey(owner))
              .then((balance) => balance / 1e9)
              .catch(() => 0);

            await redisClient.setEx(
              walletCacheKey,
              3600,
              JSON.stringify(wallet)
            );
          }
        } catch (err) {
          console.error(`Error processing wallet ${owner}: ${err.message}`);
        }
      })
    );
  }

  const earlyBuyers = [];
  const holders = [];
  const activeTraders = [];
  const largeSellers = [];

  Object.values(walletMap).forEach((wallet) => {
    if (wallet.totalAmount > 0) {
      wallet.score = Math.min(
        wallet.scoreDetails.earlyBuy +
          wallet.scoreDetails.profitability +
          wallet.scoreDetails.network +
          wallet.scoreDetails.time +
          wallet.scoreDetails.amount +
          wallet.scoreDetails.duration +
          wallet.scoreDetails.pumpDump +
          wallet.scoreDetails.largeSellImpact,
        100
      );
      if (wallet.scoreDetails.earlyBuy > 0 || wallet.buyCount > 0) earlyBuyers.push(wallet);
      if (wallet.totalAmount > 0) holders.push(wallet);
      if (wallet.buyCount + wallet.sellCount >= 1) activeTraders.push(wallet);
      if (wallet.scoreDetails.largeSellImpact > 0 || wallet.sellCount > 0) largeSellers.push(wallet);
    }
  });

  console.log(`Processed wallets: ${Object.keys(walletMap).length}`);
  console.log(`Early Buyers candidates: ${earlyBuyers.length}`);
  console.log(`Active Traders candidates: ${activeTraders.length}`);
  console.log(`Large Sellers candidates: ${largeSellers.length}`);
  console.log("analyzeWallets output:", {
    earlyBuyers: earlyBuyers.length,
    holders: holders.length,
    activeTraders: activeTraders.length,
    largeSellers: largeSellers.length,
  });

  return {
    earlyBuyers: earlyBuyers.sort((a, b) => b.score - a.score).slice(0, 10),
    holders: holders.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10),
    activeTraders: activeTraders
      .sort((a, b) => b.tradeFrequency - a.tradeFrequency)
      .slice(0, 10),
    largeSellers: largeSellers
      .sort((a, b) => b.scoreDetails.largeSellImpact - a.scoreDetails.largeSellImpact)
      .slice(0, 10),
  };
}

// /api/search endpoint
app.post("/api/search", async (req, res) => {
  const { address } = req.body;
  console.log("Search endpoint called with address:", address);
  if (!address) {
    console.log("Missing contract address for search");
    return res.status(400).json({ error: "Contract address is required" });
  }

  const cacheKey = `search:${address}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for search:${address}`);
      return res.json(JSON.parse(cachedResult));
    }

    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Invalid PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Invalid contract address" });
    }

    console.log(`Fetching signatures for ${address}`);
    let allSignatures = [];
    let lastSignature = null;
    const maxPages = 2;
    for (let i = 0; i < maxPages; i++) {
      try {
        const signatures = await withRetry(() =>
          connection.getSignaturesForAddress(tokenMint, {
            limit: 25,
            before: lastSignature,
          })
        );
        console.log(`Fetched ${signatures.length} signatures for page ${i + 1}`);
        if (!signatures.length) break;
        allSignatures = allSignatures.concat(signatures);
        lastSignature = signatures[signatures.length - 1].signature;
      } catch (rpcError) {
        console.error(`RPC error for page ${i + 1}:`, rpcError.message);
        break;
      }
    }

    console.log(`Fetched ${allSignatures.length} signatures for address ${address}`);

    if (!allSignatures.length) {
      console.log(`No transactions found for address: ${address}`);
      const results = {
        earlyBuyers: [],
        holders: [],
        activeTraders: [],
        largeSellers: [],
      };
      await redisClient.setEx(cacheKey, 600, JSON.stringify({ results }));
      return res.json({ results });
    }

    console.log(`Found ${allSignatures.length} signatures`);

    const transactions = await Promise.all(
      allSignatures.map(async (sig) => {
        try {
          return await withRetry(() =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
          );
        } catch (err) {
          console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
          return null;
        }
      })
    );

    const validTransactions = transactions.filter(
      (tx) =>
        tx &&
        tx.meta &&
        tx.meta.preTokenBalances?.length > 0 &&
        tx.meta.postTokenBalances?.length > 0
    );
    console.log(`Fetched ${validTransactions.length} valid transactions for address ${address}`);

    const results = await analyzeWallets(validTransactions, allSignatures, address);
    console.log(
      `Returning ${results.earlyBuyers.length} early buyers, ${results.holders.length} holders, ${results.activeTraders.length} active traders, ${results.largeSellers.length} large sellers`
    );

    console.log("Search results:", JSON.stringify(results, null, 2));
    await redisClient.setEx(cacheKey, 600, JSON.stringify({ results }));
    res.json({ results });
  } catch (error) {
    console.error("Search endpoint error:", error.message, error.stack);
    if (error.message.includes("429")) {
      res.status(429).json({ error: "Too many requests to Helius RPC. Please try again later." });
    } else {
      res.status(500).json({ error: `Failed to fetch data: ${error.message}` });
    }
  }
});

// /api/health-score endpoint
app.post("/api/health-score", async (req, res) => {
  const { address } = req.body;
  console.log("Health-score endpoint called with address:", address);
  if (!address) {
    console.log("Missing contract address for health-score");
    return res.status(400).json({ error: "Contract address is required" });
  }

  const cacheKey = `health:${address}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for health:${address}`);
      return res.json(JSON.parse(cachedResult));
    }

    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Invalid PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Invalid contract address" });
    }

    let signatures = [];
    try {
      signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, {
          limit: 25,
        })
      );
    } catch (rpcError) {
      console.error(`RPC error for health-score:`, rpcError.message);
      signatures = [];
    }

    if (!signatures.length) {
      console.log(`No transactions found for address: ${address}`);
      const result = {
        healthScore: 0,
        insiderIntensity: 0,
        metrics: {
          holderScore: 0,
          accumulationScore: 0,
          whaleScore: 0,
          activityScore: 0,
          liquidityScore: 0,
          giniScore: 0,
        },
        reasons: ["No transactions found for this address"],
        accumulationDetails: {
          longTermHolderRatio: 0,
          traderRatio: 0,
          whaleRatio: 0,
          accumulationScore: 0,
        },
      };
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(result)); // Önbellek süresi 1 saat
      return res.json(result);
    }

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          return await withRetry(() =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
          );
        } catch (err) {
          console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
          return null;
        }
      })
    );

    const validTransactions = transactions.filter((tx) => tx !== null);

    const walletMap = {};

    validTransactions.forEach((tx) => {
      if (!tx.meta?.postTokenBalances) return;
      tx.meta.postTokenBalances.forEach((balance) => {
        if (balance.mint !== address) return;
        const owner = balance.owner;
        if (!walletMap[owner]) {
          walletMap[owner] = {
            totalAmount: 0,
            transactions: [],
            firstTxTime: tx.blockTime * 1000,
          };
        }
        walletMap[owner].totalAmount += balance.uiTokenAmount.uiAmount || 0;
        walletMap[owner].transactions.push({
          amount: balance.uiTokenAmount.uiAmount || 0,
          timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
          type: balance.uiTokenAmount.uiAmount > 0 ? "buy" : "sell",
        });
      });
    });

    const holders = Object.values(walletMap).filter(
      (wallet) => wallet.totalAmount > 0
    );
    const holderCount = holders.length;
    const totalTokensHeld = holders.reduce(
      (sum, wallet) => sum + wallet.totalAmount,
      0
    );
    const accumulationRatio = totalTokensHeld > 0 ? holderCount / totalTokensHeld : 0;
    const whaleThreshold = totalTokensHeld * 0.1;
    const whales = holders.filter(
      (wallet) => wallet.totalAmount > whaleThreshold
    ).length;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentSignatures = signatures.filter(
      (sig) => sig.blockTime && sig.blockTime * 1000 > oneDayAgo
    );
    const activityScore = Math.min(recentSignatures.length / 50, 1);

    const accumulationDetails = calculateAccumulationDetails(
      walletMap,
      totalTokensHeld
    );

    let liquidityScore = 0;
    try {
      const dexResponse = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`
      );
      const pair = dexResponse.data.pairs?.[0];
      if (pair && pair.liquidity?.usd) {
        liquidityScore = Math.min(pair.liquidity.usd / 1000000, 1);
      }
    } catch (err) {
      console.error(`Error fetching liquidity for ${address}: ${err.message}`);
      liquidityScore = 0.5;
    }

    const insiderWallets = await analyzeWallets(
      validTransactions,
      signatures,
      address
    );
    const insiderVolume = insiderWallets.earlyBuyers
      .concat(insiderWallets.activeTraders)
      .filter((wallet) => wallet.score > 70)
      .reduce((sum, wallet) => sum + wallet.totalVolume, 0);
    const totalVolume = Object.values(walletMap).reduce(
      (sum, wallet) => sum + wallet.totalVolume || 0,
      0
    );

    const firstTxTime = signatures[0]?.blockTime * 1000 || now;
    const insiderIntensity = insiderWallets.earlyBuyers
      .concat(insiderWallets.activeTraders)
      .reduce((intensity, wallet) => {
        const timeFactor = wallet.isEarlyBuyer ? 1.5 : 1;
        const behaviorFactor = wallet.scoreDetails.pumpDump > 10 ? 1.2 : 1;
        const networkFactor = wallet.scoreDetails.network > 10 ? 1.3 : 1;
        return (
          intensity +
          (wallet.totalVolume / (totalVolume || 1)) *
            100 *
            timeFactor *
            behaviorFactor *
            networkFactor
        );
      }, 0);
    const finalInsiderIntensity = Math.round(Math.min(insiderIntensity, 100));

    const giniCoefficient = calculateGiniCoefficient(holders);

    const metrics = {
      holderScore: Math.min(holderCount / 1000, 1) * 100,
      accumulationScore: accumulationDetails.accumulationScore,
      whaleScore: whales > 0 ? Math.min(whales / holderCount, 1) * 100 : 0,
      activityScore: activityScore * 100,
      liquidityScore: liquidityScore * 100,
      giniScore: (1 - giniCoefficient) * 100,
    };

    const reasons = [];
    if (metrics.holderScore < 30) reasons.push("Low number of holders");
    if (metrics.whaleScore > 70) reasons.push("High whale concentration");
    if (metrics.activityScore < 20) reasons.push("Low recent activity");
    if (metrics.liquidityScore < 30) reasons.push("Low liquidity");
    if (giniCoefficient > 0.7) reasons.push("Uneven token distribution");
    if (accumulationDetails.traderRatio > 50)
      reasons.push("High trader activity");
    if (accumulationDetails.whaleRatio > 30)
      reasons.push("Significant whale presence");

    const healthScore = Math.round(
      metrics.holderScore * 0.2 +
        metrics.accumulationScore * 0.25 +
        (100 - metrics.whaleScore) * 0.15 +
        metrics.activityScore * 0.15 +
        metrics.liquidityScore * 0.15 +
        metrics.giniScore * 0.1
    );

    const result = {
      healthScore: Math.max(healthScore, 0),
      insiderIntensity: finalInsiderIntensity,
      metrics,
      reasons,
      accumulationDetails,
    };

    console.log("Health score result:", JSON.stringify(result, null, 2));
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(result)); // Önbellek süresi 1 saat
    res.json(result);
  } catch (error) {
    console.error("Health-score endpoint error:", error.message, error.stack);
    res.status(500).json({ error: `Failed to fetch health score: ${error.message}` });
  }
});

// /api/timeline endpoint
app.post("/api/timeline", async (req, res) => {
  const { address } = req.body;
  console.log("Timeline endpoint called with address:", address);
  if (!address) {
    console.log("Missing contract address for timeline");
    return res.status(400).json({ error: "Contract address is required" });
  }

  const cacheKey = `timeline:${address}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for timeline:${address}`);
      const parsedResult = JSON.parse(cachedResult);
      if (parsedResult.events.length === 0) {
        console.log(`Empty cached timeline data for ${address}, fetching new data`);
      } else {
        return res.json(parsedResult);
      }
    }

    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Invalid PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Invalid contract address" });
    }

    let signatures = [];
    try {
      signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, {
          limit: 25,
        })
      );
      console.log(`Fetched ${signatures.length} signatures for timeline`);
    } catch (rpcError) {
      console.error(`RPC error for timeline:`, rpcError.message);
      return res.json({ events: [] });
    }

    if (!signatures.length) {
      console.log(`No transactions found for address: ${address}`);
      await redisClient.setEx(cacheKey, 600, JSON.stringify({ events: [] }));
      return res.json({ events: [] });
    }

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          return await withRetry(() =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
          );
        } catch (err) {
          console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
          return null;
        }
      })
    );

    const events = [];
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (!tx || !tx.meta?.postTokenBalances || !signatures[i].blockTime) continue;

      const timestamp = new Date(signatures[i].blockTime * 1000).toISOString();
      let price = await getTokenPrice(address);
      const priceSource = price === 0.01 ? "default" : "dexscreener";

      tx.meta.postTokenBalances.forEach((balance, idx) => {
        if (balance.mint !== address || !tx.meta.preTokenBalances[idx]) return;
        const owner = balance.owner;
        const preBalance = tx.meta.preTokenBalances[idx].uiTokenAmount.uiAmount || 0;
        const postBalance = balance.uiTokenAmount.uiAmount || 0;
        const amount = postBalance - preBalance;

        if (amount !== 0) {
          const event = {
            timestamp,
            price,
            priceSource,
          };
          if (amount > 0) {
            event.buy = { wallet: owner, amount };
          } else {
            event.sell = { wallet: owner, amount: Math.abs(amount) };
          }
          events.push(event);
        }
      });
    }

    const sortedEvents = events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    console.log("Timeline events:", JSON.stringify(sortedEvents, null, 2));

    await redisClient.setEx(cacheKey, 600, JSON.stringify({ events: sortedEvents }));
    res.json({ events: sortedEvents });
  } catch (error) {
    console.error("Timeline endpoint error:", error.message, error.stack);
    res.status(500).json({ error: `Failed to fetch timeline: ${error.message}` });
  }
});

// /api/token-transfers endpoint
app.post("/api/token-transfers", async (req, res) => {
  const { address, limit = 50 } = req.body;
  console.log("Token-transfers endpoint called with address:", address);
  if (!address) {
    console.log("Missing contract address for token-transfers");
    return res.status(400).json({ error: "Contract address is required" });
  }

  const cacheKey = `transfers:${address}:${limit}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for transfers:${address}`);
      return res.json(JSON.parse(cachedResult));
    }

    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Invalid PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Invalid contract address" });
    }

    let signatures = [];
    try {
      signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, {
          limit: Math.min(limit, 25),
        })
      );
    } catch (rpcError) {
      console.error(`RPC error for token-transfers:`, rpcError.message);
      return res.json({
        nodes: [],
        edges: [],
        message: "No transactions found for this token",
      });
    }

    if (!signatures.length) {
      console.log(`No transactions found for address: ${address}`);
      return res.json({
        nodes: [],
        edges: [],
        message: "No transactions found for this token",
      });
    }

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          return await withRetry(() =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
          );
        } catch (err) {
          console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
          return null;
        }
      })
    );

    const nodes = new Map();
    const edges = [];

    transactions.forEach((tx, idx) => {
      if (
        !tx ||
        !tx.meta?.postTokenBalances ||
        !tx.meta?.preTokenBalances ||
        !signatures[idx].blockTime
      ) {
        console.log(`Skipping invalid transaction at index ${idx}`);
        return;
      }

      const timestamp = new Date(signatures[idx].blockTime * 1000).toISOString();

      tx.meta.postTokenBalances.forEach((postBalance, i) => {
        if (
          postBalance.mint !== address ||
          !tx.meta.preTokenBalances[i] ||
          !postBalance.uiTokenAmount ||
          !tx.meta.preTokenBalances[i].uiTokenAmount
        ) {
          console.log(
            `Skipping invalid balance at index ${i} for mint ${address}`
          );
          return;
        }

        const owner = postBalance.owner;
        const preBalance =
          tx.meta.preTokenBalances[i].uiTokenAmount.uiAmount || 0;
        const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
        const amount = postAmount - preBalance;

        const currentNode = nodes.get(owner) || { id: owner, balance: 0 };
        currentNode.balance = postAmount >= 0 ? postAmount : currentNode.balance;
        nodes.set(owner, currentNode);

        if (amount !== 0 && tx.transaction.message.accountKeys) {
          const source = tx.meta.preTokenBalances[i].owner;
          const target = postBalance.owner;
          if (source !== target && amount > 0) {
            edges.push({
              source,
              target,
              amount: Math.abs(amount),
              timestamp,
            });

            const sourceNode = nodes.get(source) || { id: source, balance: 0 };
            sourceNode.balance =
              sourceNode.balance >= Math.abs(amount)
                ? sourceNode.balance - Math.abs(amount)
                : sourceNode.balance;
            nodes.set(source, sourceNode);
          }
        }
      });
    });

    const validNodes = Array.from(nodes.values()).filter(
      (node) => node.id && !isNaN(node.balance) && node.balance >= 0
    );
    const validEdges = edges.filter(
      (edge) =>
        edge.source &&
        edge.target &&
        !isNaN(edge.amount) &&
        edge.amount > 0 &&
        edge.timestamp &&
        validNodes.some((node) => node.id === edge.source) &&
        validNodes.some((node) => node.id === edge.target)
    );

    const topNodes = validNodes.sort((a, b) => b.balance - a.balance).slice(0, 150);
    const topNodeIds = new Set(topNodes.map((node) => node.id));
    const finalEdges = validEdges.filter(
      (edge) => topNodeIds.has(edge.source) && topNodeIds.has(edge.target)
    );

    const result = {
      nodes: topNodes,
      edges: finalEdges,
    };

    console.log(`Returning ${result.nodes.length} nodes and ${result.edges.length} edges`);

    if (result.nodes.length === 0 && result.edges.length === 0) {
      console.warn(`No valid token transfer data found for ${address}`);
      result.message =
        "No valid token transfers found. Try a different token or increase the limit.";
    }

    await redisClient.setEx(cacheKey, 600, JSON.stringify(result));
    res.json(result);
  } catch (error) {
    console.error("Token-transfers endpoint error:", error.message, error.stack);
    res.status(500).json({
      error: `Failed to fetch token transfers: ${error.message}`,
      nodes: [],
      edges: [],
    });
  }
});

// /api/rug-check endpoint
app.post("/api/rug-check", async (req, res) => {
  const { address } = req.body;
  console.log("Rug-check endpoint called with address:", address);
  if (!address) {
    console.error("Missing contract address for rug-check");
    return res.status(400).json({ error: "Contract address is required" });
  }

  const cacheKey = `rugcheck:${address}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for rugcheck:${address}`);
      return res.json(JSON.parse(cachedResult));
    }

    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Invalid PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Invalid contract address" });
    }

    const tokenAccount = await connection
      .getAccountInfo(tokenMint)
      .catch((err) => {
        console.error(`Error fetching account info for ${address}: ${err.message}`);
        return null;
      });
    if (!tokenAccount) {
      console.error(`No account found for token mint: ${address}`);
      return res.status(400).json({ error: "Token mint account not found" });
    }

    let mintAuthority = false;
    let freezeAuthority = false;
    let totalSupply = 1;
    try {
      const mintInfo = await metaplex
        .tokens()
        .findMintByAddress({ address: tokenMint });
      mintAuthority = !!mintInfo.mintAuthorityOption?.mintAuthority;
      freezeAuthority = !!mintInfo.freezeAuthorityOption?.freezeAuthority;
      totalSupply =
        Number(mintInfo.supply.basisPoints) / Math.pow(10, mintInfo.decimals) || 1;
    } catch (err) {
      console.error(`Error fetching mint info for ${address}: ${err.message}`);
      mintAuthority = true;
      freezeAuthority = true;
    }

    let signatures = [];
    try {
      signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, {
          limit: 25,
        })
      );
    } catch (rpcError) {
      console.error(`RPC error for rug-check:`, rpcError.message);
      signatures = [];
    }

    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          return await withRetry(() =>
            connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
          );
        } catch (err) {
          console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
          return null;
        }
      })
    );

    const walletMap = {};
    transactions.forEach((tx) => {
      if (!tx || !tx.meta?.postTokenBalances) return;
      tx.meta.postTokenBalances.forEach((balance) => {
        if (balance.mint !== address) return;
        const owner = balance.owner;
        if (!walletMap[owner]) {
          walletMap[owner] = { totalAmount: 0, transactions: [] };
        }
        const amount = balance.uiTokenAmount?.uiAmount || 0;
        walletMap[owner].totalAmount += amount;
        walletMap[owner].transactions.push({
          amount,
          timestamp: tx.blockTime
            ? new Date(tx.blockTime * 1000).toISOString()
            : "Unknown",
        });
      });
    });

    let insiderCount = 0;
    let insiderHoldings = 0;
    try {
      const insiderWallets = await analyzeWallets(
        transactions.filter((tx) => tx !== null),
        signatures,
        address
      );
      insiderCount =
        insiderWallets.earlyBuyers.length + insiderWallets.activeTraders.length;
      insiderHoldings = insiderWallets.earlyBuyers
        .concat(insiderWallets.activeTraders)
        .reduce((sum, wallet) => sum + wallet.totalAmount, 0);
    } catch (err) {
      console.error(`Error analyzing insider wallets for ${address}: ${err.message}`);
      insiderCount = 0;
      insiderHoldings = 0;
    }

    let burnedPercentage = 0;
    try {
      const burnAccounts = await connection.getProgramAccounts(tokenMint, {
        filters: [
          { dataSize: 165 },
          {
            memcmp: {
              offset: 32,
              bytes: "11111111111111111111111111111111",
            },
          },
        ],
      });
      const burnedTokens = burnAccounts.reduce(
        (sum, acc) =>
          sum + Number(acc.account.data.readBigInt64LE(64)) / Math.pow(10, 9),
        0
      );
      burnedPercentage = totalSupply > 0 ? (burnedTokens / totalSupply) * 100 : 0;
    } catch (err) {
      console.error(`Error fetching burn data for ${address}: ${err.message}`);
      burnedPercentage = 0;
    }

    let liquidityLocked = 0;
    let liquidityLockDuration = "None";
    try {
      const dexResponse = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`
      );
      const pair = dexResponse.data.pairs?.[0];
      if (pair && pair.liquidity?.usd) {
        liquidityLocked = Math.min(pair.liquidity.usd / 1000000, 1) * 100;
        liquidityLockDuration = pair.lockedUntil || "None";
      }
    } catch (err) {
      console.error(`Error fetching liquidity for ${address}: ${err.message}`);
      liquidityLocked = 50;
    }

    const contractRenounced = !mintAuthority && !freezeAuthority;
    const upgradeable = false;

    const reasons = [];
    if (insiderCount > 10) reasons.push("High insider activity");
    if (totalSupply > 0 && insiderHoldings / totalSupply > 0.5)
      reasons.push("Large insider holdings");
    if (mintAuthority) reasons.push("Mint authority active");
    if (freezeAuthority) reasons.push("Freeze authority active");
    if (burnedPercentage < 10) reasons.push("Low burn percentage");
    if (liquidityLocked < 50) reasons.push("Low liquidity lock");
    if (!contractRenounced) reasons.push("Contract not renounced");
    if (upgradeable) reasons.push("Contract is upgradeable");

    const riskScore = Math.round(
      (insiderCount > 10 ? 20 : 0) +
      (totalSupply > 0 && insiderHoldings / totalSupply > 0.5 ? 20 : 0) +
      (mintAuthority ? 15 : 0) +
      (freezeAuthority ? 15 : 0) +
      (burnedPercentage < 10 ? 10 : 0) +
      (liquidityLocked < 50 ? 10 : 0) +
      (!contractRenounced ? 10 : 0) +
      (upgradeable ? 10 : 0)
    );

    const rugCheckData = {
      totalSupply,
      insiderCount,
      insiderHoldings,
      mintAuthority,
      freezeAuthority,
      burnedPercentage,
      liquidityLocked,
      liquidityLockDuration,
      contractRenounced,
      upgradeable,
      riskScore,
      reasons,
    };

    console.log("Rug-check result:", JSON.stringify(rugCheckData, null, 2));
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(rugCheckData)); // Önbellek süresi 1 saat
    res.json(rugCheckData);
  } catch (error) {
    console.error("Rug-check endpoint error:", error.message, error.stack);
    res.status(500).json({ error: `Failed to perform rug check: ${error.message}` });
  }
});

// /api/monitor endpoint (SSE)
app.get("/api/monitor", async (req, res) => {
  const { address, wallets } = req.query;
  console.log("Monitor endpoint called with address:", address, "wallets:", wallets);

  if (!address || !wallets) {
    console.log("Missing address or wallets for monitor endpoint");
    return res.status(400).json({ error: "Address and wallets are required" });
  }

  let tokenMint;
  try {
    tokenMint = new PublicKey(address);
  } catch (err) {
    console.error(`Invalid PublicKey: ${address} - ${err.message}`);
    return res.status(400).json({ error: "Invalid contract address" });
  }

  const walletList = wallets.split(",");
  if (!walletList.length) {
    return res.status(400).json({ error: "No wallets provided to monitor" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const monitoredWallets = new Set(walletList);

  let lastSignature = null;
  const interval = setInterval(async () => {
    try {
      const signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, {
          limit: 10,
          before: lastSignature,
        })
      );

      if (signatures.length > 0) {
        lastSignature = signatures[0].signature;
        const transactions = await Promise.all(
          signatures.map(async (sig) => {
            try {
              return await withRetry(() =>
                connection.getParsedTransaction(sig.signature, {
                  maxSupportedTransactionVersion: 0,
                })
              );
            } catch (err) {
              console.error(`Error fetching transaction ${sig.signature}: ${err.message}`);
              return null;
            }
          })
        );

        const monitoredTransactions = [];
        transactions.forEach((tx, idx) => {
          if (
            !tx ||
            !tx.meta?.postTokenBalances ||
            !tx.meta?.preTokenBalances ||
            !signatures[idx].blockTime
          )
            return;

          const timestamp = new Date(signatures[idx].blockTime * 1000).toISOString();
          tx.meta.postTokenBalances.forEach((postBalance, i) => {
            if (
              postBalance.mint !== address ||
              !tx.meta.preTokenBalances[i] ||
              !postBalance.uiTokenAmount ||
              !tx.meta.preTokenBalances[i].uiTokenAmount
            )
              return;

            const owner = postBalance.owner;
            if (!monitoredWallets.has(owner)) return;

            const preBalance =
              tx.meta.preTokenBalances[i].uiTokenAmount.uiAmount || 0;
            const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
            const amount = postAmount - preBalance;
            if (amount === 0) return;

            const type = amount > 0 ? "buy" : "sell";
            const totalSupply = postBalance.uiTokenAmount.totalSupply || 1;
            const isLargeSell = type === "sell" && Math.abs(amount) > totalSupply * 0.01;

            monitoredTransactions.push({
              wallet: owner,
              type,
              amount: Math.abs(amount),
              timestamp,
              tokenName: tx.meta.postTokenBalances[i].mint,
              isLargeSell,
              solAmount: amount * (tx.meta.fee / 1e9), // Yaklaşık SOL miktarı
            });
          });
        });

        if (monitoredTransactions.length > 0) {
          res.write(`data: ${JSON.stringify(monitoredTransactions)}\n\n`);
        }
      }
    } catch (error) {
      console.error("Monitor endpoint error:", error.message);
      res.write(
        `data: ${JSON.stringify({ error: "Failed to fetch transactions" })}\n\n`
      );
    }
  }, 10000);

  req.on("close", () => {
    console.log("Client disconnected from /api/monitor");
    clearInterval(interval);
    res.end();
  });
});

// /api/copy-trade endpoint
app.post("/api/copy-trade", async (req, res) => {
  const { walletAddress, transactionId } = req.body;
  console.log("Copy-trade endpoint called with walletAddress:", walletAddress, "transactionId:", transactionId);

  if (!walletAddress || !transactionId) {
    console.log("Missing walletAddress or transactionId for copy-trade");
    return res.status(400).json({ error: "Wallet address and transaction ID are required" });
  }

  const cacheKey = `copytrade:${walletAddress}:${transactionId}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for copytrade:${walletAddress}:${transactionId}`);
      return res.json(JSON.parse(cachedResult));
    }

    let wallet;
    try {
      wallet = new PublicKey(walletAddress);
    } catch (err) {
      console.error(`Invalid PublicKey: ${walletAddress} - ${err.message}`);
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Helius API ile işlemi al
    const transactionDetails = await withRetry(() =>
      axios.post(
        `https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY}`,
        { transactions: [transactionId] },
        { timeout: 5000 }
      )
    );

    const tx = transactionDetails.data[0];
    if (!tx) {
      console.error(`Transaction not found: ${transactionId}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    // İşlem detaylarını analiz et
    const tokenTransfer = tx.tokenTransfers?.find(
      (transfer) =>
        transfer.fromUserAccount === walletAddress ||
        transfer.toUserAccount === walletAddress
    );

    if (!tokenTransfer) {
      console.error(`No token transfer found for wallet ${walletAddress} in transaction ${transactionId}`);
      return res.status(404).json({ error: "No token transfer found in this transaction" });
    }

    const type = tokenTransfer.fromUserAccount === walletAddress ? "sell" : "buy";
    const amount = tokenTransfer.tokenAmount;
    const tokenMint = tokenTransfer.mint;
    const timestamp = new Date(tx.timestamp * 1000).toISOString();

    // İşlemi kopyalamak için gerekli bilgiler
    const copyTradeData = {
      walletAddress,
      transactionId,
      type,
      amount,
      tokenMint,
      timestamp,
      originalTransaction: tx,
    };

    console.log("Copy-trade result:", JSON.stringify(copyTradeData, null, 2));
    await redisClient.setEx(cacheKey, 600, JSON.stringify(copyTradeData));
    res.json(copyTradeData);
  } catch (error) {
    console.error("Copy-trade endpoint error:", error.message, error.stack);
    if (error.message.includes("429")) {
      res.status(429).json({ error: "Too many requests to Helius API. Please try again later." });
    } else {
      res.status(500).json({ error: `Failed to copy trade: ${error.message}` });
    }
  }
});

// YENİ UÇ NOKTA: /api/compare-tokens (Güncellenmiş: Dinamik hypeScore, health-score entegrasyonu, meta veriler)
app.post("/api/compare-tokens", async (req, res) => {
  const { address } = req.body;
  console.log("Compare-tokens uç noktası çağrıldı, adres:", address);

  if (!address) {
    return res.status(400).json({ error: "Token adresi gerekli" });
  }

  const cacheKey = `compare:${address}`;
  try {
    // Önbellekten kontrol et
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Önbellek bulundu: ${address}`);
      return res.json(JSON.parse(cachedResult));
    }

    // Geçerli bir Solana PublicKey olup olmadığını kontrol et
    let tokenMint;
    try {
      tokenMint = new PublicKey(address);
    } catch (err) {
      console.error(`Geçersiz PublicKey: ${address} - ${err.message}`);
      return res.status(400).json({ error: "Geçersiz token adresi" });
    }

    // Health-score mantığını doğrudan burada çalıştır
    let healthScore = 50;
    let insiderIntensity = 30;
    let metrics = {
      holderScore: 0,
      accumulationScore: 0,
      whaleScore: 0,
      activityScore: 0,
      liquidityScore: 0,
      giniScore: 0,
    };
    let reasons = [];
    let accumulationDetails = {
      longTermHolderRatio: 0,
      traderRatio: 0,
      whaleRatio: 0,
      accumulationScore: 0,
    };

    let signatures = [];
    try {
      signatures = await withRetry(() =>
        connection.getSignaturesForAddress(tokenMint, { limit: 25 })
      );
    } catch (rpcError) {
      console.error(`RPC hatası: ${rpcError.message}`);
      signatures = [];
    }

    if (!signatures.length) {
      console.log(`Adres için işlem bulunamadı: ${address}`);
      reasons.push("Bu adrese ait işlem bulunamadı");
      healthScore = 0;
      insiderIntensity = 0;
    } else {
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          try {
            return await withRetry(() =>
              connection.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
              })
            );
          } catch (err) {
            console.error(`İşlem alınamadı ${sig.signature}: ${err.message}`);
            return null;
          }
        })
      );

      const validTransactions = transactions.filter((tx) => tx !== null);
      const walletMap = {};

      validTransactions.forEach((tx) => {
        if (!tx.meta?.postTokenBalances) return;
        tx.meta.postTokenBalances.forEach((balance) => {
          if (balance.mint !== address) return;
          const owner = balance.owner;
          if (!walletMap[owner]) {
            walletMap[owner] = {
              totalAmount: 0,
              transactions: [],
              firstTxTime: tx.blockTime * 1000,
            };
          }
          walletMap[owner].totalAmount += balance.uiTokenAmount.uiAmount || 0;
          walletMap[owner].transactions.push({
            amount: balance.uiTokenAmount.uiAmount || 0,
            timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
            type: balance.uiTokenAmount.uiAmount > 0 ? "buy" : "sell",
          });
        });
      });

      const holders = Object.values(walletMap).filter(
        (wallet) => wallet.totalAmount > 0
      );
      const holderCount = holders.length;
      const totalTokensHeld = holders.reduce(
        (sum, wallet) => sum + wallet.totalAmount,
        0
      );
      const whaleThreshold = totalTokensHeld * 0.1;
      const whales = holders.filter(
        (wallet) => wallet.totalAmount > whaleThreshold
      ).length;

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const recentSignatures = signatures.filter(
        (sig) => sig.blockTime && sig.blockTime * 1000 > oneDayAgo
      );
      const activityScore = Math.min(recentSignatures.length / 50, 1);

      accumulationDetails = calculateAccumulationDetails(walletMap, totalTokensHeld);

      let liquidityScore = 0;
      try {
        const dexResponse = await axios.get(
          `https://api.dexscreener.com/latest/dex/tokens/${address}`
        );
        const pair = dexResponse.data.pairs?.[0];
        if (pair && pair.liquidity?.usd) {
          liquidityScore = Math.min(pair.liquidity.usd / 1000000, 1);
        }
      } catch (err) {
        console.error(`Likidite alınamadı: ${err.message}`);
        liquidityScore = 0.5;
      }

      const insiderWallets = await analyzeWallets(validTransactions, signatures, address);
      const totalVolume = Object.values(walletMap).reduce(
        (sum, wallet) => sum + wallet.totalVolume || 0,
        0
      );
      insiderIntensity = Math.round(
        insiderWallets.earlyBuyers
          .concat(insiderWallets.activeTraders)
          .reduce((intensity, wallet) => {
            const timeFactor = wallet.isEarlyBuyer ? 1.5 : 1;
            const behaviorFactor = wallet.scoreDetails.pumpDump > 10 ? 1.2 : 1;
            const networkFactor = wallet.scoreDetails.network > 10 ? 1.3 : 1;
            return (
              intensity +
              (wallet.totalVolume / (totalVolume || 1)) *
                100 *
                timeFactor *
                behaviorFactor *
                networkFactor
            );
          }, 0)
      );

      const giniCoefficient = calculateGiniCoefficient(holders);

      metrics = {
        holderScore: Math.min(holderCount / 1000, 1) * 100,
        accumulationScore: accumulationDetails.accumulationScore,
        whaleScore: whales > 0 ? Math.min(whales / holderCount, 1) * 100 : 0,
        activityScore: activityScore * 100,
        liquidityScore: liquidityScore * 100,
        giniScore: (1 - giniCoefficient) * 100,
      };

      reasons = [];
      if (metrics.holderScore < 30) reasons.push("Düşük sahip sayısı");
      if (metrics.whaleScore > 70) reasons.push("Yüksek balina yoğunluğu");
      if (metrics.activityScore < 20) reasons.push("Düşük son aktivite");
      if (metrics.liquidityScore < 30) reasons.push("Düşük likidite");
      if (giniCoefficient > 0.7) reasons.push("Dengesiz token dağılımı");
      if (accumulationDetails.traderRatio > 50)
        reasons.push("Yüksek trader aktivitesi");
      if (accumulationDetails.whaleRatio > 30)
        reasons.push("Önemli balina varlığı");

      healthScore = Math.round(
        metrics.holderScore * 0.2 +
        metrics.accumulationScore * 0.25 +
        (100 - metrics.whaleScore) * 0.15 +
        metrics.activityScore * 0.15 +
        metrics.liquidityScore * 0.15 +
        metrics.giniScore * 0.1
      );
    }

    // Fiyat verilerini al
    const price = await getTokenPrice(address);

    // 24 saatlik fiyat değişimi için Dexscreener'dan veri al
    let priceChange24h = "0.00";
    try {
      const dexResponse = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { timeout: 5000 }
      );
      const pair = dexResponse.data.pairs?.[0];
      priceChange24h = pair?.priceChange?.h24 || "0.00";
    } catch (err) {
      console.error(`Fiyat değişimi alınamadı: ${err.message}`);
    }

    // Dinamik hypeScore: Son 24 saatteki işlem sayısına dayalı
    let hypeScore = 5;
    try {
      const timelineResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timeline`,
        { address },
        { headers: { "Content-Type": "application/json" } }
      );
      const recentEvents = timelineResponse.data.events.filter(
        (event) => new Date(event.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      hypeScore = Math.min(Math.round(recentEvents.length / 2), 100); // Örnek: 2 işlem = 1 puan
    } catch (err) {
      console.error(`HypeScore alınamadı: ${err.message}`);
    }

    // Token meta verilerini al (name, symbol)
    let tokenName = "Bilinmiyor";
    let tokenSymbol = "UNK";
    try {
      const mintInfo = await metaplex.tokens().findMintByAddress({ address: new PublicKey(address) });
      const metadata = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(address) });
      tokenName = metadata.name || "Bilinmiyor";
      tokenSymbol = metadata.symbol || "UNK";
    } catch (err) {
      console.error(`Token meta verileri alınamadı: ${err.message}`);
    }

    const result = {
      address,
      healthScore: Math.max(healthScore, 0),
      insiderIntensity: Math.min(insiderIntensity, 100),
      hypeScore,
      priceChange24h,
      tokenName,
      tokenSymbol,
      metrics,
      reasons,
      accumulationDetails,
    };

    // Önbelleğe kaydet (5 dakika)
    await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    res.json(result);
  } catch (error) {
    console.error("Compare-tokens hatası:", error.message);
    res.status(500).json({
      error: "Token verileri alınamadı. Lütfen geçerli bir token adresi girin veya daha sonra tekrar deneyin.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Hata yönetimi
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message, err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});