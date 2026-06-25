import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { POS_FINALIZE_QUEUE } from './queue.constants';
import { LocalOrder } from '../entities/local-order.entity';
import { LocalOrderStatus } from '../entities/order-enums';

interface FinalizeJobData {
  orderId: string;
}

/**
 * Flips a POS bill from PREPARING to DONE after the auto-finalize window has
 * elapsed. The job id is namespaced per order so re-scheduling is idempotent
 * (BullMQ rejects duplicate jobIds), and we re-check the order's current
 * status before mutating so a manually voided / re-opened order is not
 * clobbered.
 */
@Processor(POS_FINALIZE_QUEUE)
export class PosProcessor extends WorkerHost {
  private readonly logger = new Logger(PosProcessor.name);

  constructor(
    @InjectRepository(LocalOrder) private readonly orderRepo: Repository<LocalOrder>,
  ) {
    super();
  }

  async process(job: Job<FinalizeJobData>): Promise<void> {
    const { orderId } = job.data;
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn({ msg: 'pos_finalize_skipped_missing', orderId });
      return;
    }
    if (order.localStatus !== LocalOrderStatus.PREPARING) {
      this.logger.log({
        msg: 'pos_timer_skipped_wrong_state',
        orderId,
        currentStatus: order.localStatus,
      });
      return;
    }
    // Timer is now purely a visual indicator. A POS bill cannot reach DONE
    // without the cashier explicitly closing it with a payment — auto-DONE
    // would leave the till short. Log the expiry so staff can audit late
    // bills, but don't mutate the order.
    this.logger.log({
      msg: 'pos_preparing_timer_elapsed',
      orderId,
      orderNumber: order.orderNumber,
    });
  }
}
