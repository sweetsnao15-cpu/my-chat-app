import "./globals.css";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: "for VAU",
  description: "Private chat for VAU",
  manifest: "/manifest.json",
  // アイコン設定をmetadataに集約
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "for VAU", // ホーム画面での表示名
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* iPhone用のアイコン指定を512に更新 */}
        <link rel="apple-touch-icon" href="/icon-512.png" />
        {/* ホーム画面追加時のタイトルを補強 */}
        <meta name="apple-mobile-web-app-title" content="for VAU" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
