import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { profilesRepository } from '../repositories/profiles.repository.js';
import { supabaseAdmin } from '../lib/supabase.js';

function createPublicAuthClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

class AuthService {
  async login(email, password) {
    const { data, error } = await createPublicAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const profile = await profilesRepository.findById(data.user.id);
    if (!profile) throw new AppError(403, 'FORBIDDEN', 'This account is not configured. Contact your administrator.');
    if (!profile.is_active) throw new AppError(403, 'FORBIDDEN', 'This account is inactive. Contact your administrator.');

    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
      profile,
    };
  }

  async getCurrentProfile(userId) {
    const profile = await profilesRepository.findById(userId);
    if (!profile || !profile.is_active) {
      throw new AppError(403, 'FORBIDDEN', 'This account is inactive. Contact your administrator.');
    }
    return profile;
  }

  async changePassword(userId, newPassword) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new AppError(422, 'PASSWORD_UPDATE_FAILED', 'The password could not be changed. Please try again.');
    return profilesRepository.setMustChangePassword(userId, false);
  }

  async changeOwnPassword(profile, currentPassword, newPassword) {
    const { data, error: verifyError } = await createPublicAuthClient().auth.signInWithPassword({ email: profile.email, password: currentPassword });
    if (verifyError || data.user?.id !== profile.id) throw new AppError(422, 'CURRENT_PASSWORD_INVALID', 'The current password is incorrect.');
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: newPassword });
    if (error) throw new AppError(422, 'PASSWORD_UPDATE_FAILED', 'The password could not be changed. Please try again.');
    return profilesRepository.setMustChangePassword(profile.id, false);
  }

  async sendPasswordReset(email) {
    try {
      await createPublicAuthClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${env.CLIENT_ORIGIN}/reset-password`,
      });
    } catch {
      // Keep the response identical for known and unknown addresses, including provider failures.
    }
  }
}

export const authService = new AuthService();
