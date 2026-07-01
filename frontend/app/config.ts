const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.endsWith(".local");

    if (hostname && isLocal) {
      return `http://${hostname}:4000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
};

export const API_URL = getApiUrl().replace(/\/+$/, "");
