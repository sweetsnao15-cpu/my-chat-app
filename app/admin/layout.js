// app/admin/layout.js
export const metadata = {
  title: 'VAU Admin',
  manifest: '/manifest-admin.json', // 管理者専用マニフェスト
  icons: {
    apple: '/admin-icon.png', // 管理者専用アイコン
  },
};

export default function AdminLayout({ children }) {
  return <section>{children}</section>;
}
