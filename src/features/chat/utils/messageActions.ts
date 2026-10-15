import type { Message } from '../types';

export function messageActions(
  message: Pick<Message, 'senderId' | 'text' | 'media'> & { local?: boolean },
  myId: string,
): ('copy' | 'edit' | 'delete')[] {
  const actions: ('copy' | 'edit' | 'delete')[] = message.text ? ['copy'] : [];
  if (!message.local && message.senderId === myId) {
    if (message.text && !message.media?.length) actions.push('edit');
    actions.push('delete');
  }
  return actions;
}
