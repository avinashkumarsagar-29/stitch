import type { Metadata } from "next";
import "./globals.css";
import Toast from "./components/Toast";

export const metadata: Metadata = {
  title: "Stitch | Tailoring & Design",
  description: "Book tailoring pickup and drop-off services with Stitch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toast />
      </body>
    </html>
  );
}
