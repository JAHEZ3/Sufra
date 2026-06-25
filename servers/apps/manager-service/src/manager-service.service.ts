import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Manager } from './entities/manager.entity';

@Injectable()
export class ManagerServiceService {
  private readonly logger = new Logger(ManagerServiceService.name);

  constructor(
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
  ) {}

  async createManager(data: {
    userId: string;
    fullName: string;
  }) {
    const existing = await this.managerRepo.findOne({ where: { userId: data.userId } });
    if (existing) {
      this.logger.warn(`Manager profile already exists for userId: ${data.userId}`);
      return;
    }
    await this.managerRepo.save(
      this.managerRepo.create({
        userId: data.userId,
        fullName: data.fullName,
        permissions: [],
      }),
    );
    this.logger.log(`Manager profile created for userId: ${data.userId}`);
  }
}
