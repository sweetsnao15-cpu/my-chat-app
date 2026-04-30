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
        {/* ?v=2 を付けることで、スマホに残っている古いキャッシュを無視させます */}
        <link rel="apple-touch-icon" href="/icon-512.png?v=2" />
        <link rel="icon" href="/icon-512.png?v=2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="for VAU" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
