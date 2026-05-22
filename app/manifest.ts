import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StockBridge',
    short_name: 'StockBridge',
    description: 'Gestão de estoque para refrigeração',
    start_url: '/driver',
    display: 'standalone',
    background_color: '#f0f3f7',
    theme_color: '#064875',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
