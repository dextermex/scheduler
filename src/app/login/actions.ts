"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { expectedToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) redirect("/");
  if (password !== appPassword) redirect("/login?error=1");

  const token = await expectedToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token ?? "", sessionCookieOptions());
  redirect("/");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
