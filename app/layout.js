import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Sourcework",
  description: "Project document search and answers",
};

// Clerk's sign-in, sign-up and user menu use the app's own colours and font (the dark lab palette in globals.css).
const clerkAppearance = {
  variables: {
    colorPrimary: "#11d4ce",
    colorTextOnPrimaryBackground: "#0b1114",
    colorText: "#e7edef",
    colorTextSecondary: "#95a6ac",
    colorBackground: "#13181b",
    colorInputBackground: "#1d2326",
    colorInputText: "#e7edef",
    colorNeutral: "#e7edef", // Clerk derives its greys (social buttons, dividers) from this: light on the dark card
    colorDanger: "#e7555f",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
};

// Picks the theme before the page paints, so it never flashes the wrong one: your saved choice
// (components/workspace/ThemeToggle.jsx), otherwise your computer's setting. Sets <html data-theme>.
const themeScript = `try{var t=localStorage.getItem("sourcework-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up">
      {/* suppressHydrationWarning: the theme script sets data-theme before React loads, on purpose */}
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
