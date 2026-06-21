import type { Metadata } from "next";
import "./globals.css";
import Toast from "./components/Toast";
import LayoutWrapper from "./components/LayoutWrapper";

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
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className="min-h-full flex flex-col">
        <LayoutWrapper>{children}</LayoutWrapper>
        <Toast />
      </body>
    </html>
  );
}
