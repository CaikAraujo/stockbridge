'use client';

import { IconAlertTriangle, IconDots, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbAvatar } from '@/components/admin/shared/sb-avatar';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateDriverDialog } from './create-driver-dialog';

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
  const [pinModal,      setPinModal]      = useState<string | null>(null);
  const [pin,           setPin]           = useState('');
  const [pwModal,       setPwModal]       = useState<string | null>(null);
  const [password,      setPassword]      = useState('');
  const [pwError,       setPwError]       = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<{ id: string; name: string } | null>(null);

  const utils = api.useUtils();

  const { data: users, refetch } = api.users.list.useQuery(undefined, { initialData });

  const setPin_m = api.users.setPin.useMutation({
    onSuccess() { utils.users.list.invalidate(); },
  });

  const setPassword_m = api.users.setDriverPassword.useMutation({
    onSuccess() { utils.users.list.invalidate(); },
  });

  const deleteDriver_m = api.users.deleteDriver.useMutation({
    onSuccess() {
      toast.success(`Motorista "${deleteTarget?.name}" excluído com sucesso.`);
      utils.users.list.invalidate();
      setDeleteTarget(null);
      refetch();
    },
    onError(err) {
      toast.error(err.message);
    },
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
  const openPwModal  = (userId: string) => { setPwModal(userId); setPassword(''); setPwError(''); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CreateDriverDialog onSuccess={() => refetch()} />
      </div>

      <div className="card">
        <SbTable<UserRow>
          columns={[
            { key: 'nome',         label: 'Nome',         width: '1.4fr', wide: true  },
            { key: 'email',        label: 'E-mail',       width: '1.6fr', wide: true  },
            { key: 'role',         label: 'Role',         width: '0.9fr'              },
            { key: 'credenciais',  label: 'Credenciais',  width: '1fr'                },
            { key: 'acoes',        label: '',             width: '52px',  align: 'right' },
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
            if (k === 'role') {
              if (r.role === 'admin')   return <StateBadge kind="violet">Administrador</StateBadge>;
              if (r.role === 'manager') return <StateBadge kind="info">Gerente</StateBadge>;
              return                           <StateBadge kind="success">Motorista</StateBadge>;
            }
            if (k === 'credenciais') {
              if (r.role !== 'driver')
                return <span style={{ color: 'var(--faint)' }}>—</span>;
              return (
                <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                  {r.hasPinSet
                    ? <StateBadge kind="success">PIN configurado ✓</StateBadge>
                    : <StateBadge kind="warn">Sem PIN ⚠</StateBadge>}
                  {r.hasPasswordSet
                    ? <StateBadge kind="success">Senha definida ✓</StateBadge>
                    : <StateBadge kind="warn">Sem senha ⚠</StateBadge>}
                </span>
              );
            }
            if (k === 'acoes') {
              if (r.role !== 'driver') return null;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 6px', height: 30 }}
                      aria-label="Ações"
                    >
                      <IconDots size={15} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    <DropdownMenuItem onSelect={() => openPinModal(r.id)}>
                      {r.hasPinSet ? 'Alterar PIN' : 'Definir PIN'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openPwModal(r.id)}>
                      {r.hasPasswordSet ? 'Alterar senha' : 'Definir senha'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteTarget({ id: r.id, name: r.name })}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'oklch(0.2 0.04 256 / 0.45)', backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{ width: 320, padding: 24, boxShadow: 'var(--shadow-lg)', animation: 'popIn .2s cubic-bezier(.2,.9,.3,1.2)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {users.find((u) => u.id === pinModal)?.hasPinSet ? 'Alterar PIN' : 'Definir PIN'} do motorista
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
              PIN de 4 dígitos para confirmar operações no PWA. Após salvar, não será possível recuperá-lo.
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
                width: '100%', marginBottom: 16, textAlign: 'center',
                fontSize: 22, letterSpacing: '0.3em', padding: '10px 12px',
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--surface)', outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPinModal(null)}>
                Cancelar
              </button>
              <button
                type="button" className="btn btn-primary" style={{ flex: 1 }}
                onClick={handleSetPin} disabled={pin.length !== 4 || setPin_m.isPending}
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
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'oklch(0.2 0.04 256 / 0.45)', backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{ width: 340, padding: 24, boxShadow: 'var(--shadow-lg)', animation: 'popIn .2s cubic-bezier(.2,.9,.3,1.2)' }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {users.find((u) => u.id === pwModal)?.hasPasswordSet ? 'Alterar senha' : 'Definir senha'} do motorista
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
                width: '100%', marginBottom: pwError ? 8 : 16, fontSize: 14,
                padding: '10px 12px',
                border: `1px solid ${pwError ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: 10, background: 'var(--surface)', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { if (!pwError) e.target.style.borderColor = 'var(--primary)'; }}
              onBlur={(e) => { if (!pwError) e.target.style.borderColor = 'var(--border)'; }}
            />
            {pwError && (
              <p style={{ fontSize: 12, color: 'var(--danger-ink)', marginBottom: 12 }}>{pwError}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPwModal(null)}>
                Cancelar
              </button>
              <button
                type="button" className="btn btn-primary" style={{ flex: 1 }}
                onClick={handleSetPassword} disabled={password.length < 6 || setPassword_m.isPending}
              >
                {setPassword_m.isPending ? 'A salvar…' : 'Salvar senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'oklch(0.2 0.04 256 / 0.45)', backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card"
            style={{ width: 360, padding: 24, boxShadow: 'var(--shadow-lg)', animation: 'popIn .2s cubic-bezier(.2,.9,.3,1.2)' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <div
                style={{
                  flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconAlertTriangle size={18} style={{ color: 'var(--danger)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Excluir motorista</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Tem a certeza que quer excluir <strong style={{ color: 'var(--ink)' }}>{deleteTarget.name}</strong>?
                </p>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>
                  O acesso será revogado imediatamente. O histórico de movimentos é preservado.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button" className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => setDeleteTarget(null)} disabled={deleteDriver_m.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'var(--danger)', color: '#fff', fontSize: 13.5, fontWeight: 600,
                  opacity: deleteDriver_m.isPending ? 0.6 : 1,
                }}
                disabled={deleteDriver_m.isPending}
                onClick={() => deleteDriver_m.mutate({ userId: deleteTarget.id, idempotencyKey: uuidv4() })}
              >
                {deleteDriver_m.isPending ? 'A excluir…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
