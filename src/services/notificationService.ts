import { supabase } from '../lib/supabase';
import type { Notification, NotificationType } from '../types/domain';

export const notificationService = {
  async getMyNotifications(): Promise<Notification[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  },

  async markAsRead(id: string): Promise<void> {
    // SECURITY F-11: scope the update to the current user so a client
    // cannot mark another user's notification as read (IDOR). This is
    // defence-in-depth alongside the RLS policy on the notifications table.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
  },

  async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) throw error;
  },

  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    return supabase
      .channel(`public:notifications:${userId}:${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => callback(payload.new)
      )
      .subscribe();
  },

  async createNotification(
    userId: string,
    { title, message, type = 'info' }: { title: string; message: string; type?: NotificationType }
  ): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, message, type, is_read: false });
    if (error) throw error;
  },
};
