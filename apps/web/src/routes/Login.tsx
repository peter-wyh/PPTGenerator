import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export function Login() {
  const navigate = useNavigate();
  const { login, status, loginError } = useAuthStore();
  const [email, setEmail] = useState('admin@mediakit.local');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authed') navigate('/projects', { replace: true });
  }, [status, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (ok) navigate('/projects', { replace: true });
  }

  return (
    <div className="flex h-full items-center justify-center bg-surface-subtle">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-surface-primary p-8 shadow-lg"
      >
        <h1 className="font-headings text-3xl font-semibold tracking-tight text-foreground-primary">
          Report Generator
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">广告投放报告编辑器 · 登录</p>

        <div className="mt-6 space-y-4">
          <Input
            label="邮箱"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="密码"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {loginError && <p className="text-sm text-red">{loginError}</p>}
          <Button type="submit" loading={submitting} className="w-full">
            登录
          </Button>
        </div>
      </form>
    </div>
  );
}
