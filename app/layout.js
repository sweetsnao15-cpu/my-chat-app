import "./globals.css";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: "for VAU", // サイト名を「for VAU」に変更
  description: "Private chat for VAU",
  manifest: "/manifest.json", // マニフェストファイルを紐付け
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // iPhoneで全画面表示にする設定
    title: "for VAU", // ホーム画面に追加した際の名前
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        {/* iPhoneでのアプリアイコン指定 */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
