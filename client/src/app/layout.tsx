import type { Metadata } from "next";
import "../styles/index.css"; // globals.css yerine index.css import ediliyor
import CustomWalletProvider from "./WalletProvider";

export const metadata: Metadata = {
  title: "Solana Insider Finder",
  description: "Find early buyers, holders, and active traders on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <CustomWalletProvider>{children}</CustomWalletProvider>
      </body>
    </html>
  );
}