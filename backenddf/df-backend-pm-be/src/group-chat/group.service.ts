import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from '../common/schemas/group-chat.schema';
import {
  CreateGroupDto,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
} from './dtos/create-group.dto';
import { AddMembersDto } from './dtos/add-member.dto';
import { RemoveMembersDto } from './dtos/remove-member.dto';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { BlockService } from '../user-blocks/block.service';
import { preservationGate } from '../reports/preservation';
const { ObjectId } = require('mongoose').Types;

const UNAVAILABLE_MEMBERS = 'Some selected people can no longer be added';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private readonly blocks: BlockService,
  ) {}

  /**
   * Any signed-in user can create a group and becomes its owner. Members must
   * exist, be active and not blocked either way; a retry with the same
   * clientId returns the group stored by the first attempt.
   */
  async createGroup(createGroupDto: CreateGroupDto, actorId: string) {
    const name = this.validName(createGroupDto.name);
    const description = this.validDescription(createGroupDto.description);
    const { clientId } = createGroupDto;
    const members = [...new Set((createGroupDto.members || []).map(String))].filter(
      (id) => id !== actorId,
    );
    if (!members.length) throw new BadRequestException('Select at least one member');
    if (members.length + 1 > MAX_GROUP_MEMBERS)
      throw new BadRequestException(`Groups are limited to ${MAX_GROUP_MEMBERS} members`);

    if (clientId) {
      const existing = await this.groupModel.findOne({ admin: new Types.ObjectId(actorId), clientId });
      if (existing) return this.sameRequest(existing, name);
    }
    await this.assertMembersAvailable(actorId, members);

    let saved: GroupDocument;
    try {
      saved = await this.groupModel.create({
        name,
        ...(description ? { description } : {}),
        admin: new Types.ObjectId(actorId),
        members: [actorId, ...members].map((id) => new Types.ObjectId(id)),
        ...(clientId ? { clientId } : {}),
      });
    } catch (error) {
      // A concurrent retry with the same clientId created the group first.
      if (error?.code === 11000 && clientId) {
        const existing = await this.groupModel.findOne({ admin: new Types.ObjectId(actorId), clientId });
        if (existing) return this.sameRequest(existing, name);
      }
      throw error;
    }
    // A block committed between the check and the save must still win.
    try {
      await this.assertMembersVisible(actorId, members);
    } catch (error) {
      await this.groupModel.deleteOne({ _id: saved._id });
      throw error;
    }
    return this.toClientGroup(saved);
  }

  /** The idempotency key belongs to one create request; reusing it for another is a conflict. */
  private sameRequest(existing: GroupDocument, name: string) {
    if (existing.name !== name)
      throw new ConflictException('This request was already used to create a different group');
    return this.toClientGroup(existing);
  }

  /** Group response; the idempotency key is internal. */
  private toClientGroup(group: GroupDocument) {
    const { clientId, ...rest } = group.toObject ? group.toObject() : (group as any);
    return rest;
  }

  /** One generic message for missing, suspended and blocked users: never reveals which. */
  private async assertMembersAvailable(actorId: string, members: string[]) {
    const found = await this.groupModel.db.db.collection('Users').countDocuments({
      _id: { $in: members.map((id) => new Types.ObjectId(id)) },
      isBlocked: { $ne: true },
    });
    if (found !== members.length) throw new BadRequestException(UNAVAILABLE_MEMBERS);
    await this.assertMembersVisible(actorId, members);
  }

  private async assertMembersVisible(actorId: string, members: string[]) {
    for (const member of members)
      if (await this.blocks.isBlockedEitherWay(actorId, member))
        throw new BadRequestException(UNAVAILABLE_MEMBERS);
  }

  private async assertStillVisible(actorId: string, members: string[]) {
    for (const member of members)
      await this.blocks.assertVisible(actorId, member);
  }

  private validName(value: unknown) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) throw new BadRequestException('Group name is required');
    if (name.length > MAX_GROUP_NAME_LENGTH)
      throw new BadRequestException(`Group names are limited to ${MAX_GROUP_NAME_LENGTH} characters`);
    return name;
  }

  private validDescription(value: unknown) {
    if (value === undefined || value === null) return undefined;
    const description = typeof value === 'string' ? value.trim() : '';
    if (description.length > MAX_GROUP_DESCRIPTION_LENGTH)
      throw new BadRequestException(
        `Descriptions are limited to ${MAX_GROUP_DESCRIPTION_LENGTH} characters`,
      );
    return description;
  }

  async addMembers(
    addMembersDto: AddMembersDto,
    actorId: string,
  ): Promise<Group> {
    const { groupId, members } = addMembersDto;

    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    this.assertAdmin(group, actorId);

    for (const member of members)
      await this.blocks.assertVisible(actorId, member);
    const memberObjectIds = members.map((member) => new Types.ObjectId(member));
    const previous = new Set(group.members.map(String));

    group.members = Array.from(
      new Set([
        ...group.members.map((m) => m.toString()),
        ...memberObjectIds.map((m) => m.toString()),
      ]),
    ).map((id) => new Types.ObjectId(id));

    const saved = await group.save();
    try {
      await this.assertStillVisible(actorId, members);
    } catch (error) {
      const added = memberObjectIds.filter((id) => !previous.has(String(id)));
      await this.groupModel.updateOne(
        { _id: group._id },
        { $pull: { members: { $in: added } } },
      );
      throw error;
    }
    return saved;
  }

  async removeMembers(
    removeMembersDto: RemoveMembersDto,
    actorId: string,
  ): Promise<Group> {
    return preservationGate(this.groupModel.db, () => this.removeMembersWithHistory(removeMembersDto, actorId));
  }
  private async removeMembersWithHistory(removeMembersDto: RemoveMembersDto, actorId: string): Promise<Group> {
    const { groupId, members } = removeMembersDto;

    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    this.assertAdmin(group, actorId);
    if (members.includes(String(group.admin))) {
      throw new ForbiddenException('The group owner cannot be removed');
    }

    if (this.groupModel.db?.getClient) for (const member of group.members) {
      if (members.includes(String(member))) await this.groupModel.db.db.collection<any>('ReportMemberships').updateOne(
        { _id: `${groupId}:${member}` }, { $set: { groupId, userId: String(member), leftAt: new Date() } }, { upsert: true });
    }
    group.members = group.members.filter(
      (member) => !members.includes(member.toString()),
    );

    const saved = await group.save();
    this.blocks.groupRemoval$.next({ groupId, members });
    return saved;
  }

  async getGroupsForUser(userId: string) {
    const userObjectId = new ObjectId(userId);
    const allGroup = await this.groupModel
      .find({ members: userObjectId })
      .exec();
    return allGroup;
  }

  async updateGroup(
    groupId: string,
    updateGroupDto: UpdateGroupDto,
    actorId: string,
  ): Promise<Group> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    this.assertAdmin(group, actorId);

    if (updateGroupDto.name !== undefined) group.name = this.validName(updateGroupDto.name);
    if (updateGroupDto.description !== undefined)
      group.description = this.validDescription(updateGroupDto.description);

    return group.save();
  }

  async findById(_id: string) {
    return await this.groupModel.findById(_id);
  }

  async uploadGroupIcon(
    groupId: string,
    groupIconUrl: string,
    actorId: string,
  ) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    this.assertAdmin(group, actorId);

    group.groupIcon = groupIconUrl;
    return group.save();
  }
  async getGroupMembers(groupId: string, actorId: string) {
    const group = await this.groupModel
      .findById(groupId)
      .populate({
        path: 'members',
        model: 'Users',
        select: 'username displayname firstName lastName avatar',
      })
      .exec();

    if (!group) {
      throw new NotFoundException('Group not found');
    }
    const isMember = group.members.some(
      (member: any) => String(member?._id || member) === actorId,
    );
    if (!isMember) throw new ForbiddenException('Group membership required');

    return group;
  }

  private assertAdmin(group: GroupDocument, actorId: string) {
    if (String(group.admin) !== actorId) {
      throw new ForbiddenException(
        'Only the group owner can perform this action',
      );
    }
  }
}
