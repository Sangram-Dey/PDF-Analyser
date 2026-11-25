import { SignIn } from "@clerk/nextjs";

// [[...sign-in]] catches Clerk's extra steps (e.g. /sign-in/factor-one) on the same page.
export default function SignInPage() {
  return <SignIn />;
}
