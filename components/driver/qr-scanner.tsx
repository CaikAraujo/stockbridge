'use client';

import { IconX } from '@tabler/icons-react';
import type { IScannerControls } from '@zxing/browser';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const handleResult = useCallback(
    (text: string) => {
      if (scannedRef.current) return;
      scannedRef.current = true;

      // QR contém URL (https://app.com/scan/{sku}) ou SKU diretamente
      try {
        const url = new URL(text);
        const sku = url.pathname.split('/scan/')[1];
        if (sku) {
          router.push(`/driver/scan/${encodeURIComponent(sku)}`);
          return;
        }
      } catch {
        // Não é URL válida — trata como SKU direto
      }

      router.push(`/driver/scan/${encodeURIComponent(text)}`);
    },
    [router],
  );

  useEffect(() => {
    let unmounted = false;

    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err) => {
        if (result && !unmounted) handleResult(result.getText());
      })
      .then((controls) => {
        controlsRef.current = controls;
        if (unmounted) controls.stop();
      })
      .catch(() => {
        if (!unmounted) {
          setError('Não foi possível acessar a câmera. Verifique as permissões.');
        }
      });

    return () => {
      unmounted = true;
      controlsRef.current?.stop();
    };
  }, [handleResult]);

  return (
    <div className="relative flex h-screen flex-col bg-black">
      {/* Vídeo fullscreen */}
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

      {/* Overlay com janela de foco */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-64 w-64 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
      </div>

      {/* Instrução */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-sm font-medium text-white drop-shadow">
          Aponte para o QR code da prateleira
        </p>
      </div>

      {/* Botão fechar */}
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute right-4 top-12 flex h-11 w-11 items-center justify-center rounded-full bg-black/50"
        aria-label="Fechar scanner"
      >
        <IconX size={20} className="text-white" />
      </button>

      {/* Mensagem de erro */}
      {error && (
        <div className="absolute inset-x-4 top-20 rounded-btn bg-red-500 px-4 py-3 text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}
