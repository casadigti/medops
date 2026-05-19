import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    channel: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabase';
import { notificationService } from '../notificationService';

function mockChain(resolvedValue) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
}

beforeEach(() => vi.clearAllMocks());

// ─── getMyNotifications ───────────────────────────────────────────────────────

describe('notificationService.getMyNotifications', () => {
  it('returns [] when no authenticated user', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const result = await notificationService.getMyNotifications();
    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries notifications filtered by user.id', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    const notifications = [{ id: 'n-1', title: 'Stock bajo' }];
    const chain = mockChain({ data: notifications, error: null });
    supabase.from.mockReturnValue(chain);

    const result = await notificationService.getMyNotifications();

    expect(supabase.from).toHaveBeenCalledWith('notifications');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(result).toEqual(notifications);
  });

  it('throws when supabase returns error', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    supabase.from.mockReturnValue(mockChain({ data: null, error: new Error('fetch error') }));

    await expect(notificationService.getMyNotifications()).rejects.toThrow('fetch error');
  });
});

// ─── markAsRead ───────────────────────────────────────────────────────────────

describe('notificationService.markAsRead', () => {
  it('updates is_read=true for given id', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await notificationService.markAsRead('notif-42');

    expect(chain.update).toHaveBeenCalledWith({ is_read: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 'notif-42');
  });

  it('throws on error', async () => {
    supabase.from.mockReturnValue(mockChain({ error: new Error('update failed') }));
    await expect(notificationService.markAsRead('x')).rejects.toThrow('update failed');
  });
});

// ─── markAllAsRead ────────────────────────────────────────────────────────────

describe('notificationService.markAllAsRead', () => {
  it('returns without querying when no user', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    await notificationService.markAllAsRead();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('filters by user_id AND is_read=false', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u-2' } } });
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await notificationService.markAllAsRead();

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-2');
    expect(chain.eq).toHaveBeenCalledWith('is_read', false);
  });
});

// ─── createNotification ───────────────────────────────────────────────────────

describe('notificationService.createNotification', () => {
  it('inserts with is_read=false and default type info', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await notificationService.createNotification('u-3', {
      title: 'Stock crítico',
      message: 'El lote A está agotado',
    });

    const payload = chain.insert.mock.calls[0][0];
    expect(payload.is_read).toBe(false);
    expect(payload.type).toBe('info');
    expect(payload.user_id).toBe('u-3');
    expect(payload.title).toBe('Stock crítico');
    expect(payload.message).toBe('El lote A está agotado');
  });

  it('uses provided type instead of default', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);

    await notificationService.createNotification('u-4', {
      title: 'Alerta',
      message: 'Urgente',
      type: 'warning',
    });

    expect(chain.insert.mock.calls[0][0].type).toBe('warning');
  });

  it('throws on insert error', async () => {
    supabase.from.mockReturnValue(mockChain({ error: new Error('insert failed') }));
    await expect(
      notificationService.createNotification('u-x', { title: 'X', message: 'Y' })
    ).rejects.toThrow('insert failed');
  });
});

// ─── subscribeToNotifications ─────────────────────────────────────────────────

describe('notificationService.subscribeToNotifications', () => {
  it('creates channel with user_id in filter', () => {
    const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
    const mockOn = vi.fn().mockReturnThis();
    supabase.channel.mockReturnValue({ on: mockOn, subscribe: mockSubscribe });
    mockOn.mockReturnValue({ subscribe: mockSubscribe });

    notificationService.subscribeToNotifications('u-5', vi.fn());

    const channelArg = supabase.channel.mock.calls[0][0];
    expect(channelArg).toContain('u-5');

    const onConfig = mockOn.mock.calls[0][1];
    expect(onConfig.filter).toBe('user_id=eq.u-5');
  });
});
