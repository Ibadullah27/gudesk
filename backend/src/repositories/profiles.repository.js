import { AppError } from '../errors/AppError.js';
import { supabaseAdmin } from '../lib/supabase.js';

class ProfilesRepository {
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, roll_no, is_active, must_change_password, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new AppError(500, 'PROFILE_LOOKUP_FAILED', 'Unable to load your account.');
    return data;
  }

  async setMustChangePassword(id, required) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: required })
      .eq('id', id)
      .select('id, full_name, email, role, roll_no, is_active, must_change_password, created_at')
      .single();

    if (error) throw new AppError(500, 'PROFILE_UPDATE_FAILED', 'Password changed, but the account profile could not be updated. Contact your administrator.');
    return data;
  }
}

export const profilesRepository = new ProfilesRepository();
