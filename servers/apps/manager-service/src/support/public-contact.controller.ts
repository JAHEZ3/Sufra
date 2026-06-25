import { Body, Controller, Get, Post } from '@nestjs/common';
import { SupportService } from './support.service';
import { SettingsService } from '../settings/settings.service';
import { PublicContactDto } from './dto/public-contact.dto';

/** Unauthenticated endpoints used by the public marketing website. */
@Controller('public/contact')
export class PublicContactController {
  constructor(
    private readonly support: SupportService,
    private readonly settings: SettingsService,
  ) {}

  /** GET /api/manager/public/contact/info — phone/email/address/hours displayed on the contact page. */
  @Get('info')
  async getInfo() {
    const data = await this.settings.getPublicContactInfo();
    return { data, message: 'تم استرجاع بيانات التواصل.' };
  }

  /** POST /api/manager/public/contact — public website contact form. */
  @Post()
  async submit(@Body() dto: PublicContactDto) {
    const result = await this.support.createFromContactForm(dto);
    return {
      data: result,
      message: 'تم إرسال رسالتك. سنتواصل معك في أقرب وقت.',
    };
  }
}
