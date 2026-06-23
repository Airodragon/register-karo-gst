import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-worker-token'];
    const expected = this.config.get<string>('WORKER_TOKEN', 'worker-dev-token');
    if (token !== expected) {
      throw new UnauthorizedException('Invalid worker token');
    }
    return true;
  }
}
