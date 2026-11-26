import { createUserClient } from '../lib/supabase.js';

const fields = 'id,kind,title,body,entity_type,entity_id,available_at,read_at,created_at';
export const notificationsRepository = {
  list(userId, { page, pageSize, filter }, token) {
    let query = createUserClient(token).from('notifications').select(fields, { count: 'exact' }).eq('user_id', userId)
      .lte('available_at', new Date().toISOString());
    if (filter === 'unread') query = query.is('read_at', null);
    return query.order('available_at', { ascending: false }).order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
  },
  unreadCount(userId, token) {
    return createUserClient(token).from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('read_at', null).lte('available_at', new Date().toISOString());
  },
  markRead(id, userId, token) {
    return createUserClient(token).from('notifications').update({ read_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId).is('read_at', null).select('id').maybeSingle();
  },
  markAllRead(userId, token) {
    return createUserClient(token).from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', userId).is('read_at', null).lte('available_at', new Date().toISOString()).select('id');
  },
};
