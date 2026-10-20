import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { blockContext } from '../../user-blocks/block-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly db: Connection,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload) {
    if (!Types.ObjectId.isValid(payload.sub)) throw new UnauthorizedException();
    const user = await this.db.db
      .collection('Users')
      .findOne({
        _id: new Types.ObjectId(payload.sub),
        isBlocked: { $ne: true },
        deletionRequestedAt: { $exists: false },
      });
    const deletion = await this.db.db
      .collection<any>('AccountPurges')
      .findOne({ _id: String(payload.sub) });
    if (!user || deletion || user.moderationSuspendedUntil > new Date())
      throw new UnauthorizedException('Account is unavailable');
    const context = blockContext.getStore();
    if (context) context.viewerId = String(user._id);
    return { id: String(user._id), user: user.username, roles: user.roles,
      staffClaims: { iat: payload.iat, exp: payload.exp, amr: payload.amr, iss: payload.iss } };
  }
}
