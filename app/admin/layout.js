// app/admin/layout.js
export const metadata = {
  title: 'for VAU -HOST-',
  // manifestの読み込みを強制
  manifest: '/manifest-admin.json',
  icons: {
    // 確実に管理者用アイコンを指すようにし、末尾に ?v=1 を付けてキャッシュを破棄
    apple: '/admin-icon.png?v=1', 
  },
};

export default function AdminLayout({ children }) {
  return <>{children}</>;
}
