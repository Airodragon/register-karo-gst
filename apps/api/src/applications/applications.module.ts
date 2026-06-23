import { Module, forwardRef } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { TrnExpiryService } from './trn-expiry.service';
import { JobsModule } from '../jobs/jobs.module';
import { EventsModule } from '../events/events.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => JobsModule), EventsModule, StorageModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, TrnExpiryService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
