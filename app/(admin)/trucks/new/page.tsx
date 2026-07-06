'use client';

import { IconArrowLeft, IconLoader2, IconTruck } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

export default function NewTruckPage() {
  const router = useRouter();
  const [name, setName]   = useState('');
  const [code, setCode]   = useState('');
  const [plate, setPlate] = useState('');
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  const create = api.locations.create.useMutation({
    onSuccess: () => {
      toast.success('Caminhão criado com sucesso!');
      router.push('/trucks');
    },
    onError: (err) => {
      toast.error(err.message ?? 'Erro ao criar caminhão');
    },
  });

  function validate(): boolean {
    const errs: { name?: string; code?: string } = {};
    if (!name.trim()) errs.name = 'Nome é obrigatório.';
    if (!code.trim()) errs.code = 'Código é obrigatório.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    create.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      plate: plate.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #F2F5F9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1D5FE0', display: 'grid', placeItems: 'center' }}>
            <IconTruck size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#12203A', letterSpacing: '-0.01em', margin: 0 }}>
            Novo caminhão
          </h1>
          <p style={{ fontSize: 13, color: '#7A879C', margin: 0 }}>
            Preencha os dados do veículo para adicioná-lo à frota.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', boxShadow: '0 6px 24px rgba(17,42,94,.08)', display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {/* Nome */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#7A879C' }}>Nome do caminhão *</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder="Ex: Caminhão João"
              style={{
                height: 46, border: `1.5px solid ${errors.name ? '#E53E3E' : '#E3E9F2'}`,
                borderRadius: 12, padding: '0 14px', fontSize: 14, color: '#12203A',
                background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            {errors.name && <span style={{ fontSize: 12, color: '#E53E3E' }}>{errors.name}</span>}
          </div>

          {/* Código */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#7A879C' }}>Código único *</label>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setErrors((p) => ({ ...p, code: undefined })); }}
              placeholder="Ex: TRUCK-01"
              style={{
                height: 46, border: `1.5px solid ${errors.code ? '#E53E3E' : '#E3E9F2'}`,
                borderRadius: 12, padding: '0 14px', fontSize: 14, color: '#12203A',
                background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            {errors.code && <span style={{ fontSize: 12, color: '#E53E3E' }}>{errors.code}</span>}
          </div>

          {/* Placa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#7A879C' }}>
              Placa <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Ex: GE 123 456"
              style={{
                height: 46, border: '1.5px solid #E3E9F2',
                borderRadius: 12, padding: '0 14px', fontSize: 14, color: '#12203A',
                background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Link
              href="/trucks"
              style={{
                flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, border: '1.5px solid #E3E9F2', borderRadius: 100, background: '#fff',
                color: '#12203A', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}
            >
              <IconArrowLeft size={16} /> Cancelar
            </Link>
            <button
              type="submit"
              disabled={create.isPending}
              style={{
                flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, border: 'none', borderRadius: 100, background: '#1D5FE0', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: create.isPending ? 'not-allowed' : 'pointer',
                opacity: create.isPending ? 0.8 : 1, boxShadow: '0 6px 16px rgba(29,95,224,.3)',
              }}
            >
              {create.isPending ? (
                <><IconLoader2 size={16} style={{ animation: 'spin .8s linear infinite' }} /> Criando...</>
              ) : (
                <><IconTruck size={16} /> Criar caminhão</>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
