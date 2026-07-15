export const EVENTSUB_TEST_SECRET = 'sanitized-eventsub-test-secret';
export const EVENTSUB_NOW = Date.parse('2026-07-15T12:00:00.000Z');
export const EVENTSUB_TIMESTAMP = '2026-07-15T12:00:00.000Z';
export const EVENTSUB_MESSAGE_ID = 'sanitized-message-id-001';

export const subscription = {
  id: 'sanitized-subscription-id',
  status: 'enabled',
  type: 'stream.online',
  version: '1',
  condition: { broadcaster_user_id: '123456' },
  transport: {
    method: 'webhook',
    callback: 'https://example.com/webhooks/twitch/eventsub',
  },
  created_at: '2026-07-15T11:00:00.000Z',
  cost: 0,
} as const;

export const verificationPayload = {
  challenge: 'sanitized-callback-challenge',
  subscription,
};

export const streamOnlinePayload = {
  subscription,
  event: {
    id: 'stream-001',
    broadcaster_user_id: '123456',
    broadcaster_user_login: 'notifyhubtest',
    broadcaster_user_name: 'NotifyHubTest',
    type: 'live',
    started_at: '2026-07-15T11:59:00.000Z',
  },
};

export const streamOfflinePayload = {
  subscription: { ...subscription, type: 'stream.offline' },
  event: {
    broadcaster_user_id: '123456',
    broadcaster_user_login: 'notifyhubtest',
    broadcaster_user_name: 'NotifyHubTest',
  },
};

export const channelUpdatePayload = {
  subscription: { ...subscription, type: 'channel.update' },
  event: {
    broadcaster_user_id: '123456',
    broadcaster_user_login: 'notifyhubtest',
    broadcaster_user_name: 'NotifyHubTest',
    title: 'Building a safe EventSub integration',
    language: 'en',
    category_id: '509658',
    category_name: 'Just Chatting',
    content_classification_labels: [],
  },
};

export const revocationPayload = {
  subscription: { ...subscription, status: 'authorization_revoked' },
};
