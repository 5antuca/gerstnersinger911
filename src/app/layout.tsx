import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// viewport-fit cover habilita env(safe-area-inset-*) en teléfonos con notch
// (el bottom bar los usa para no quedar bajo el recorte en apaisado).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // metadataBase: sin esto Next no arma la URL ABSOLUTA de la imagen de
  // preview, y WhatsApp / iMessage no la levantan.
  metadataBase: new URL("https://studio.gerstnerwerks.com"),
  title: "GerstnerWerks Configurator",
  description: "Configurador 3D Privado - GerstnerWerks",
  robots: {
    index: false,
    follow: false,
  },
  // Preview al pegar el link. La imagen la genera src/app/opengraph-image.tsx
  // (logo blanco sobre el fondo oscuro del studio) y /ver la hereda.
  openGraph: {
    title: "GerstnerWerks",
    description: "Visualizador 3D",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
