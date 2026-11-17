/**
 * `metadataBase` turns every relative metadata URL into a production absolute one. Without it
 * Next falls back to http://localhost:3000, so a relative `og:image` ships as
 * http://localhost:3000/… — a broken social preview for every visitor, and a loopback literal
 * on a public page (the exact class of leak the store build gate exists to stop).
 */
export const metadata = {
  metadataBase: new URL("https://flashtech.biz"),
  title: 'Flash Tech — IT, phones and AI for Grayson County businesses',
  description: 'Managed IT, business phone systems and AI receptionists for small businesses in Sherman, Denison and Grayson County, Texas.',
  openGraph: {
    siteName: 'Flash Tech',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
