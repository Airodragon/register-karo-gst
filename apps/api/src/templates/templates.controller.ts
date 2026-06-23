import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { IsEnum, IsObject, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplatesService } from './templates.service';

class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(['proprietorship', 'partnership', 'huf'])
  constitution!: 'proprietorship' | 'partnership' | 'huf';

  @IsObject()
  formData!: Record<string, unknown>;
}

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list(@Request() req: { user: { id: string; role: string } }) {
    return this.templatesService.list(req.user.id, req.user.role);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templatesService.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.templatesService.create(req.user.id, dto);
  }
}
