import { useQuery } from "@tanstack/react-query";
import { authFetch } from "../auth/auth-fetch";
import type { InstanceCapabilities } from "./author-portal";

export function useInstanceCapabilities() {
  return useQuery({ queryKey: ["platform-capabilities"], queryFn: () => authFetch<InstanceCapabilities>("/platform/capabilities"), staleTime: 30_000 });
}
