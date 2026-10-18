import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection, Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import { Subject } from 'rxjs';
import { S3BucketService } from '../s3-bucket/s3-bucket.service';

@Injectable()
export class PhotosService implements OnModuleInit {
  readonly accountDeletion$ = new Subject<string>();
  private readonly logger = new Logger(PhotosService.name);
  private processing = 0;
  constructor(
    @InjectConnection() private readonly db: Connection,
    private readonly storage: S3BucketService,
  ) {}
  private get uploads() {
    return this.db.db.collection<any>('PhotoUploads');
  }
  private get limits() {
    return this.db.db.collection<any>('PhotoRateLimits');
  }
  private get jobs() {
    return this.db.db.collection<any>('PhotoDeletionJobs');
  }
  private get purges() {
    return this.db.db.collection<any>('AccountPurges');
  }
  async onModuleInit() {
    await this.uploads.createIndex({ owner: 1, slot: 1 }, { unique: true });
    await this.uploads.createIndex(
      { owner: 1, requestId: 1 },
      { unique: true },
    );
    await this.uploads.createIndex({ key: 1 }, { unique: true, sparse: true });
    await this.limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.jobs.createIndex({ dueAt: 1 });
    await this.purges.createIndex({ dueAt: 1 });
  }
  private async active(owner: string) {
    if (
      !Types.ObjectId.isValid(owner) ||
      !(await this.db.db.collection('Users').findOne({
        _id: new Types.ObjectId(owner),
        isBlocked: { $ne: true },
        deletionRequestedAt: { $exists: false },
      })) ||
      (await this.purges.findOne({ _id: owner }))
    )
      throw new ForbiddenException('Account is unavailable');
  }
  async rate(owner: string, action: string, maximum: number) {
    const minute = Math.floor(Date.now() / 60000);
    const _id = `${owner}:${action}:${minute}`;
    try {
      await this.limits.updateOne(
        { _id },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date(Date.now() + 120000) },
        },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      await this.limits.updateOne({ _id }, { $inc: { count: 1 } });
    }
    if ((await this.limits.findOne({ _id })).count > maximum)
      throw new HttpException('Too many photo requests', 429);
  }
  async assertActiveAccount(owner: string) {
    await this.active(owner);
  }
  private result(photo: any) {
    return { uploadId: photo._id, status: 'approved' };
  }

  async issue(owner: string, contentType: string, requestId: string) {
    await this.active(owner);
    await this.rate(owner, 'issue', 20);
    if (!['image/jpeg', 'image/webp'].includes(contentType))
      throw new BadRequestException('Unsupported image type');
    let intent = await this.uploads.findOne({ owner, requestId });
    if (intent && intent.contentType !== contentType)
      throw new ConflictException('Upload request has changed');
    if (!intent) {
      const maximum = Math.min(
        100,
        Math.max(1, Number(process.env.PHOTO_MAX_PER_USER) || 20),
      );
      for (let slot = 0; slot < maximum; slot++) {
        const _id = randomUUID();
        const candidate = {
          _id,
          owner,
          requestId,
          slot,
          contentType,
          state: 'pending',
          tempKey: `temp/${owner}/${_id}.${contentType === 'image/jpeg' ? 'jpg' : 'webp'}`,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 300000),
        };
        try {
          await this.uploads.insertOne(candidate);
          intent = candidate;
          break;
        } catch (error) {
          if (error.code !== 11000) throw error;
          intent = await this.uploads.findOne({ owner, requestId });
          if (intent) break;
        }
      }
      if (!intent)
        throw new ConflictException(
          'Photo limit reached. Delete a photo before uploading another.',
        );
    }
    if (['approved', 'attached'].includes(intent.state))
      return this.result(intent);
    if (intent.state !== 'pending' || intent.expiresAt <= new Date())
      throw new ConflictException('Upload expired; start a new upload');
    const signed = await this.storage.presign(
      intent.tempKey,
      contentType,
      Math.floor((intent.expiresAt.getTime() - Date.now()) / 1000),
    );
    return {
      uploadId: intent._id,
      status: 'pending',
      ...signed,
      expiresAt: intent.expiresAt,
    };
  }

  async confirm(owner: string, id: string) {
    await this.active(owner);
    await this.rate(owner, 'confirm', 30);
    const initial = await this.uploads.findOne({ _id: id, owner });
    if (!initial) throw new NotFoundException('Upload not found');
    if (['approved', 'attached'].includes(initial.state))
      return this.result(initial);
    if (!initial.tempKey.startsWith(`temp/${owner}/`))
      throw new ForbiddenException('Invalid upload owner');
    if (this.processing >= 2)
      throw new HttpException('Image processing is busy; retry shortly', 429);
    this.processing++;
    try {
      const token = randomUUID();
      const now = new Date();
      const claim = await this.uploads.updateOne(
        {
          _id: id,
          owner,
          expiresAt: { $gt: now },
          $or: [
            { state: 'pending' },
            { state: 'processing', leaseUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            state: 'processing',
            token,
            leaseUntil: new Date(Date.now() + 180000),
          },
        },
      );
      if (!claim.modifiedCount)
        throw new ConflictException('Upload is processing or expired');
      const key = `users/${owner}/photos/${token}.jpg`;
      // A durable cleanup job exists before writing any output. A crash cannot orphan it.
      await this.enqueue([key], new Date(Date.now() + 600000), true);
      try {
        const bytes = await this.storage.readVerified(
          initial.tempKey,
          initial.contentType,
        );
        const clean = await this.storage.sanitizeAndModerate(bytes);
        await this.active(owner);
        await this.storage.putApproved(key, clean);
        const committed = await this.uploads.updateOne(
          { _id: id, owner, state: 'processing', token },
          {
            $set: {
              state: 'approved',
              key,
              size: clean.length,
              checksum: createHash('sha256').update(clean).digest('hex'),
              approvedAt: new Date(),
            },
            $unset: { token: '', leaseUntil: '' },
          },
        );
        if (!committed.modifiedCount)
          throw new ConflictException('Upload processing lease changed');
        await this.enqueue(
          [initial.tempKey],
          new Date(Math.max(Date.now(), initial.expiresAt.getTime()) + 60000),
        );
        return this.result(initial);
      } catch (error) {
        await this.uploads.updateOne(
          { _id: id, token },
          { $set: { state: 'pending' }, $unset: { token: '', leaseUntil: '' } },
        );
        throw error;
      }
    } finally {
      this.processing--;
    }
  }

  /** Claim each approved photo for exactly one server-selected resource. Retry uses the same resource ID. */
  async bind(owner: string, ids: string[], ref: string) {
    await this.active(owner);
    if (
      !Array.isArray(ids) ||
      ids.length > 5 ||
      new Set(ids).size !== ids.length
    )
      throw new BadRequestException('Invalid photo list');
    const media: any[] = [];
    for (const id of ids) {
      const photo = await this.uploads.findOne({
        _id: id,
        owner,
        $or: [{ state: 'approved' }, { state: 'attached', ref }],
      });
      if (!photo)
        throw new BadRequestException(
          'Photo must be approved and belong to this account',
        );
      const update = await this.uploads.updateOne(
        {
          _id: id,
          owner,
          $or: [{ state: 'approved' }, { state: 'attached', ref }],
        },
        { $set: { state: 'attached', ref } },
      );
      if (!update.matchedCount)
        throw new ConflictException('Photo is already in use');
      media.push({
        storageKey: photo.key,
        filename: photo.key,
        mimetype: 'image/jpeg',
        size: photo.size,
        checksum: photo.checksum,
        originalname: 'photo.jpg',
        status: 'active',
      });
    }
    return media;
  }
  async release(owner: string, ref: string, keep: string[] = []) {
    const old = await this.uploads
      .find({ owner, ref, state: 'attached', key: { $nin: keep } })
      .toArray();
    // Persist jobs before marking records. Retries are idempotent.
    await this.enqueue(old.map((item) => item.key));
    await this.uploads.updateMany(
      { owner, ref, state: 'attached', key: { $nin: keep } },
      { $set: { state: 'deleting' } },
    );
  }
  async retire(ref: string, keys: string[]) {
    await this.enqueue(keys);
    await this.uploads.updateMany(
      { ref, key: { $in: keys } },
      { $set: { state: 'deleting' } },
    );
  }
  async replaceImage(
    collection: 'Users' | 'Groups' | 'Events',
    id: string,
    field: string,
    expected: any,
    next: any,
  ) {
    const result = await this.db.db
      .collection(collection)
      .updateOne(
        {
          _id: new Types.ObjectId(id),
          [field]: expected === undefined ? { $exists: false } : expected,
        },
        { $set: { [field]: next, updatedAt: new Date() } },
      );
    if (!result.matchedCount)
      throw new ConflictException('Photo changed; refresh before trying again');
    return this.db.db
      .collection(collection)
      .findOne({ _id: new Types.ObjectId(id) });
  }
  async deleteUnattached(owner: string, id: string) {
    await this.active(owner);
    await this.rate(owner, 'delete', 20);
    const photo = await this.uploads.findOne({
      _id: id,
      owner,
      state: { $in: ['pending', 'approved', 'deleting'] },
    });
    if (!photo) throw new NotFoundException('Unattached photo not found');
    const changed = await this.uploads.updateOne(
      { _id: id, owner, state: { $in: ['pending', 'approved', 'deleting'] } },
      { $set: { state: 'deleting' } },
    );
    if (!changed.matchedCount)
      throw new ConflictException('Photo is already in use');
    await this.enqueue(
      [photo.key, photo.tempKey],
      new Date(Math.max(Date.now(), photo.expiresAt.getTime()) + 60000),
    );
  }
  async enqueue(
    references: (string | undefined)[],
    dueAt = new Date(),
    onlyIfUnused = false,
  ) {
    for (const reference of references) {
      const key = this.storage.keyFromReference(reference);
      if (!key) continue;
      const _id = createHash('sha256').update(key).digest('hex');
      await this.jobs.updateOne(
        { _id },
        { $setOnInsert: { key, dueAt, attempts: 0, onlyIfUnused } },
        { upsert: true },
      );
    }
  }

  async present(
    value: any,
    cache = new Map<string, Promise<string>>(),
  ): Promise<any> {
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Date || value._bsontype || Buffer.isBuffer(value))
      return value;
    if (Array.isArray(value))
      return Promise.all(value.map((item) => this.present(item, cache)));
    const source = value.toObject ? value.toObject() : value;
    const result: any = {};
    for (const [field, item] of Object.entries(source)) {
      if (
        [
          'password',
          'passwordResetToken',
          'verifyEmailToken',
          'storageKey',
        ].includes(field)
      )
        continue;
      if (['avatar', 'groupIcon'].includes(field))
        result[field] = await this.displayUrl(String(item || ''), cache);
      else result[field] = await this.present(item, cache);
    }
    const key = source.storageKey || source.filename;
    if (key || (source.url && source.mimetype))
      result.url = await this.displayUrl(key || source.url, cache);
    return result;
  }
  private async displayUrl(
    reference: string,
    cache: Map<string, Promise<string>>,
  ) {
    if (!reference) return '';
    if (!cache.has(reference))
      cache.set(
        reference,
        (async () => {
          const key = this.storage.keyFromReference(reference);
          // Legacy/unmoderated media stays hidden until explicitly migrated.
          if (!key || !key.startsWith('users/')) return '';
          const photo = await this.uploads.findOne({
            key,
            state: { $in: ['approved', 'attached'] },
          });
          if (!photo) return '';
          return await this.storage.getSignedURL(key, undefined, 120);
        })(),
      );
    return cache.get(reference);
  }

  async accessUrl(key: string, seconds = 120) {
    const photo = await this.uploads.findOne({
      key,
      state: { $in: ['approved', 'attached'] },
    });
    if (!photo || !key.startsWith(`users/${photo.owner}/photos/`))
      throw new NotFoundException('Photo not available');
    return this.storage.getSignedURL(key, undefined, seconds);
  }

  /** Operator-only migration entry point; it is deliberately not an HTTP endpoint. */
  async importLegacy(owner: string, reference: string, ref: string) {
    const key = this.storage.keyFromReference(reference);
    if (!key)
      throw new BadRequestException(
        'Legacy object has no valid key in this bucket',
      );
    const existing = await this.uploads.findOne({
      key,
      owner,
      state: 'attached',
      ref,
    });
    if (existing) return key;
    const head = await this.storage.s3
      .headObject({ Bucket: this.storage.bucket, Key: key })
      .promise();
    const bytes = await this.storage.readVerified(key, head.ContentType);
    const requestId =
      'legacy-' +
      createHash('sha256')
        .update(ref + ':' + key)
        .digest('hex')
        .slice(0, 40);
    const issued: any = await this.issue(owner, head.ContentType, requestId);
    if (issued.status !== 'approved') {
      await this.storage.s3
        .putObject({
          Bucket: this.storage.bucket,
          Key: issued.fields.key,
          Body: bytes,
          ContentType: head.ContentType,
          ServerSideEncryption: 'AES256',
        })
        .promise();
      await this.confirm(owner, issued.uploadId);
    }
    const [photo] = await this.bind(owner, [issued.uploadId], ref);
    return photo.filename;
  }

  async requestAccountDeletion(owner: string) {
    await this.active(owner);
    // Durable job first. Guard rejects this account while the worker finishes.
    await this.purges.updateOne(
      { _id: owner },
      {
        $setOnInsert: {
          requestedAt: new Date(),
          dueAt: new Date(Date.now() + 600000),
        },
      },
      { upsert: true },
    );
    await this.db.db
      .collection('Users')
      .updateOne(
        { _id: new Types.ObjectId(owner) },
        { $set: { isBlocked: true, deletionRequestedAt: new Date() } },
      );
    await this.uploads.updateMany({ owner }, { $set: { state: 'deleting' } });
    this.accountDeletion$.next(owner);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanup() {
    try {
      const abandoned = await this.uploads
        .find({
          $or: [
            {
              state: { $in: ['pending', 'processing'] },
              expiresAt: { $lt: new Date(Date.now() - 600000) },
            },
            {
              state: 'approved',
              approvedAt: { $lt: new Date(Date.now() - 86400000) },
            },
            { state: 'deleting' },
          ],
        })
        .limit(100)
        .toArray();
      for (const photo of abandoned) {
        await this.enqueue(
          [photo.tempKey, photo.key],
          new Date(Math.max(Date.now(), photo.expiresAt.getTime() + 60000)),
          true,
        );
        await this.uploads.updateOne(
          { _id: photo._id, state: photo.state },
          { $set: { state: 'deleting' } },
        );
      }
      // A process may die after claiming photos but before saving the resource.
      for (const photo of await this.uploads
        .find({
          state: 'attached',
          createdAt: { $lt: new Date(Date.now() - 86400000) },
        })
        .limit(100)
        .toArray()) {
        if (!(await this.inUse(photo.key))) {
          await this.enqueue([photo.key, photo.tempKey]);
          await this.uploads.updateOne(
            { _id: photo._id, state: 'attached', ref: photo.ref },
            { $set: { state: 'deleting' } },
          );
        }
      }
      // Expired/revoked chat photos are physically removed, not just hidden.
      const chats = await this.db.db
        .collection('ChatMessages')
        .find({
          media: {
            $elemMatch: {
              $or: [{ expiresAt: { $lte: new Date() } }, { status: 'revoked' }],
            },
          },
        })
        .limit(100)
        .toArray();
      for (const chat of chats)
        for (const media of chat.media || []) {
          if (
            media.status === 'revoked' ||
            (media.expiresAt && new Date(media.expiresAt) <= new Date())
          ) {
            await this.enqueue([media.storageKey || media.filename]);
            await this.uploads.updateMany(
              { key: media.storageKey || media.filename },
              { $set: { state: 'deleting' } },
            );
          }
        }
      for (const job of await this.jobs
        .find({ dueAt: { $lte: new Date() } })
        .limit(100)
        .toArray()) {
        if (
          job.onlyIfUnused &&
          (await this.uploads.findOne({
            key: job.key,
            state: { $in: ['approved', 'attached'] },
          }))
        ) {
          await this.jobs.deleteOne({ _id: job._id });
          continue;
        }
        if (await this.inUse(job.key)) {
          await this.jobs.updateOne(
            { _id: job._id },
            { $set: { dueAt: new Date(Date.now() + 60000) } },
          );
          continue;
        }
        try {
          await this.storage.deleteOne(job.key);
          // A temp key must not free a quota slot while its approved object remains.
          await this.uploads.deleteMany({ state: 'deleting', key: job.key });
          await this.uploads.deleteMany({
            state: 'deleting',
            tempKey: job.key,
            key: { $exists: false },
          });
          await this.jobs.deleteOne({ _id: job._id });
        } catch {
          await this.jobs.updateOne(
            { _id: job._id },
            {
              $inc: { attempts: 1 },
              $set: {
                dueAt: new Date(
                  Date.now() +
                    Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
                ),
              },
            },
          );
          this.logger.warn('Photo deletion pending retry');
        }
      }
      for (const purge of await this.purges
        .find({ dueAt: { $lte: new Date() } })
        .limit(10)
        .toArray()) {
        try {
          await this.purgeAccount(purge._id);
        } catch {
          await this.purges.updateOne(
            { _id: purge._id },
            {
              $inc: { attempts: 1 },
              $set: {
                dueAt: new Date(
                  Date.now() +
                    Math.min(
                      3600000,
                      60000 * 2 ** Math.min(purge.attempts || 0, 6),
                    ),
                ),
              },
            },
          );
          this.logger.warn('Account purge pending retry');
        }
      }
    } catch {
      this.logger.warn('Photo cleanup pending retry');
    }
  }

  private async inUse(key: string) {
    if (key.startsWith('temp/')) return false;
    // Deletion and image replacement can race. An object referenced by a live
    // record must survive, even if an older mutation already enqueued it.
    const urlPattern = new RegExp(
      '/' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?|$)',
    );
    const values: any = { $in: [key, urlPattern] };
    for (const [collection, filter] of [
      ['Users', { avatar: values }],
      ['Groups', { groupIcon: values }],
      [
        'Posts',
        {
          media: {
            $elemMatch: {
              $or: [
                { filename: key },
                { storageKey: key },
                { url: urlPattern },
              ],
            },
          },
        },
      ],
      [
        'Events',
        {
          $or: [
            { 'cover.filename': key },
            { 'cover.storageKey': key },
            { 'cover.url': urlPattern },
          ],
        },
      ],
      [
        'ChatMessages',
        {
          media: {
            $elemMatch: {
              $and: [
                {
                  $or: [
                    { filename: key },
                    { storageKey: key },
                    { url: urlPattern },
                  ],
                },
                { status: { $nin: ['revoked', 'quarantined'] } },
                {
                  $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } },
                  ],
                },
              ],
            },
          },
        },
      ],
    ] as [string, any][]) {
      if (
        await this.db.db
          .collection(collection)
          .findOne(filter, { projection: { _id: 1 } })
      )
        return true;
    }
    return false;
  }

  private async purgeAccount(owner: string) {
    const id = new Types.ObjectId(owner);
    const users = this.db.db.collection('Users');
    await users.updateOne(
      { _id: id },
      { $set: { isBlocked: true, deletionRequestedAt: new Date() } },
    );
    const keys = new Set<string>();
    const add = (value: string) => {
      const key = this.storage.keyFromReference(value);
      if (key) keys.add(key);
    };
    const user = await users.findOne({ _id: id });
    add(user?.avatar);
    const posts = await this.db.db
      .collection('Posts')
      .find({ user: id })
      .toArray();
    const groups = await this.db.db
      .collection('Groups')
      .find({ admin: id })
      .toArray();
    const messages = await this.db.db
      .collection('ChatMessages')
      .find({
        $or: [
          { sender: id },
          { receiver: id },
          { groupId: { $in: groups.map((group) => group._id) } },
        ],
      })
      .toArray();
    const events = await this.db.db
      .collection('Events')
      .find({ creator: id })
      .toArray();
    for (const row of [
      ...posts,
      ...messages.filter((message) => String(message.sender) === owner),
    ])
      for (const media of row.media || [])
        add(media.storageKey || media.filename || media.url);
    groups.forEach((group) => add(group.groupIcon));
    events.forEach((event) => add(event.cover?.filename || event.cover?.url));
    for (const photo of await this.uploads.find({ owner }).toArray()) {
      add(photo.key);
      add(photo.tempKey);
    }
    for (const prefix of [`users/${owner}/`, `temp/${owner}/`])
      (await this.storage.keysUnder(prefix)).forEach(add);
    // Any failure keeps the account blocked and the durable job present.
    for (const key of keys) await this.storage.deleteOne(key);
    await this.uploads.deleteMany({ owner });
    await this.db.db.collection('Posts').deleteMany({ user: id });
    // Photos authored by other users in removed conversations also get durable
    // cleanup jobs; another live reference protects shared legacy objects.
    for (const message of messages) {
      await this.retire(
        `chat:${message._id}`,
        (message.media || []).map(
          (media) => media.storageKey || media.filename || media.url,
        ),
      );
    }
    await this.db.db
      .collection('ChatMessages')
      .deleteMany({ _id: { $in: messages.map((message) => message._id) } });
    await this.db.db.collection('Groups').deleteMany({ admin: id });
    await this.db.db
      .collection('Groups')
      .updateMany({ members: id }, { $pull: { members: id } } as any);
    await this.db.db.collection('Events').deleteMany({ creator: id });
    await this.db.db
      .collection('follows')
      .deleteMany({ $or: [{ follower: id }, { following: id }] });
    const postIds = posts.map((post) => post._id);
    const deletedComments = await this.db.db
      .collection('Comments')
      .find(
        { $or: [{ user: id }, { post: { $in: postIds } }] },
        { projection: { _id: 1 } },
      )
      .toArray();
    const deletedLikes = await this.db.db
      .collection('Likes')
      .find(
        { $or: [{ user: id }, { post: { $in: postIds } }] },
        { projection: { _id: 1 } },
      )
      .toArray();
    await this.db.db.collection('Posts').updateMany({}, {
      $pull: {
        comments: { $in: deletedComments.map((row) => row._id) },
        likes: { $in: deletedLikes.map((row) => row._id) },
      },
    } as any);
    await this.db.db
      .collection('Comments')
      .deleteMany({ _id: { $in: deletedComments.map((row) => row._id) } });
    await this.db.db
      .collection('Likes')
      .deleteMany({ _id: { $in: deletedLikes.map((row) => row._id) } });
    await this.db.db
      .collection('UserBookMark')
      .deleteMany({ $or: [{ userId: id }, { bookMarkUser: id }] });
    await this.db.db
      .collection('PostBookMark')
      .deleteMany({ $or: [{ userId: id }, { postId: { $in: postIds } }] });
    await this.db.db
      .collection('PostRequest')
      .deleteMany({ $or: [{ userId: id }, { requestedUserId: id }] });
    await users.deleteOne({ _id: id });
    await this.purges.deleteOne({ _id: owner });
  }
}
