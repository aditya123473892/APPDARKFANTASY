import { BadRequestException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Connection, createConnection, Types } from 'mongoose';
import request = require('supertest');
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { CreateGroupDto } from './dtos/create-group.dto';
import { Group, GroupSchema } from '../common/schemas/group-chat.schema';
import { JwtStrategy } from '../common/guards/jwt.strategy';
import { GlobalExceptionFilter, ResponseInterceptor } from '../common/interceptors';
import { applicationValidationPipe } from '../common/validation';
import { PhotoResponseInterceptor } from '../photos/response.interceptor';
import { PhotosService } from '../photos/photos.service';
import { S3BucketService } from '../s3-bucket/s3-bucket.service';
import { BlockService } from '../user-blocks/block.service';
import { blockContext } from '../user-blocks/block-context';

describe('CreateGroupDto validation contract', () => {
  const validate = (body: object) =>
    applicationValidationPipe().transform(body, { type: 'body', metatype: CreateGroupDto });

  it('accepts the payload the mobile app sends', async () => {
    const members = [new Types.ObjectId().toHexString()];
    await expect(
      validate({ name: 'Book club', description: 'Monthly', members, clientId: 'abc123-xyz789' }),
    ).resolves.toMatchObject({ name: 'Book club', members });
  });

  it('reports every failing field under `errors`', async () => {
    const error = await validate({ name: '', members: ['nope'], extra: 1 }).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(BadRequestException);
    const body = error.getResponse();
    expect(body.errors).toEqual(
      expect.objectContaining({
        name: ['Group name is required'],
        members: expect.arrayContaining(['each value in members must be a mongodb id']),
        extra: ['property extra should not exist'],
      }),
    );
    // Existing clients still read the flat list.
    expect(body.message).toEqual(expect.arrayContaining(['Group name is required']));
  });
});

/**
 * POST /api/groups/create-group through the production HTTP pipeline: JWT
 * strategy (mobile OTP sessions), global validation pipe, response
 * interceptors and exception filter, against a real MongoDB.
 */
const integration = process.env.TEST_MONGO_URI ? describe : describe.skip;
integration('POST /groups/create-group (real MongoDB)', () => {
  const secret = 'group-http-test-secret';
  const jwt = new JwtService({ secret });
  const name = 'darkfantasy_groups_test_' + randomUUID().replace(/-/g, '');
  let db: Connection;
  let app: INestApplication;
  const token = (sub: string) => jwt.sign({ sub, auth_method: 'otp' });
  const create = (auth?: string) => {
    const call = request(app.getHttpServer())
      .post('/api/groups/create-group')
      .set('X-Client-Platform', 'mobile');
    return auth ? call.set('Authorization', `Bearer ${auth}`) : call;
  };
  const users = async (count: number, extra: object = {}) => {
    const docs = Array.from({ length: count }, (_, index) => ({
      _id: new Types.ObjectId(),
      username: `u${index}-${randomUUID()}@example.test`,
      displayname: `User ${index}`,
      roles: ['user'],
      isBlocked: false,
      ...extra,
    }));
    await db.db.collection('Users').insertMany(docs);
    return docs.map((doc) => doc._id.toHexString());
  };

  beforeAll(async () => {
    db = await createConnection(process.env.TEST_MONGO_URI!, { dbName: name }).asPromise();
    const groupModel = db.model(Group.name, GroupSchema);
    await groupModel.init();
    const blocks = new BlockService(db as any);
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [GroupController],
      providers: [
        JwtStrategy,
        { provide: GroupService, useValue: new GroupService(groupModel as any, blocks) },
        { provide: getModelToken(Group.name), useValue: groupModel },
        { provide: getConnectionToken(), useValue: db },
        { provide: PhotosService, useValue: {} },
        { provide: S3BucketService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((_req, _res, next) => blockContext.run({}, next));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(applicationValidationPipe());
    app.useGlobalInterceptors(
      new ResponseInterceptor(),
      new PhotoResponseInterceptor(new PhotosService(db, { keyFromReference: () => '' } as any)),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await db?.dropDatabase();
    await db?.close();
  });
  beforeEach(async () => {
    for (const collection of await db.db.collections()) await collection.deleteMany({});
  });

  it('lets a regular (non-admin) user create a group and own it', async () => {
    const [owner, a, b] = await users(3);
    const res = await create(token(owner))
      .send({
        name: '  Book club ',
        description: ' Monthly ',
        members: [a, b, a, owner],
        clientId: 'mobile-key-001',
      })
      .expect(201);
    expect(res.body).toMatchObject({ statusCode: 201, error: false });
    expect(res.body.data).toMatchObject({
      name: 'Book club',
      description: 'Monthly',
      admin: owner,
    });
    expect(res.body.data.members.map(String).sort()).toEqual([owner, a, b].sort());
    expect(res.body.data).not.toHaveProperty('clientId');
    expect(await db.db.collection('Groups').countDocuments()).toBe(1);
  });

  it('returns the first group for a retried clientId and 409 when the key is reused for another group', async () => {
    const [owner, a] = await users(2);
    const body = { name: 'Once', members: [a], clientId: 'retry-key-001' };
    const first = await create(token(owner)).send(body).expect(201);
    const retry = await create(token(owner)).send(body).expect(201);
    expect(retry.body.data._id).toBe(first.body.data._id);
    const conflict = await create(token(owner))
      .send({ ...body, name: 'Other' })
      .expect(409);
    expect(conflict.body.message).toMatch(/already used/);
    expect(await db.db.collection('Groups').countDocuments()).toBe(1);
  });

  it('returns 400 with field-level errors for invalid input', async () => {
    const [owner] = await users(1);
    const res = await create(token(owner)).send({ name: '', members: [] }).expect(400);
    expect(res.body.errors).toEqual({
      name: ['Group name is required'],
      members: ['Select at least one member'],
    });
    expect(await db.db.collection('Groups').countDocuments()).toBe(0);
  });

  it('returns 400 when the only member is the caller, or a member is missing, suspended or blocked', async () => {
    const [owner, blocker] = await users(2);
    const [suspended] = await users(1, { isBlocked: true });
    await db.db.collection('UserBlocks').insertOne({
      blockerId: new Types.ObjectId(blocker),
      blockedId: new Types.ObjectId(owner),
    });
    for (const members of [[owner], [new Types.ObjectId().toHexString()], [suspended], [blocker]]) {
      const res = await create(token(owner)).send({ name: 'Nope', members }).expect(400);
      expect(res.body.message).toMatch(/Select at least one member|can no longer be added/);
    }
    expect(await db.db.collection('Groups').countDocuments()).toBe(0);
  });

  it('returns 401 without a session, with a password session on mobile, or a forged token', async () => {
    const [owner, a] = await users(2);
    const body = { name: 'Nope', members: [a] };
    await create().send(body).expect(401);
    await create(jwt.sign({ sub: owner }))
      .send(body)
      .expect(401);
    await create(new JwtService({ secret: 'other' }).sign({ sub: owner, auth_method: 'otp' }))
      .send(body)
      .expect(401);
    expect(await db.db.collection('Groups').countDocuments()).toBe(0);
  });
});
