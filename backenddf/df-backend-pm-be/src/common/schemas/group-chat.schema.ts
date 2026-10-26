import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Users } from './users.schema';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true, collection: 'Groups' })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  groupIcon: string;

  @Prop({ required: false })
  description: string;

  @Prop({ type: Types.ObjectId, ref: Users.name, required: true })
  admin: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: Users.name }], default: [] })
  members: Types.ObjectId[];

  // Creation idempotency key, unique per owner: a retried create request
  // returns the group stored by the first attempt. Never returned to clients.
  @Prop({ required: false })
  clientId?: string;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// autoIndex is off: create with `npm run groups:indexes -- --apply`.
export const GROUP_CLIENT_ID_INDEX = 'group_admin_client_id_unique';
GroupSchema.index(
  { admin: 1, clientId: 1 },
  {
    unique: true,
    name: GROUP_CLIENT_ID_INDEX,
    partialFilterExpression: { clientId: { $type: 'string' } },
  },
);
