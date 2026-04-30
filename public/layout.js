import "./globals.css";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // アイコンの背景色と同じ #800020 を指定することで、
  // 読み込み時や縁の隙間が白く目立つのを防ぎます
  themeColor: "#800020",
};

export const metadata = {
  title: "for VAU",
  description: "Private chat for VAU",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "for VAU",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* 
          白縁を防ぐポイント: 
          1. ?v=3 をつけて古いキャッシュを強制破棄
          2. 背景が透過していない正方形のPNGを使用することが前提
        */}
        <link rel="apple-touch-icon" href="/icon-512.png?v=3" />
        <link rel="icon" href="/icon-512.png?v=3" />
        
        {/* iOS Web App設定の補強 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="for VAU" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
