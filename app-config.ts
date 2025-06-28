import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Eventify',
  pageTitle: 'Eventify Agent',
  pageDescription: 'Talk about the event',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,

  logo: '/lk-logo.svg',
  accent: '#002cf2',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#1fd5f9',
  startButtonText: "Let's talk!",
};
