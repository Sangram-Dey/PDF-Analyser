import { EmbedChat } from "@/components/embed/EmbedChat";
import { findWidget, publicConfig } from "@/lib/services/widget";

export const dynamic = "force-dynamic"; // settings can change at any time
export const metadata = { title: "Chat", robots: { index: false } };

// "#1f5f7a" → "198 59% 30%" (the format the colour variables in globals.css use), plus readable text on it.
function brandColour(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
    if (h < 0) h += 360;
  }
  const lum = [r, g, b]
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const color = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  return { "--primary": color, "--ring": color, "--primary-foreground": lum > 0.4 ? "240 6% 10%" : "0 0% 100%" };
}

// The website widget's chat page, shown in an iframe on the owner's sites (public, no sign-in: see middleware.js).
export default async function EmbedPage({ params }) {
  const found = await findWidget(params.key).catch(() => null);
  if (!found) {
    return (
      <p className="grid h-dvh place-items-center bg-card px-6 text-center text-sm text-muted-foreground">
        This assistant isn&apos;t available.
      </p>
    );
  }
  const config = publicConfig(found);
  const theme = JSON.stringify(config.theme);
  // The widget's own theme: "auto" follows the visitor's system, not the app's saved choice.
  const themeScript = `document.documentElement.dataset.theme=${theme}==="auto"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):${theme}`;

  return (
    <div style={config.color ? brandColour(config.color) : undefined}>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <EmbedChat widgetKey={params.key} config={config} allowedOrigins={found.widget.allowedOrigins} />
    </div>
  );
}
