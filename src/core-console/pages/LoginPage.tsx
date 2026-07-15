import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../../data/auth/auth-api";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { Field } from "../../ui-kit/components/Page";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLocalization();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/core/dashboard");
    } catch {
      setError(t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hc-bg px-4">
      <Card className="w-full max-w-sm border border-hc-outline shadow-none">
        <h1 className="text-xl font-semibold">{t("auth.signInTitle")}</h1>
        <p className="mt-1 text-sm text-hc-muted">{t("auth.signInHint")}</p>
        <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
          <Field label={t("account.email")}>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label={t("auth.password")}>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error && <div className="text-sm text-hc-danger">{error}</div>}
          <Button type="submit" disabled={loading}>
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
