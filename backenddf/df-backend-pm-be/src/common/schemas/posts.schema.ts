import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { EContentVisibility, EPostStatus, EPostVisibility } from '../enums/posts.enum';
import { UsersDocument } from './users.schema';
import { Media } from './media.schema';
import { Like } from './like.schema';
import { Comment } from './comment.schema';

export type PostsDocument = Posts & Document;

@Schema({ timestamps: true, collection: 'Posts' })
export class Posts {
  @Prop({ type: String, enum: EContentVisibility, default: EContentVisibility.NORMAL })
  contentVisibility: EContentVisibility;

  @Prop({ required: false })
  caption: string;

  @Prop({ type: [Media], required: false })
  media: Media[];

  @Prop({ type: String,
    enum: EPostVisibility,
    required: true,
    default: EPostVisibility.PRIVATE,
  })
  visibility: EPostVisibility;

  @Prop({ type: String,
    enum: EPostStatus,
    required: true,
    default: EPostStatus.PENDING,
  })
  status: EPostStatus;

  @Prop({ required: false })
  location: string;

  @Prop({ required: false })
  tags: string[];

  @Prop({
    required: true,
    ref: 'Users',
    type: mongoose.Schema.Types.ObjectId,
  })
  user: UsersDocument | mongoose.Schema.Types.ObjectId;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }] })
  comments: Comment[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Like' }] })
  likes: Like[];
}

export const PostsSchema = SchemaFactory.createForClass(Posts);
