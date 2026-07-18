import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "../auth/auth-fetch";

export type DeveloperConnection = { connection_id: string; tenant_id: string; owner_user_id:string; visibility:"personal"|"tenant"; provider: "github"|"gitlab"|"git"|"local_workspace"|"private_feed"; auth_method: string; owner_label: string; status: "pending"|"verified"|"error"|"revoked"; scopes: string[]; metadata: Record<string,unknown>; has_credential: boolean; last_used_at: string|null; last_verified_at: string|null; created_at: string; updated_at: string };
const key=["developer-connections"] as const;
export function useDeveloperConnections(){return useQuery({queryKey:key,queryFn:()=>authFetch<{items:DeveloperConnection[];workspace_roots:string[]}>("/developer-connections")});}
export type DeveloperRepository={id:string;full_name:string;namespace:string;private:boolean;default_ref:string};
export type DeveloperRef={name:string;type:"branch"|"tag";revision:string};
export function useDeveloperRepositories(connectionId:string){return useQuery({queryKey:["developer-connection-repositories",connectionId],queryFn:()=>authFetch<{supports_repository_discovery:boolean;items:DeveloperRepository[]}>(`/developer-connections/${encodeURIComponent(connectionId)}/repositories`),enabled:Boolean(connectionId)});}
export function useDeveloperRepositoryRefs(connectionId:string,repository:string){return useQuery({queryKey:["developer-connection-refs",connectionId,repository],queryFn:()=>authFetch<{items:DeveloperRef[]}>(`/developer-connections/${encodeURIComponent(connectionId)}/refs?repository=${encodeURIComponent(repository)}`),enabled:Boolean(connectionId&&repository)});}
export function useDeveloperConnectionMutation<T>(action:(input:T)=>Promise<unknown>){const client=useQueryClient();return useMutation({mutationFn:action,onSuccess:()=>client.invalidateQueries({queryKey:key})});}
export const developerConnectionRequests={
  create:(input:{visibility:DeveloperConnection["visibility"];provider:DeveloperConnection["provider"];auth_method:string;owner_label:string;scopes:string[];credential?:string;metadata:Record<string,unknown>})=>authFetch<DeveloperConnection>("/developer-connections",{method:"POST",body:JSON.stringify(input)}),
  verify:(id:string)=>authFetch<DeveloperConnection>(`/developer-connections/${encodeURIComponent(id)}/verify`,{method:"POST"}),
  revoke:(id:string)=>authFetch<void>(`/developer-connections/${encodeURIComponent(id)}`,{method:"DELETE"}),
};
