export const metadata = {
  title: 'Flash Tech — IT, phones and AI for Grayson County businesses',
  description: 'Managed IT, business phone systems and AI receptionists for small businesses in Sherman, Denison and Grayson County, Texas.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
