# Solana Insider
What is Solana Insider Finder and Its Purpose?
Solana Insider Finder is an advanced analytics platform tailored for the Solana blockchain, aimed at enhancing transparency and enabling informed investment decisions. Its primary purpose is to help users analyze token projects, monitor insider wallet activities, and visualize market movements. Specifically, it serves the following goals:
Rug Pull Risk Assessment: Analyzes token smart contracts and on-chain activities to identify potential scam risks.

Insider Wallet Tracking: Identifies and monitors insider wallets, such as early buyers, large sellers, active traders, and long-term holders, in real-time.

Token Health Evaluation: Provides metrics like health scores and insider intensity to gauge a project’s overall status.

Data Visualization: Presents complex data, such as price movements, wallet connections, and transaction timelines, in an accessible format.

User-Centric Experience: Integrates Solana wallet connectivity, real-time notifications, and personalized features to streamline the analysis process.

This tool is designed for crypto traders, DeFi investors, and anyone exploring new projects within the Solana ecosystem.

Features of Solana Insider Finder
Solana Insider Finder stands out with its rich set of features. Below, we detail its core components and functionalities:

1. Dashboard
Token Search: Users can input a token’s contract address to initiate a comprehensive scan.

Dexscreener Integration: Displays real-time price charts and market data via Dexscreener.

Token Health Widget: Visualizes metrics such as health score (0–100%), insider intensity, and risk factors.

Favorite Tokens Management: Allows users to add and monitor favorite tokens for quick access to their health status.

Wallet Activity Widget: Lists recent transactions and activities of followed wallets.

2. Rug Check
Evaluates rug pull risks by analyzing a token’s smart contract and on-chain data.

Key Metrics:
Insider Activity: Number of wallets with suspicious trading patterns and their share of the token supply.

Mint and Freeze Authorities: Checks if developers can mint new tokens or freeze transfers.

Liquidity Lock: Assesses the percentage of liquidity locked and the lock duration.

Contract Security: Verifies if the contract is renounced (immutable) or upgradeable.

Token Burn: Measures the percentage of tokens burned to reduce supply.

Provides a risk score (0–100%) and a detailed risk distribution chart (Pie Chart) for clear insights.

Offers a report export feature to download analysis results in JSON format.

3. Bubble Map
Visualizes token transactions as a network graph, where nodes represent wallets and edges represent transactions between them.

Users can zoom, filter wallets, and explore detailed wallet information.

Reveals connections between insider wallets, helping identify coordinated activities.
Not launched yet!

4. Timeline
Displays a token’s price movements and significant transactions (buys/sells) on a timeline.

Supports zooming to focus on specific time periods.

If price data from Dexscreener or Solscan is unavailable, a default price is used, with a notification to the user.

5. Insiders
Analyzes four wallet categories:
Early Buyers: The first 100 buyers of a token.

Holders: Wallets holding tokens for extended periods.

Active Traders: Wallets with frequent trading activity.

Large Sellers: Wallets executing significant sell transaction

Provides detailed wallet insights:
Insider score, total trading volume, buy/sell counts, token holdings, and wallet labels (e.g., “Whale,” “Standard”).

Most profitable trade, profitability ratio, and network connections.

Real-time monitoring (live mode) delivers instant notifications for followed wallets’ activities via Telegram and browser notifications

6. Battle Arena
Enables comparative analysis of tokens, such as health scores, insider activity, or market performance.

Supports investment decisions by offering a competitive view of multiple tokens.

7. Real-Time Monitoring and Notifications
Uses Server-Sent Events (SSE) to monitor followed wallets’ transactions in real-time.

Sends Telegram and browser notifications for large sells or suspicious activities.

Example notification: “ Insider Alert: [Wallet Address] sold 1M tokens!”

How to Use Solana Insider Finder
Solana Insider Finder is designed for ease of use, with a straightforward workflow:
1. Connect a Wallet
Upon accessing the app, connect your Solana wallet using the WalletMultiButton (e.g., Phantom or Solflare).

If your wallet is not on the allowlist, you’ll see a subscription prompt. Allowlisted users are greeted with a confetti effect and full dashboard access.

2. Initiate Token Analysis
In the Dashboard, enter the contract address of the token you wish to analyze (e.g., an SPL token address).

Click Launch Scan to start the analysis. The app fetches data from sources like Helius, Dexscreener, and Solscan.

3. Explore Results
Dashboard: View the token’s price chart, health score, and insider intensity. Add tokens to favorites or check wallet activities.

Rug Check: Review the token’s rug pull risk, including risk score and detailed metrics.

Bubble Map: Analyze wallet relationships and identify suspicious connections.

Timeline: Examine the token’s price and transaction history.

Insiders: Explore insider wallet details and follow those of interest.

Battle Arena: Compare multiple tokens to make informed decisions.

4. Enable Real-Time Monitoring

In the Insiders section, select wallets to follow and activate Live Mode.

Receive Telegram or browser notifications for significant transactions or insider activities.

5. Export Reports
Download rug check results or insider wallet data in JSON format for further analysis.

Examples: rug-check.json, wallets_earlyBuyers.json.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features
- Manage Solana wallet addresses in an allowlist using Supabase.
- Validate Solana wallet addresses with `@solana/web3.js`.
- Interactive UI with a neon-themed design for adding/removing addresses.

## Tech Stack
- **Frontend**: Next.js, React
- **Backend**: Supabase (PostgreSQL)
- **Blockchain**: Solana Web3.js
- **Styling**: CSS with neon-themed components

## Installation
Follow these steps to set up the project locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/[your-username]/solana-insider.git
   cd solana-insider
