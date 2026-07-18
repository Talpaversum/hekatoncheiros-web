import { useState } from "react";
import { useAuthorOverview } from "../../data/api/author-portal";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useLocalization } from "../../localization/LocalizationProvider";
import { PageHeader } from "../../ui-kit/components/Page";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { BecomeAuthor } from "./AuthorPortalPage";

export function AuthorOnboardingPage() {
  const { t } = useLocalization(); const overview = useAuthorOverview(); const [message, setMessage] = useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  const notify=async(action:()=>Promise<unknown>,success:string)=>{try{await action();setMessage(success);setError(null);}catch(err){setError(readErrorMessage(err));}};
  return <div className="space-y-5"><PageHeader eyebrow={t("authorPortal.eyebrow")} title={t("authorPortal.become")} description={t("authorPortal.becomeDescription")} /><ToastNotice message={error??message} tone={error?"danger":"success"} onDismiss={()=>{setError(null);setMessage(null);}}/><BecomeAuthor profiles={[]} requests={overview.data?.requests??[]} notify={notify}/></div>;
}
