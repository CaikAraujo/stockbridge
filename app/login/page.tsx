import { LoginForm } from './_components/login-form';
import { sendMagicLinkAction } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <div className="login-wrap">
      {/* ── Coluna esquerda: hero navy ── */}
      <div className="login-hero">
        <div className="login-grid-deco" />

        {/* Cubos flutuantes decorativos */}
        <svg className="float-cube" style={{ top: '18%', right: '14%' }} width="90" height="90" viewBox="0 0 40 40" aria-hidden="true">
          <g transform="translate(20 21)" stroke="oklch(0.75 0.1 220 / 0.6)" strokeWidth="1.4" fill="none" strokeLinejoin="round">
            <path d="M0-9.5L8.2-4.75v9.5L0 9.5l-8.2-4.75v-9.5z" />
            <path d="M-8.2-4.75L0 0l8.2-4.75M0 0v9.5" />
          </g>
        </svg>
        <svg className="float-cube" style={{ bottom: '24%', right: '32%', animationDelay: '-3s' }} width="54" height="54" viewBox="0 0 40 40" aria-hidden="true">
          <g transform="translate(20 21)" stroke="oklch(0.7 0.09 250 / 0.45)" strokeWidth="1.4" fill="none" strokeLinejoin="round">
            <path d="M0-9.5L8.2-4.75v9.5L0 9.5l-8.2-4.75v-9.5z" />
            <path d="M-8.2-4.75L0 0l8.2-4.75M0 0v9.5" />
          </g>
        </svg>

        {/* Logo + Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <svg width={40} height={40} viewBox="0 0 40 40" aria-hidden="true">
            <defs>
              <linearGradient id="lgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="oklch(0.62 0.17 245)" />
                <stop offset="1" stopColor="oklch(0.46 0.19 262)" />
              </linearGradient>
              <linearGradient id="lgFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.75)" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#lgGrad)" />
            <g transform="translate(20 21)">
              <path d="M0-9.5L8.2-4.75v9.5L0 9.5l-8.2-4.75v-9.5z" fill="none" stroke="url(#lgFace)" strokeWidth="2" strokeLinejoin="round" />
              <path d="M-8.2-4.75L0 0l8.2-4.75M0 0v9.5" fill="none" stroke="url(#lgFace)" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="0" cy="0" r="1.6" fill="#fff" />
            </g>
          </svg>
          <span style={{ fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: '#fff' }}>
            Stock<span style={{ color: 'var(--accent)' }}>Bridge</span>
          </span>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative' }}>
          <h1 style={{ fontSize: 'clamp(26px,3.2vw,40px)', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.02em', maxWidth: 480, margin: 0 }}>
            Seu estoque, do depósito<br />
            ao <span style={{ color: 'var(--accent)' }}>caminhão</span>.
          </h1>
          <p style={{ color: 'oklch(0.78 0.03 250)', fontSize: 15, maxWidth: 420, marginTop: 12 }}>
            Controle de artigos, movimentações, transferências e frota — em tempo real, num só lugar.
          </p>
        </div>

        {/* Rodapé do hero */}
        <div className="hero-foot" style={{ display: 'flex', gap: 24, position: 'relative', color: 'oklch(0.65 0.03 250)', fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />
              <path d="M8.8 12l2.2 2.2 4.2-4.2" />
            </svg>
            Acesso por link seguro
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 12a8.5 8.5 0 1 1 2.5 6" />
              <path d="M3.5 18v-6h6" fill="none" />
              <path d="M12 8v4.5l3 2" />
            </svg>
            Auditoria completa
          </span>
        </div>
      </div>

      {/* ── Coluna direita: formulário ── */}
      <div className="login-form-side">
        <LoginForm
          sendMagicLink={sendMagicLinkAction}
          initialError={error}
          callbackUrl={callbackUrl}
        />
      </div>
    </div>
  );
}
