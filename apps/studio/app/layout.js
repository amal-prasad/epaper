import './globals.css'

export const metadata = { title: 'Studio' }

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head><link rel="stylesheet" href="/fonts/fonts.css" /></head>
      <body>{children}</body>
    </html>
  )
}
