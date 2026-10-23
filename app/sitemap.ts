import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lendly.app';

  const routes = [
    '',
    '/home',
    '/explore',
    '/sell',
    '/chat',
    '/profile',
    '/terms',
    '/privacy',
    '/shipping',
    '/refunds',
    '/contact',
  ];

  const staticPages: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/home' || route === '/explore' ? 'always' : 'weekly',
    priority: route === '' || route === '/home' ? 1.0 : route === '/explore' ? 0.9 : 0.7,
  }));

  return staticPages;
}
