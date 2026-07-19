import type { InstalledApp } from "./api/installed-apps";

export function selectInstalledAppAvailability(app: InstalledApp) {
  const installationStatus = app.installation_status ?? (app.enabled === false ? "disabled" : "installed");
  const runtimeHealth = app.runtime_health.status;
  const licenseStatus = app.license_status ?? ((app.manifest.licensing as { required?: boolean } | undefined)?.required !== true ? "not_required" : app.resolved_entitlement ? "active" : "missing");
  const uiStatus = app.ui_status ?? (app.ui_url && app.ui_integrity ? "ready" : "missing");
  if (app.availability && app.availability_reason !== undefined) return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: app.availability, reason: app.availability_reason };
  if (installationStatus === "disabled") return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "disabled" as const, reason: "application_disabled" as const };
  if (licenseStatus === "missing" || licenseStatus === "invalid") return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "blocked" as const, reason: "license_missing" as const };
  if (runtimeHealth === "degraded") return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "degraded" as const, reason: "runtime_degraded" as const };
  if (runtimeHealth !== "healthy") return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "unavailable" as const, reason: runtimeHealth === "stopped" ? "runtime_stopped" as const : "runtime_unreachable" as const };
  if (uiStatus !== "ready") return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "unavailable" as const, reason: "ui_missing" as const };
  return { installationStatus, runtimeHealth, licenseStatus, uiStatus, availability: "available" as const, reason: null };
}
