
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vxhbwnmrjrthodleeprb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aGJ3bm1yanJ0aG9kbGVlcHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzE2MDcsImV4cCI6MjA4Mjk0NzYwN30.PpKwW1M90zw4GmsYG5pYmE2y4EFp4hVNqK-DDWHzt9Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Deterministically converts any string (like a Firebase UID) into a valid UUID hex format.
 */
export const toUUID = async (str) => {
  if (!str) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str.toLowerCase();

  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * Sync User with Supabase 'users' table.
 */
export const syncUserWithSupabase = async (user, displayName = '') => {
  const uuid = await toUUID(user.uid);
  const newUser = {
    uuid: uuid,
    name: displayName || user.displayName || user.email?.split('@')[0] || 'Anonymous User',
    email: user.email,
    photo_url: user.photoURL || '',
    profile_photo: user.photoURL ? 'profile_image' : 'default_avatar'
  };

  try {
    const { data, error } = await supabase.from('users').upsert(newUser, { onConflict: 'uuid' }).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Supabase user sync failed:', err.message);
    return newUser;
  }
};

/**
 * Metadata & Storage Operations
 */

export const uploadFileToStorage = async (rawUid, fileId, fileBlob) => {
  const path = `${rawUid}/${fileId}`;
  const { data, error } = await supabase.storage.from('user_uploads').upload(path, fileBlob);
  if (error) throw error;
  return data;
};

export const deleteFileFromStorage = async (rawUid, fileId) => {
  const path = `${rawUid}/${fileId}`;
  const { error } = await supabase.storage.from('user_uploads').remove([path]);
  if (error) throw error;
};

export const getFilePublicUrl = (rawUid, fileId) => {
  const path = `${rawUid}/${fileId}`;
  const { data } = supabase.storage.from('user_uploads').getPublicUrl(path);
  return data.publicUrl;
};

export const upsertFileMetadata = async (rawUid, fileId, metadata) => {
  const user_uuid = await toUUID(rawUid);
  const payload = {
    user_uuid,
    file_uuid: fileId,
    ...metadata
  };
  const { data, error } = await supabase.from('files').upsert(payload, { onConflict: 'file_uuid' }).select().single();
  if (error) throw error;
  return data;
};

export const fetchUserFilesMetadata = async (rawUid) => {
  const user_uuid = await toUUID(rawUid);
  const { data, error } = await supabase.from('files').select('*').eq('user_uuid', user_uuid).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const deleteFileMetadata = async (fileId) => {
  const { error } = await supabase.from('files').delete().eq('file_uuid', fileId);
  if (error) throw error;
};

export const updateSupabaseUser = async (rawUid, updates) => {
  const uuid = await toUUID(rawUid);
  const { data, error } = await supabase.from('users').update(updates).eq('uuid', uuid).select().single();
  if (error) throw error;
  return data;
};

export const deleteSupabaseUser = async (rawUid) => {
  const uuid = await toUUID(rawUid);
  const { error } = await supabase.from('users').delete().eq('uuid', uuid);
  if (error) throw error;
};
