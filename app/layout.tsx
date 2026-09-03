import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "@fontsource/vazirmatn/900.css";
import "./globals.css";
import AppSidebar from "./components/AppSidebar";

export const metadata = {
  title: "سامانه پرونده‌های کارشناسی",
  description: "مدیریت و پیگیری پرونده‌های کارشناسی",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="app-body">
        <AppSidebar />

        <main className="app-main min-h-screen mr-64 max-[640px]:mr-0">
          {children}
        </main>
      </body>
    </html>
  );
}
