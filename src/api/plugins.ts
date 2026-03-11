import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PluginList } from "@/types/plugins";

export function usePlugins() {
  return useQuery<PluginList, Error>({
    queryKey: ["plugins"],
    queryFn: () => apiClient.get<PluginList>("/api/plugins/"),
  });
}
