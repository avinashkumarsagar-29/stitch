// import type { Metadata } from "next";
// import "./globals.css";
// import Toast from "./components/Toast";
// import LayoutWrapper from "./components/LayoutWrapper";

// export const metadata: Metadata = {
//   title: "Stitch | Tailoring & Design",
//   description: "Book tailoring pickup and drop-off services with Stitch.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en" className="h-full antialiased">
//       <head>
//         <link rel="manifest" href="/manifest.json" />
//         <meta name="theme-color" content="#c322f4" />
//         <link
//           rel="stylesheet"
//           href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css"
//         />
//         <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
//       </head>
//       <body className="min-h-full flex flex-col">
//         <LayoutWrapper>{children}</LayoutWrapper>
//         <Toast />
//       </body>
//     </html>
//   );
// }
// import type { Metadata } from "next";
// import "./globals.css";
// import Toast from "./components/Toast";
// import LayoutWrapper from "./components/LayoutWrapper";

// export const metadata: Metadata = {
//   title: "Stitch — Custom Tailoring & Garment Booking",
//   description: "Book custom tailoring services online with Stitch. Schedule pickup & drop-off, get clothes stitched by expert tailors, and track your order in real-time.",
//   keywords: ["custom tailoring", "online darzi", "garment booking", "stitch", "tailor near me", "pickup dropoff tailoring"],
//   openGraph: {
//     title: "Stitch — Custom Tailoring & Garment Booking",
//     description: "Book custom tailoring services online. Schedule pickup & drop-off with expert tailors.",
//     url: "https://stitch.org.in",
//     siteName: "Stitch",
//     type: "website",
//   },
//   twitter: {
//     card: "summary",
//     title: "Stitch — Custom Tailoring & Garment Booking",
//     description: "Book custom tailoring services online. Schedule pickup & drop-off with expert tailors.",
//   },
//   metadataBase: new URL("https://stitch.org.in"),
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en" className="h-full antialiased">
//       <head>
//         <link rel="manifest" href="/manifest.json" />
//         <meta name="theme-color" content="#c322f4" />
//         <link
//           rel="stylesheet"
//           href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css"
//         />
//         <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
//       </head>
//       <body className="min-h-full flex flex-col">
//         <LayoutWrapper>{children}</LayoutWrapper>
//         <Toast />
//       </body>
//     </html>
//   );
// }
import type { Metadata } from "next";
import "./globals.css";
import Toast from "./components/Toast";
import LayoutWrapper from "./components/LayoutWrapper";

export const metadata: Metadata = {
  title: "Stitch — Custom Tailoring & Garment Booking",
  description: "Book custom tailoring services online with Stitch. Schedule pickup & drop-off, get clothes stitched by expert tailors, and track your order in real-time.",
  keywords: ["custom tailoring", "online darzi", "garment booking", "stitch", "tailor near me", "pickup dropoff tailoring"],
  openGraph: {
    title: "Stitch — Custom Tailoring & Garment Booking",
    description: "Book custom tailoring services online. Schedule pickup & drop-off with expert tailors.",
    url: "https://stitch.org.in",
    siteName: "Stitch",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Stitch — Custom Tailoring & Garment Booking",
    description: "Book custom tailoring services online. Schedule pickup & drop-off with expert tailors.",
  },
  metadataBase: new URL("https://stitch.org.in"),
  verification: {
    google: "Bukbm9ED7vj6yEDk-F3Fa4wjN5SDDggIXJTgSw5JCgI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#c322f4" />
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
