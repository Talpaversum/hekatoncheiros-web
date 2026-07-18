import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "../auth/auth-fetch";

export type DeveloperConnection = { connection_id: string; tenant_id: string; owner_user_id:string; visibility:"personal"|"tenant"; provider: "github"|"gitlab"|"git"|"local_workspace"|"private_feed"; auth_method: string; owner_label: string; status: "pending"|"verified"|"error"|"revoked"; scopes: string[]; metadata: Record<string,unknown>; has_credential: boolean; last_used_at: string|null; last_verified_at: string|null; created_at: string; updated_at: string };
const key=["developer-connections"] as const;
export function useDeveloperConnections(){return useQuery({queryKey:key,queryFn:()=>authFetch<{items:DeveloperConnection[];workspace_roots:string[]}>("/developer-connections")});}
export function useDeveloperConnectionMutation<T>(action:(input:T)=>Promise<unknown>){const client=useQueryClient();return useMutation({mutationFn:action,onSuccess:()=>client.invalidateQueries({queryKey:key})});}
export const developerConnectionRequests={
  create:(input:{visibility:DeveloperConnection["visibility"];provider:DeveloperConnection["provider"];auth_method:string;owner_label:string;scopes:string[];credential?:string;metadata:Record<string,unknown>})=>authFetch<DeveloperConnection>("/developer-connections",{method:"POST",body:JSON.stringify(input)}),
  verify:(id:string)=>authFetch<DeveloperConnection>(`/developer-connections/${encodeURIComponent(id)}/verify`,{method:"POST"}),
  revoke:(id:string)=>authFetch<void>(`/developer-connections/${encodeURIComponent(id)}`,{method:"DELETE"}),
};
