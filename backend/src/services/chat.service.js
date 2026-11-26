import { AppError } from '../errors/AppError.js';
import { chatRepository } from '../repositories/chat.repository.js';

function dbError(error) {
  if (error?.code === '23503') return new AppError(422, 'INVALID_REFERENCE', 'The course or sender is not valid.');
  if (error?.code === '42501') return new AppError(403, 'FORBIDDEN', 'You do not have access to this classroom chat.');
  return new AppError(500, 'DATABASE_ERROR', 'The chat request could not be completed.');
}

class ChatService {
  async courseAccess(courseId, profile, allowAdmin = true) {
    const { data: course, error } = await chatRepository.findCourse(courseId);
    if (error) throw dbError(error);
    if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'The course was not found.');
    if (allowAdmin && profile.role === 'admin') return course;
    if (profile.role === 'teacher' && course.teacher_id === profile.id) return course;
    if (profile.role === 'student') {
      const { data: enrollment, error: enrollmentError } = await chatRepository.isEnrolled(courseId, profile.id);
      if (enrollmentError) throw dbError(enrollmentError);
      if (enrollment) return course;
    }
    throw new AppError(403, 'FORBIDDEN', 'You are not a member of this course chat.');
  }

  async enrich(messages) {
    const entries = messages ?? [];
    const { data: senders, error } = await chatRepository.senderNames([...new Set(entries.map((message) => message.sender_id))]);
    if (error) throw dbError(error);
    const names = new Map((senders ?? []).map((sender) => [sender.id, sender.full_name]));
    return entries.map((message) => ({ ...message, sender_name: names.get(message.sender_id) ?? 'Classroom member' }));
  }

  async history(courseId, before, profile, token) {
    await this.courseAccess(courseId, profile);
    const { data, error } = await chatRepository.list(courseId, before, token);
    if (error) throw dbError(error);
    const newestFirst = data ?? [];
    const messages = await this.enrich(newestFirst);
    const oldest = newestFirst.at(-1);
    return {
      data: messages.reverse(),
      meta: { has_more: newestFirst.length === 50, before: oldest?.created_at ?? null },
    };
  }

  async send(courseId, body, profile, token) {
    if (profile.role === 'admin') throw new AppError(403, 'CHAT_READ_ONLY', 'Administrators can read and moderate chat, but cannot post.');
    await this.courseAccess(courseId, profile, false);
    const { data, error } = await chatRepository.create(courseId, profile.id, body, token);
    if (error) throw dbError(error);
    const [message] = await this.enrich([data]);
    return message;
  }

  async remove(messageId, profile, token) {
    const { data: message, error } = await chatRepository.findMessage(messageId);
    if (error) throw dbError(error);
    if (!message) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'The chat message was not found.');
    if (profile.role !== 'admin') await this.courseAccess(message.course_id, profile, false);
    if (!['admin', 'teacher'].includes(profile.role)) throw new AppError(403, 'FORBIDDEN', 'Only teachers and administrators can moderate chat.');
    const { data, error: deleteError } = await chatRepository.delete(messageId, token);
    if (deleteError) throw dbError(deleteError);
    if (!data) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'The chat message was not found.');
    return { deleted: true, id: messageId };
  }
}
export const chatService = new ChatService();
