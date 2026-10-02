import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
let token = "";
// Web support is only for development; keep its session in memory, never localStorage.
const key = "raabta-session";
const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
export const configured = !!base;
export async function restoreToken() {
  token =
    Platform.OS === "web" ? "" : (await SecureStore.getItemAsync(key)) || "";
  return token;
}
export async function saveToken(value: string) {
  token = value;
  if (Platform.OS !== "web") {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!base)
    throw new ApiError(
      503,
      "Add EXPO_PUBLIC_API_URL to mobile/.env to connect your backend.",
    );
  if (!__DEV__ && !base.startsWith("https://"))
    throw new ApiError(503, "Release builds require an HTTPS backend.");
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await r.json();
    if (!r.ok)
      throw new ApiError(r.status, json.error || "Something went wrong.");
    return json;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      0,
      "Could not reach Raabta. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export const requestId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
