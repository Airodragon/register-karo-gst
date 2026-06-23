import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { DocumentsModule } from './documents/documents.module';
import { JobsModule } from './jobs/jobs.module';
import { EventsModule } from './events/events.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { TemplatesModule } from './templates/templates.module';
import { HealthModule } from './health/health.module';
import { LoggingInterceptor } from './common/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ApplicationsModule,
    DocumentsModule,
    JobsModule,
    EventsModule,
    StorageModule,
    UsersModule,
    TemplatesModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
