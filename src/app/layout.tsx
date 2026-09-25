import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Inference Logging",
  description: "Provider-agnostic LLM inference logging with a TypeScript SDK, asynchronous ingestion, and a telemetry dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
