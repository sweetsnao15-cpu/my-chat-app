// app/manifest.js
export default function manifest() {
  return {
    name: 'for VAU',               // インストール時の名前
    short_name: 'for VAU',         // アイコンの下に表示される名前
    description: 'for VAU Communication App',
    start_url: '/',
    display: 'standalone',         // アプリのように全画面表示
    background_color: '#000000',
    theme_color: '#800000',        // テーマカラー
    icons: [
      {
        src: '/icon-192.png',      // publicフォルダに配置した画像
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
