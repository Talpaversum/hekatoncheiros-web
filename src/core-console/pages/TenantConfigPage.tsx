import { Card } from "../../ui-kit/components/Card";

const sections = ["Users", "Tenant details", "Licenses & App enablement"];

export function TenantConfigPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-hc-muted">Configuration</div>
        <div className="mt-1 text-2xl font-semibold">Tenant configuration</div>
      </div>

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section}>
            <div className="text-sm font-semibold">{section}</div>
            <div className="mt-2 text-xs text-hc-muted">Placeholder section</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
