import type { Metadata } from 'next'
import { Lora, Epilogue } from 'next/font/google'
import './globals.css'

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const epilogue = Epilogue({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'ArtisTrust — Art Catalog',
  description: 'A private catalog for paintings and photographs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${lora.variable} ${epilogue.variable}`}>
      <body>{children}</body>
    </html>
  )
}
