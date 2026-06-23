import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers.authorization?.replace('Bearer ', '') ?? '');

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      this.jwt.verify(token);
    } catch {
      client.disconnect();
      return;
    }

    client.on('subscribe', (applicationId: string) => {
      client.join(`app:${applicationId}`);
    });
    client.on('unsubscribe', (applicationId: string) => {
      client.leave(`app:${applicationId}`);
    });
  }

  emitApplicationUpdate(applicationId: string, data: unknown) {
    this.server.to(`app:${applicationId}`).emit('application:update', data);
  }

  emitInputRequired(applicationId: string, data: unknown) {
    this.server.to(`app:${applicationId}`).emit('application:input_required', data);
  }

  emitJobEvent(applicationId: string, event: unknown) {
    this.server.to(`app:${applicationId}`).emit('job:event', event);
  }
}
