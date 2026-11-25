import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Sourcework",
  description: "Project document search and answers",
};

// Clerk's sign-in, sign-up and user menu use the app's own colours and font.
const clerkAppearance = {
  variables: {
    colorPrimary: "#177f73",
    colorText: "#172b33",
    colorTextSecondary: "#5d7276",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
