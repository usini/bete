import { githubRepository } from './github-repo.js?v=mw62ezdd';
// Explicit host/path rules only. Never fetch metadata or a favicon from a linked service.
const root = path => path === '/';
const oneOf = (...paths) => path => paths.includes(path);
const entries = [
  { id: 'chatgpt', name: 'ChatGPT', hosts: ['chatgpt.com', 'www.chatgpt.com'], path: root },
  { id: 'gmail', name: 'Gmail', hosts: ['mail.google.com', 'gmail.com', 'www.gmail.com'], path: () => true, anyLocation: true },
  { id: 'youtube', name: 'YouTube', hosts: ['youtube.com', 'www.youtube.com'], path: root },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'www.facebook.com'], path: root },
  { id: 'x', name: 'X', hosts: ['x.com', 'www.x.com'], path: oneOf('/home') },
  { id: 'google', name: 'Google', hosts: ['google.com', 'www.google.com', 'google.fr', 'www.google.fr'], path: root },
  { id: 'googledrive', name: 'Google Drive', hosts: ['drive.google.com'], path: p => root(p) || /^\/drive(?:\/u\/\d+)?(?:\/(?:home|my-drive))?$/.test(p) },
  { id: 'googlecalendar', name: 'Google Agenda', hosts: ['calendar.google.com'], path: p => root(p) || /^\/calendar(?:\/u\/\d+)?(?:\/r)?$/.test(p), anyLocation: true },
  { id: 'googlemaps', name: 'Google Maps', hosts: ['maps.google.com'], path: root, anyLocation: true },
  { id: 'googlemaps', name: 'Google Maps', hosts: ['google.com', 'www.google.com', 'google.fr', 'www.google.fr'], path: oneOf('/maps'), anyLocation: true },
  { id: 'msnweather', name: 'MSN Météo', hosts: ['msn.com', 'www.msn.com'], path: p => /^\/fr-fr\/meteo\/previsions(?:\/.*)?$/.test(p), anyLocation: true },
  { id: 'googledocs', name: 'Google Docs', hosts: ['docs.google.com'], path: p => root(p) || /^\/document(?:\/u\/\d+)?$/.test(p) },
  { id: 'googlesheets', name: 'Google Sheets', hosts: ['docs.google.com'], path: p => /^\/spreadsheets(?:\/u\/\d+)?$/.test(p) },
  { id: 'googleslides', name: 'Google Slides', hosts: ['docs.google.com'], path: p => /^\/presentation(?:\/u\/\d+)?$/.test(p) },
  { id: 'microsoftoutlook', name: 'Outlook', hosts: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com'], path: p => root(p) || /^\/mail(?:\/\d+)?(?:\/inbox)?$/.test(p) },
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'], path: root },
  { id: 'linkedin', name: 'LinkedIn', hosts: ['linkedin.com', 'www.linkedin.com'], path: oneOf('/', '/feed') },
  { id: 'whatsapp', name: 'WhatsApp', hosts: ['web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com'], path: root },
  { id: 'discord', name: 'Discord', hosts: ['discord.com', 'www.discord.com'], path: oneOf('/', '/app', '/channels/@me') },
  { id: 'github', name: 'GitHub', hosts: ['github.com', 'www.github.com'], path: oneOf('/', '/dashboard') },
  { id: 'spotify', name: 'Spotify', hosts: ['open.spotify.com', 'spotify.com', 'www.spotify.com'], path: oneOf('/', '/home') },
  { id: 'reddit', name: 'Reddit', hosts: ['reddit.com', 'www.reddit.com'], path: root },
  { id: 'twitch', name: 'Twitch', hosts: ['twitch.tv', 'www.twitch.tv'], path: root },
  { id: 'telegram', name: 'Telegram', hosts: ['web.telegram.org'], path: oneOf('/', '/a', '/k') },
];

export function serviceForUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (githubRepository(url.href)) return { id: 'github', name: 'GitHub' };
    const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
    const service = entries.find(entry => entry.hosts.includes(url.hostname) && entry.path(path)
      && (entry.anyLocation || (!url.search && !url.hash)));
    return service ? { id: service.id, name: service.name } : null;
  } catch { return null; }
}

export const serviceForNode = node => node?.kind === 'rect' ? serviceForUrl(node.link || node.text) : null;

const icons = new Map();
export function serviceIcon(service, redraw) {
  if (!service) return null;
  if (!icons.has(service.id)) {
    const entry = { image: null };
    icons.set(service.id, entry);
    const image = new Image();
    image.onload = () => { entry.image = image; redraw(); };
    image.onerror = () => { redraw(); };
    image.src = new URL('../img/services/' + service.id + '.svg', import.meta.url).href;
  }
  return icons.get(service.id).image;
}
