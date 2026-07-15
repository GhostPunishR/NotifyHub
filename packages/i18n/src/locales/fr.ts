export const fr = {
  translation: {
    common: {
      brand: 'NotifyHub',
      unknownError: 'Une erreur inattendue est survenue. Réessaie plus tard.',
    },
    commands: {
      ping: {
        description: 'Vérifie si NotifyHub est en ligne.',
        title: 'NotifyHub est en ligne',
        latency: 'Latence de la passerelle : {{latency}} ms',
        modules: 'Modules réseau chargés : {{count}}',
      },
      about: {
        description: 'En savoir plus sur NotifyHub.',
        title: 'À propos de NotifyHub',
        body: 'Un bot Discord modulaire pour des notifications de créateurs propres et multiréseaux.',
        languages: 'Langues : anglais et français',
        license: 'Licence : MIT',
      },
    },
  },
} as const;
