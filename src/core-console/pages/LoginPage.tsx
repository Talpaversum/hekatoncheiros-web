import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../../data/auth/auth-api";
import { Button } from "../../ui-kit/components/Button";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/core/dashboard");
    } catch {
      setError("Neplatné přihlašovací údaje.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hc-bg px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Přihlášení do Core</h1>
        <p className="mt-2 text-sm text-hc-muted">Použij admin@example.com / admin</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs uppercase text-hc-muted">Email</label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase text-hc-muted">Heslo</label>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error && <div className="text-sm text-hc-danger">{error}</div>}
          <Button type="submit" disabled={loading}>
            {loading ? "Přihlašuji…" : "Přihlásit"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
