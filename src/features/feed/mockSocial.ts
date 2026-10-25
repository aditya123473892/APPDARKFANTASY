import type { Post, PostAuthor, PostComment } from './types';
import { mediaPreviews } from './presentation';
export const mockSocialUsers: PostAuthor[] = [
  {
    id: 'preview-maya',
    name: 'Maya Chen',
    handle: 'mayach',
    avatarUri: 'https://i.pravatar.cc/192?img=47',
  },
  {
    id: 'preview-arjun',
    name: 'Arjun Kapoor',
    handle: 'arjun.outside',
    avatarUri: 'https://i.pravatar.cc/192?img=12',
  },
  {
    id: 'preview-luna',
    name: 'Luna Rivera',
    handle: 'luna.afterhours',
    avatarUri: 'https://i.pravatar.cc/192?img=44',
  },
];
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=85`;
const video = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';
mediaPreviews.set(video, {
  thumbnail: photo('photo-1464822759023-fed622ff2c3b'),
  duration: 15,
  location: 'Out of office',
});
export const mockSocialComments: PostComment[] = mockSocialUsers.map((author, index) => ({
  id: `preview-comment-${index}`,
  author,
  content: [
    'This light is everything. Where was this taken?',
    'A little reminder to slow down ✨',
    'Taking the scenic route, always.',
  ][index]!,
  createdAt: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
}));
export const mockSocialPosts: Post[] = [
  {
    id: 'preview-post-1',
    user: mockSocialUsers[0]!,
    body: 'Some evenings deserve a longer way home. A quiet corner, warm light, and nowhere else to be. ✨',
    media: [
      {
        uri: photo('photo-1470770841072-f978cf4d019e'),
        width: 1080,
        height: 1350,
        mimetype: 'image/jpeg',
      },
      {
        uri: photo('photo-1464822759023-fed622ff2c3b'),
        width: 1080,
        height: 1080,
        mimetype: 'image/jpeg',
      },
      {
        uri: photo('photo-1441974231531-c6227db76b6e'),
        width: 1080,
        height: 1350,
        mimetype: 'image/jpeg',
      },
    ],
  },
  {
    id: 'preview-post-2',
    user: mockSocialUsers[1]!,
    body: 'A moment in motion. Sound on for a little escape.',
    media: [{ uri: video, width: 1920, height: 1080, mimetype: 'video/mp4' }],
  },
  {
    id: 'preview-post-3',
    user: mockSocialUsers[2]!,
    body: 'Finding something beautiful in the everyday.',
    media: [
      {
        uri: photo('photo-1441974231531-c6227db76b6e'),
        width: 1080,
        height: 1080,
        mimetype: 'image/jpeg',
      },
    ],
  },
].map((post, index) => ({
  ...post,
  createdAt: new Date(Date.now() - (index + 2) * 3600000).toISOString(),
  likes: 128 + index * 24,
  replies: 24,
  liked: false,
  audience: 'everyone',
  comments: mockSocialComments,
}));
export const isPreviewPost = (post: Post) => post.id.startsWith('preview-');
