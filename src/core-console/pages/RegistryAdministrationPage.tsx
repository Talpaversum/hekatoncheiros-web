import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthorOverview } from "../../data/api/author-portal";
import { readErrorMessage } from "../../data/api/read-error-message";
import { useLocalization } from "../../localization/LocalizationProvider";
import { PageHeader } from "../../ui-kit/components/Page";
import { ToastNotice } from "../../ui-kit/components/ToastNotice";
import { Applications, Catalog, Reviews } from "./AuthorPortalPage";

export function RegistryAdministrationPage(){const {t}=useLocalization();const {pathname}=useLocation();const overview=useAuthorOverview();const [message,setMessage]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const notify=async(action:()=>Promise<unknown>,success:string)=>{try{await action();setMessage(success);setError(null);}catch(err){setError(readErrorMessage(err));}};const section=pathname.split("/")[3]??"";const body=section==="catalog"?<Catalog registry notify={notify}/>:section==="applications"?<Applications registry catalogOperator={Boolean(overview.data?.capabilities.catalog_review)} runtimeOperator={Boolean(overview.data?.capabilities.runtime_review)} notify={notify}/>:<Reviews enabled={Boolean(overview.data?.capabilities.author_review)} notify={notify}/>;return <div className="space-y-5"><PageHeader eyebrow={t("nav.platformSettings")} title={t("authorPortal.registryAdministration")} description={t("authorPortal.reviewDescription")}/><ToastNotice message={error??message} tone={error?"danger":"success"} onDismiss={()=>{setError(null);setMessage(null);}}/>{body}</div>}
