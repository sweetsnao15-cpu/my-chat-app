import "./globals.css";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {/* iOS用：最も確実なアイコン指定方法 */}
        <link rel="apple-touch-icon" href="/icon-512.png" />
        {/* 複数のサイズを指定する場合（予備） */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
