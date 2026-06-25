import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const imageMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (err: any, accept: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('يُسمح فقط برفع ملفات الصور.'), false);
    }
    cb(null, true);
  },
};

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** GET /api/manager/admin/settings */
  @Get()
  get() {
    return this.settings.getAll();
  }

  /** POST /api/manager/admin/settings — same semantics as PATCH (per-section merge). */
  @Post()
  replace(@Body() dto: UpdateSettingsDto) {
    return this.settings.patch(dto);
  }

  /** PATCH /api/manager/admin/settings — shallow-merge any sections provided. */
  @Patch()
  patch(@Body() dto: UpdateSettingsDto) {
    return this.settings.patch(dto);
  }

  /** PATCH /api/manager/admin/settings/logo — multipart `image` field. */
  @Patch('logo')
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  uploadLogo(@UploadedFile() image: Express.Multer.File) {
    return this.settings.uploadLogo(image);
  }
}
