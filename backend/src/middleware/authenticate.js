import { AppError } from '../errors/AppError.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { profilesRepository } from '../repositories/profiles.repository.js';

export async function authenticate(req, _res, next) {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.'));

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
    if (error || !data.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'));
    }

    const profile = await profilesRepository.findById(data.user.id);
    if (!profile || !profile.is_active) {
      return next(new AppError(403, 'FORBIDDEN', 'This account is inactive. Contact your administrator.'));
    }

    req.auth = { user: data.user, profile, accessToken: match[1] };
    next();
  } catch (error) {
    next(error);
  }
}
