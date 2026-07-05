'use client';

import { IconKey, IconLock, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbAvatar } from '@/components/admin/shared/sb-avatar';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';
import { CreateDriverDialog } from './create-driver-dialog';
import { DeleteDriverDialog } from './delete-driver-dialog';

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

type UserRow = Record<string, unknown> & User;

export function UsersTable({ initialData }: { initialData: User[] }) {
  const [pinModal, setPinModal]         = useState<string | null>(null);
  const [pin,      setPin]              = useState('');
  const [pwModal,  setPwModal]          = useState<string | null>(null);
  const [password, setPassword]         = useState('');
  const [pwError,  setPwError]          = useState('');

  const utils = api.useUtils();

  const { data: users, refetch } = api.users.list.useQuery(undefined, {
    initialData,
  });

  const setPin_m = api.users.setPin.useMutation({
    onSuccess() { utils.users.list.invalidate(); },
  });

  const setPassword_m = api.users.setDriverPassword.useMutation({
    onSuccess() { utils.users.list.invalidate(); },
  });

  const handleSetPin = async () => {
    if (!pinModal || pin.length !== 4) return;
    try {
      await setPin_m.mutateAsync({ userId: pinModal, pin, idempotencyKey: uuidv4() });
      toast.success('PIN definido com sucesso');
      setPinModal(null);
      setPin('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao definir PIN');
    }
  };

  const handleSetPassword = async () => {
    if (!pwModal) return;
    if (password.length < 6) {
      setPwError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setPwError('');
    try {
      await setPassword_m.mutateAsync({
        userId: pwModal,
        password,
        idempotencyKey: uuidv4(),
      });
      toast.success('Senha definida com sucesso');
      setPwModal(null);
      setPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao definir senha');
    }
  };

  const openPinModal = (userId: string) => { setPinModal(userId); setPin(''); };
  const openPwModal  = (userId: string) => {
    setPwModal(userId);
    setPassword('');
    setPwError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CreateDriverDialog onSuccess={() => refetch()} />
      </div>

      <div className="card">
        <SbTable<UserRow>
          columns={[
            { key: 'nome',   label: 'Nome',      width: '1.2fr', wide: true },
            { key: 'email',  label: 'E-mail',    width: '1.4fr', wide: true },
            { key: 'tel',    label: 'Telefone',  width: '0.7fr'             },
            { key: 'role',   label: 'Role',      width: '0.9fr'             },
            { key: 'pin',    label: 'PIN',        width: '0.8fr'             },
            { key: 'senha',  label: 'Senha',      width: '0.8fr'             },
            { key: 'acoes',  label: '',           width: '240px', align: 'right', wide: true },
          ]}
          rows={users as UserRow[]}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={IconUsers}
              title="Nenhum usuário encontrado"
              sub="Crie o primeiro motorista para começar."
            />
          }
          renderCell={(r, k) => {
            if (k === 'nome')
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <SbAvatar name={r.name} size={30} />
                  <b>{r.name}</b>
                </span>
              );
            if (k === 'email')
              return <span style={{ color: 'var(--ink-2)' }}>{r.email ?? '—'}</span>;
            if (k === 'tel')
              return <span style={{ color: 'var(--ink-2)' }}>{r.phone ?? '—'}</span>;
            if (k === 'role') {
              if (r.role === 'admin')   return <StateBadge kind="violet">Administrador</StateBadge>;
              if (r.role === 'manager') return <StateBadge kind="info">Gerente</StateBadge>;
              return                           <StateBadge kind="success">Motorista</StateBadge>;
            }
            if (k === 'pin') {
              if (r.role !== 'driver') return <span style={{ color: 'var(--faint)' }}>—</span>;
              return r.hasPinSet
                ? <StateBadge kind="success">PIN configurado ✓</StateBadge>
                : <StateBadge kind="warn">Sem PIN ⚠</StateBadge>;
            }
            if (k === 'senha') {
              if (r.role !== 'driver') return <span style={{ color: 'var(--faint)' }}>—</span>;
              return r.hasPasswordSet
                ? <StateBadge kind="success">Senha definida ✓</StateBadge>
                : <StateBadge kind="warn">Sem senha ⚠</StateBadge>;
            }
            if (k === 'acoes') {
              if (r.role !== 'driver') return null;
              return (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openPinModal(r.id)}
                    aria-pressed={pinModal === r.id}
                  >
                    <IconKey size={13} />
                    {r.hasPinSet ? 'Alterar PIN' : 'Definir PIN'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openPwModal(r.id)}
                    aria-pressed={pwModal === r.id}
                  >
                    <IconLock size={13} />
                    {r.hasPasswordSet ? 'Alterar senha' : 'Definir senha'}
                  </button>
                  <DeleteDriverDialog
                    driver={{ id: r.id, name: r.name }}
                    onSuccess={() => refetch()}
                  />
                </span>
              );
            }
            return null;
          }}
        />
      </div>

      {/* Modal de PIN */}
      {pinModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'oklch(0.2 0.04 256 / 0.45)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{
              width: 320,
              padding: 24,
              boxShadow: 'var(--shadow-lg)',
              animation: 'popIn .2s cubic-bezier(.2,.9,.3,1.2)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {users.find((u) => u.id === pinModal)?.hasPinSet ? 'Alterar PIN' : 'Definir PIN'} do
              motorista
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
              PIN de 4 dígitos para confirmar operações no PWA. Após salvar, não será possível
              recuperá-lo.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              autoFocus
              style={{
                width: '100%',
                marginBottom: 16,
                textAlign: 'center',
                fontSize: 22,
                letterSpacing: '0.3em',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setPinModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSetPin}
                disabled={pin.length !== 4 || setPin_m.isPending}
              >
                {setPin_m.isPending ? 'A salvar…' : 'Salvar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Senha */}
      {pwModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'oklch(0.2 0.04 256 / 0.45)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{
              width: 340,
              padding: 24,
              boxShadow: 'var(--shadow-lg)',
              animation: 'popIn .2s cubic-bezier(.2,.9,.3,1.2)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {users.find((u) => u.id === pwModal)?.hasPasswordSet
                ? 'Alterar senha'
                : 'Definir senha'}{' '}
              do motorista
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
              Senha para acesso ao PWA via e-mail + senha. Mínimo 6 caracteres.
            </p>
            <input
              type="text"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
              placeholder="Senha do motorista"
              autoFocus
              style={{
                width: '100%',
                marginBottom: pwError ? 8 : 16,
                fontSize: 14,
                padding: '10px 12px',
                border: `1px solid ${pwError ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 10,
                background: 'var(--surface)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { if (!pwError) e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={(e) => { if (!pwError) e.target.style.borderColor = 'var(--border)'; }}
            />
            {pwError && (
              <p style={{ fontSize: 12, color: 'var(--danger-ink)', marginBottom: 12 }}>
                {pwError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setPwModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSetPassword}
                disabled={password.length < 6 || setPassword_m.isPending}
              >
                {setPassword_m.isPending ? 'A salvar…' : 'Salvar senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
