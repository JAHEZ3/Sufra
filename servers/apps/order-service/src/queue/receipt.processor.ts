import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { RECEIPT_QUEUE, JOBS } from './queue.constants';
import { ReceiptService } from '../receipt/receipt.service';
import { OnlineOrder as Order } from '../entities/online-order.entity';
import { CartItem } from '../cart/cart.service';

export interface GenerateReceiptJobData {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  customerId: string;
  items: CartItem[];
}

@Processor(RECEIPT_QUEUE)
export class ReceiptProcessor extends WorkerHost {
  private readonly logger = new Logger(ReceiptProcessor.name);

  constructor(
    private readonly receiptService: ReceiptService,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.GENERATE_RECEIPT) return;

    const { orderId, items } = job.data as GenerateReceiptJobData;

    // Idempotency: skip if receipt already generated
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn({ msg: 'receipt_job_order_not_found', orderId, jobId: job.id });
      return;
    }
    if (order.receiptKey) {
      this.logger.log({ msg: 'receipt_already_exists', orderId, jobId: job.id });
      return;
    }

    this.logger.log({ msg: 'receipt_job_started', orderId, jobId: job.id, attempt: job.attemptsMade });

    const key = await this.receiptService.generateAndUpload(order, items);
    await this.orderRepo.update(orderId, { receiptKey: key });

    this.logger.log({ msg: 'receipt_job_done', orderId, key, jobId: job.id });
  }
}
