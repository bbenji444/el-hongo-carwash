import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "El Hongo Car Wash — Admin",
  description: "Sistema de administración de El Hongo Car Wash",
  icons: {
    icon: "/logo.jpg",
  },
};

// Modo oscuro por omisión: solo queda en claro si la persona lo eligió con
// el botón de sol/luna (se guarda en "tema"). La clave anterior ("theme")
// se descarta para que todos arranquen en oscuro con esta versión.
const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('tema')!=='claro'){document.documentElement.classList.add('dark')}localStorage.removeItem('theme')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
