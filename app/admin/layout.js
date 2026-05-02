// app/admin/layout.js
export const metadata = {
  title: 'VAU Admin',
  // 管理画面から「ホーム画面に追加」した時だけこの設定が呼ばれる
  icons: {
    apple: '/admin-icon.png', // publicフォルダに置いた管理者用アイコン
  },
  manifest: '/manifest-admin.json',
};

export default function AdminLayout({ children }) {
  return <>{children}</>;
}
