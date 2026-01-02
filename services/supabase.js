import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vxhbwnmrjrthodleeprb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aGJ3bm1yanJ0aG9kbGVlcHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzE2MDcsImV4cCI6MjA4Mjk0NzYwN30.PpKwW1M90zw4GmsYG5pYmE2y4EFp4hVNqK-DDWHzt9Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Deterministically converts a string (Firebase UID) into a valid UUID hex format.
 */
const toUUID = async (str) => {
  if (!str) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * Synchronizes Firebase user with Supabase 'users' table.
 */
export const syncUserWithSupabase = async (user, displayName = '') => {
  const uuid = await toUUID(user.uid);
  
  const userData = {
    uuid: uuid,
    name: displayName || user.displayName || user.email?.split('@')[0] || 'Cloud User',
    email: user.email,
    photo_url: user.photoURL || '',
    profile_photo: user.photoURL ? 'profile_photo_url' : 'default_avatar'
  };

  try {
    // Upsert the user record
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'uuid' })
      .select()
      .single();

    if (error) {
      console.error('Supabase sync error:', error.message);
      return userData;
    }
    return data;
  } catch (err) {
    console.error('Supabase sync exception:', err);
    return userData;
  }
};

/**
 * Updates user profile in Supabase.
 */
export const updateSupabaseUser = async (rawUid, updates) => {
  const uuid = await toUUID(rawUid);
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('uuid', uuid)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Deletes user record from Supabase.
 */
export const deleteSupabaseUser = async (rawUid) => {
  const uuid = await toUUID(rawUid);
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('uuid', uuid);

  if (error) throw error;
};