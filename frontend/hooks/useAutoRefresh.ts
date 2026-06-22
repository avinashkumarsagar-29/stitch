import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

export function useAutoRefresh(
  type: string,
  onRefresh: () => void
) {
  useEffect(() => {
    const socket = getSocket();

    function handleUpdate(data: { type: string }) {
      if (data.type === type || data.type === "all") {
        onRefresh();
      }
    }

    socket.on("data:updated", handleUpdate);

    return () => {
      socket.off("data:updated", handleUpdate);
    };
  }, [type, onRefresh]);
}
