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

// El login siempre se ve en modo oscuro. Dentro del sistema el modo es
// claro, salvo que la persona elija oscuro con el botón de sol/luna (se
// guarda en "tema"; al iniciar sesión se regresa a claro).
const THEME_INIT_SCRIPT = `try{var l=location.pathname.indexOf('/login')===0;if(l||localStorage.getItem('tema')==='oscuro'){document.documentElement.classList.add('dark')}localStorage.removeItem('theme')}catch(e){if(location.pathname.indexOf('/login')===0){document.documentElement.classList.add('dark')}}`;

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
