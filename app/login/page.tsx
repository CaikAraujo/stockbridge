import { LoginForm } from './_components/login-form';
import { sendMagicLinkAction } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#F2F5F9',
        fontFamily: 'var(--font-driver)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 430 }}>
        {/* Header com gradiente azul */}
        <div
          style={{
            background: 'linear-gradient(160deg,#1D5FE0,#1148B8)',
            padding: '64px 28px 72px',
            borderRadius: '0 0 32px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              width: 52,
              height: 52,
              background: '#FFFFFF',
              borderRadius: 16,
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 20px rgba(9,30,80,.3)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D5FE0" strokeWidth="2">
              <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
              <path d="M3 8l9 5 9-5M12 13v8" />
            </svg>
          </div>
          <div>
            <div
              style={{
                font: '800 28px var(--font-driver)',
                color: '#FFFFFF',
                letterSpacing: '-.02em',
              }}
            >
              vf·stock
            </div>
            <div
              style={{
                font: '500 14px var(--font-driver)',
                color: 'rgba(255,255,255,.72)',
                marginTop: 4,
              }}
            >
              Controle de estoque em campo
            </div>
          </div>
        </div>

        {/* Card do formulário sobreposto ao header */}
        <div style={{ padding: '0 20px 32px', marginTop: -32 }}>
          <LoginForm
            sendMagicLink={sendMagicLinkAction}
            initialError={error}
            callbackUrl={callbackUrl}
          />
          <p
            style={{
              textAlign: 'center',
              font: '500 12px var(--font-driver)',
              color: '#A6B1C2',
              marginTop: 16,
            }}
          >
            stock.vffroid.ch · v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
