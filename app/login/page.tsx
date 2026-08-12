import type { Metadata } from "next";
import { isAuthConfigured } from "@/auth";
import LoginClient from "@/components/LoginClient";

export const metadata: Metadata = {
  title: "Sign in · Herdr",
};

export default function LoginPage() {
  return <LoginClient configured={isAuthConfigured()} />;
}
