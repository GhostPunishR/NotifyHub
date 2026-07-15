export const en = {
  translation: {
    common: {
      brand: 'NotifyHub',
      unknownError: 'An unexpected error occurred. Please try again later.',
    },
    commands: {
      ping: {
        description: 'Check whether NotifyHub is online.',
        title: 'NotifyHub is online',
        latency: 'Gateway latency: {{latency}} ms',
        modules: 'Loaded network modules: {{count}}',
      },
      about: {
        description: 'Learn more about NotifyHub.',
        title: 'About NotifyHub',
        body: 'A modular Discord bot for clean cross-platform creator notifications.',
        languages: 'Languages: English and French',
        license: 'License: MIT',
      },
    },
  },
} as const;
