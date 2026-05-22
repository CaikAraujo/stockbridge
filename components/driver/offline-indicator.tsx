'use client';

import { IconRefresh, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { pendingCount, syncing, processQueue } = useOfflineQueue();

  if (isOnline && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium ${
        isOnline
          ? 'border-b border-amber-100 bg-amber-50 text-amber-800'
          : 'border-b border-red-100 bg-red-50 text-red-700'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {isOnline ? <IconWifi size={13} /> : <IconWifiOff size={13} />}
        {!isOnline && 'Sem conexão'}
        {isOnline && syncing && 'Sincronizando...'}
        {isOnline && !syncing && pendingCount > 0 && `${pendingCount} operação(ões) pendente(s)`}
        {!isOnline && pendingCount > 0 && ` · ${pendingCount} na fila`}
      </div>

      {isOnline && pendingCount > 0 && !syncing && (
        <button
          type="button"
          onClick={() => void processQueue()}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-amber-700 transition-colors hover:bg-amber-100"
        >
          <IconRefresh size={11} />
          Sincronizar
        </button>
      )}
    </div>
  );
}
