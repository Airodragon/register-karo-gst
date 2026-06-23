import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { IsString } from 'class-validator';
import { ApplicationsService } from '../applications/applications.service';
import { StorageService } from '../storage/storage.service';
import { WorkerAuthGuard } from './worker-auth.guard';
import { WorkerCompleteDto, WorkerUpdateDto } from './dto/worker.dto';

class ScreenshotDto {
  @IsString()
  imageBase64!: string;
}

@Controller('internal/worker')
@UseGuards(WorkerAuthGuard)
export class WorkerController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly storage: StorageService,
  ) {}

  @Get('applications/:id')
  getApplication(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Post('applications/:id/update')
  update(@Param('id') id: string, @Body() dto: WorkerUpdateDto) {
    return this.applicationsService.updateFromWorker(id, {
      status: dto.status,
      currentStep: dto.currentStep,
      trn: dto.trn,
      trnExpiresAt: dto.trnExpiresAt ? new Date(dto.trnExpiresAt) : undefined,
      arn: dto.arn,
      pendingInput: dto.pendingInput,
      pendingInputData: dto.pendingInputData,
      portalSession: dto.portalSession,
      errorLog: dto.errorLog,
      automationProgress: dto.automationProgress,
    });
  }

  @Post('applications/:id/screenshot')
  async screenshot(@Param('id') id: string, @Body() dto: ScreenshotDto) {
    const buffer = Buffer.from(dto.imageBase64, 'base64');
    const key = await this.storage.upload(
      id,
      'failure-screenshot',
      'failure.png',
      buffer,
      'image/png',
    );
    return this.applicationsService.updateFromWorker(id, {
      failureScreenshotKey: key,
    });
  }

  @Post('applications/:id/complete')
  complete(@Param('id') id: string, @Body() dto: WorkerCompleteDto) {
    if (!dto.success && dto.error) {
      return this.applicationsService.updateFromWorker(id, {
        status: ApplicationStatus.FAILED,
        errorLog: dto.error,
      });
    }
    return { ok: true };
  }
}
