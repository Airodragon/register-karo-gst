import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApplicationStatus, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApplicationsService } from './applications.service';
import {
  CreateApplicationDto,
  UpdateFormDataDto,
  UpdateStepDto,
  UserInputDto,
  StartAutomationDto,
  ResumeAutomationDto,
  ListApplicationsQueryDto,
} from './dto/application.dto';

class AssignOperatorDto {
  @IsOptional()
  @IsString()
  operatorId?: string | null;
}

type AuthUser = { id: string; role: UserRole };

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto, @Request() req: { user: AuthUser }) {
    return this.applicationsService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query() query: ListApplicationsQueryDto, @Request() req: { user: AuthUser }) {
    return this.applicationsService.findAll({
      ...query,
      userId: req.user.id,
      userRole: req.user.role,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.applicationsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id/form')
  updateForm(
    @Param('id') id: string,
    @Body() dto: UpdateFormDataDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.updateFormData(
      id,
      dto.formData,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id/step')
  updateStep(
    @Param('id') id: string,
    @Body() dto: UpdateStepDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.updateStep(id, dto.step, req.user.id);
  }

  @Get(':id/failure-screenshot')
  async failureScreenshot(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    const app = await this.applicationsService.findOne(id, req.user.id, req.user.role);
    if (!app.failureScreenshotKey) {
      return { url: null };
    }
    return this.applicationsService.getFailureScreenshotUrl(app.failureScreenshotKey);
  }

  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignOperatorDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.assignOperator(id, dto.operatorId ?? null, req.user.id);
  }

  @Post(':id/start')
  start(
    @Param('id') id: string,
    @Body() dto: StartAutomationDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.startAutomation(
      id,
      req.user.id,
      dto.fromStep,
      dto.headless,
    );
  }

  @Post(':id/resume')
  resume(
    @Param('id') id: string,
    @Body() dto: ResumeAutomationDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.resumeAutomation(id, req.user.id, dto.headless);
  }

  @Post(':id/input')
  submitInput(
    @Param('id') id: string,
    @Body() dto: UserInputDto,
    @Request() req: { user: AuthUser },
  ) {
    return this.applicationsService.submitUserInput(id, dto, req.user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.applicationsService.cancelAutomation(id, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: AuthUser }) {
    return this.applicationsService.remove(id, req.user.id);
  }
}
