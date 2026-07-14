const platformDefinitions = [
  { id: 'youtube', label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
  { id: 'tiktok', label: 'TikTok', domains: ['tiktok.com'] },
  { id: 'instagram', label: 'Instagram', domains: ['instagram.com'] },
  { id: 'facebook', label: 'Facebook', domains: ['facebook.com', 'fb.com'] },
  { id: 'x', label: 'X', domains: ['x.com', 'twitter.com'] },
  { id: 'linkedin', label: 'LinkedIn', domains: ['linkedin.com'] },
  { id: 'github', label: 'GitHub', domains: ['github.com'] },
];

export function classifyExternalLink(value) {
  let hostname = '';
  try {
    hostname = new URL(String(value || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { id: 'website', label: 'Website' };
  }
  return platformDefinitions.find((platform) => platform.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)))
    || { id: 'website', label: 'Website' };
}

export function describeExternalLinks(links = []) {
  return links.filter(Boolean).map((url) => ({ url, ...classifyExternalLink(url) }));
}
