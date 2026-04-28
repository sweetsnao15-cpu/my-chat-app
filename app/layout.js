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
  icons: {
    icon: [
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
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
        {/* iPhone用のアイコン指定を512に更新 */}
        <link rel="apple-touch-icon" href="/icon-512.png" />
        {/* ホーム画面追加時のタイトルを補強 */}
        <meta name="apple-mobile-web-app-title" content="for VAU" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
