import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { WorkerController } from './worker.controller';
import { ApplicationsModule } from '../applications/applications.module';
import { EventsModule } from '../events/events.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => ApplicationsModule), EventsModule, StorageModule],
  controllers: [WorkerController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
