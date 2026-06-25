import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SupportTicket,
  SupportTicketSource,
} from '../entities/support-ticket.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { PublicContactDto } from './dto/public-contact.dto';

interface ListParams {
  status?: string;
  source?: SupportTicketSource;
  page?: number;
  limit?: number;
}

interface AuthUser {
  sub?: string;
  email?: string;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly repo: Repository<SupportTicket>,
  ) {}

  async create(dto: CreateSupportTicketDto, user?: AuthUser) {
    const ticket = this.repo.create({
      submittedByUserId: user?.sub ?? null,
      submittedByEmail: user?.email ?? null,
      submittedByName: null,
      submittedByPhone: null,
      source: 'manager',
      subject: dto.subject ?? 'general',
      priority: dto.priority ?? 'normal',
      title: dto.title.trim(),
      message: dto.message.trim(),
      status: 'open',
    });
    return this.repo.save(ticket);
  }

  /** Creates a ticket from the public website contact form (unauthenticated). */
  async createFromContactForm(dto: PublicContactDto) {
    const ticket = this.repo.create({
      submittedByUserId: null,
      submittedByEmail: dto.email.trim().toLowerCase(),
      submittedByName: dto.name.trim(),
      submittedByPhone: dto.phone?.trim() || null,
      source: 'contact_form',
      subject: dto.subject ?? 'general',
      priority: 'normal',
      title: dto.title.trim(),
      message: dto.message.trim(),
      status: 'open',
    });
    const saved = await this.repo.save(ticket);
    return {
      id: saved.id,
      createdAt: saved.createdAt,
    };
  }

  async list({ status, source, page = 1, limit = 20 }: ListParams) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

    const qb = this.repo
      .createQueryBuilder('t')
      .orderBy('t.created_at', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (status) qb.andWhere('t.status = :status', { status });
    if (source) qb.andWhere('t.source = :source', { source });

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async getOne(id: string) {
    const ticket = await this.repo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('تذكرة الدعم غير موجودة.');
    }
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateSupportTicketStatusDto) {
    const ticket = await this.getOne(id);
    ticket.status = dto.status;
    if (dto.resolutionNote !== undefined) {
      ticket.resolutionNote = dto.resolutionNote.trim() || null;
    }
    return this.repo.save(ticket);
  }
}
