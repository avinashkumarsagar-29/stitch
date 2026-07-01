const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.includes("vercel.app")) {
      return `http://${hostname}:4000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
};

export const API_URL = getApiUrl().replace(/\/+$/, "");
