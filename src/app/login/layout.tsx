import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | IOT-Automation",
  description: "Sign in to the IOT-Automation farm control center",
};

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}
