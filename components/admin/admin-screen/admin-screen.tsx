'use client';

import { IconBuilding, IconClock, IconMail, IconShieldCheck, IconUsers } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { CompanySettingsForm } from '@/components/admin/company/company-settings-form';
import { PointageView } from '@/components/admin/pointage/pointage-view';
import { TotpSetup } from '@/components/admin/settings/totp-setup';
import { UsersTable } from '@/components/admin/users/users-table';

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'manager' | 'driver';
  active: boolean;
  hasPinSet: boolean;
  hasPasswordSet: boolean;
  defaultLocationId: string | null;
  lastLoginAt: Date | null;
};

interface AdminScreenProps {
  initialUsers: User[];
  totpEnabled: boolean;
  defaultTab?: string;
}

const TABS = [
  { id: 'usuarios',  label: 'Usuários',  icon: IconUsers       },
  { id: 'pointage',  label: 'Pointage',  icon: IconClock       },
  { id: 'seguranca', label: 'Segurança', icon: IconShieldCheck  },
  { id: 'empresa',   label: 'Empresa',   icon: IconBuilding     },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminScreen({ initialUsers, totpEnabled, defaultTab = 'usuarios' }: AdminScreenProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const rawTab       = searchParams.get('tab') ?? defaultTab;
  const tab: TabId   = (TABS.some((t) => t.id === rawTab) ? rawTab : 'usuarios') as TabId;

  const setTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', id);
      router.push(`/admin?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="screen-enter">
      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Usuários */}
      {tab === 'usuarios' && (
        <UsersTable initialData={initialUsers} />
      )}

      {/* Pointage */}
      {tab === 'pointage' && <PointageView />}

      {/* Empresa */}
      {tab === 'empresa' && (
        <div style={{ maxWidth: 620 }}>
          <CompanySettingsForm />
        </div>
      )}

      {/* Segurança */}
      {tab === 'seguranca' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            maxWidth: 880,
          }}
        >
          {/* TOTP card */}
          <TotpSetup totpEnabled={totpEnabled} />

          {/* Magic-link info card (visual only) */}
          <div className="card" style={{ padding: 'var(--card-pad)' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div
                style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: 'var(--primary-soft)', color: 'var(--primary-strong)',
                }}
              >
                <IconMail size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Acesso por link mágico</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Login sem senha por link enviado ao e-mail. Links expiram em 10 minutos.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
