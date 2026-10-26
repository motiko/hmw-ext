import type { Task } from '../messages';

export const TASK_INSTRUCTIONS: Record<Task, string> = {
  create: 'Write the email based on the request below.',
  polish: 'Polish the draft: fix grammar, spelling and flow while keeping its meaning, length and tone.',
  formalize: 'Make the draft more formal and professional while keeping its meaning.',
  elaborate: 'Elaborate on the draft: add helpful detail and context while keeping its intent.',
  shorten: 'Shorten the draft: make it concise while keeping the essential points.',
  followup: 'Revise the draft according to the request below.',
};
