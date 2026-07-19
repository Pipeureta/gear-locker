import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gear Locker',
    short_name: 'Gear Locker',
    description: 'Hub de operaciones para equipo de airsoft milsim.',
    start_url: '/',
    display: 'standalone',
    background_color: '#05080a',
    theme_color: '#05080a',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
