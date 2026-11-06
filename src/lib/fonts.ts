import localFont from "next/font/local";

export const bodyFont = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "100 900",
});

export const displayFont = localFont({
  src: [
    { path: "../fonts/InterDisplay-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "../fonts/InterDisplay-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const monoFont = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/JetBrainsMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});
