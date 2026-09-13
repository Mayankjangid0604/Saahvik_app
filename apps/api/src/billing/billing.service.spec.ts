import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptService } from './receipt.service';
import { FileService } from '../file/file.service';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  feeStructure: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  dues: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  resident: {
    findFirst: jest.fn(),
  },
  idempotencyRecord: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockReceiptService = {
  generateReceipt: jest.fn().mockResolvedValue(Buffer.from('pdf')),
};

const mockFileService = {
  uploadBuffer: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_xxx';
    if (key === 'RAZORPAY_KEY_SECRET') return 'rzp_secret_xxx';
    if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'webhook_secret';
    return undefined;
  }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReceiptService, useValue: mockReceiptService },
        { provide: FileService, useValue: mockFileService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  describe('setFeeStructure', () => {
    it('should create a fee structure with paisa values', async () => {
      const feeData = {
        residentId: 'res-1',
        monthlyRentPaisa: BigInt(850000),
        effectiveFrom: new Date('2024-01-01'),
      };

      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1', organizationId: 'org-1' });
      mockPrisma.feeStructure.create.mockResolvedValue({
        id: 'fee-1',
        ...feeData,
        organizationId: 'org-1',
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.setFeeStructure('org-1', feeData.residentId, 'user-1', feeData.monthlyRentPaisa, '2024-01-01');

      expect(mockPrisma.feeStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          residentId: 'res-1',
          monthlyRentPaisa: BigInt(850000),
        }),
      });
    });
  });

  describe('recordPayment', () => {
    it('should return cached response for duplicate idempotency keys', async () => {
      const cachedResponse = { id: 'pay-1', amountPaisa: '50000' };
      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1', organizationId: 'org-1' });
      mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
        id: 'idem-1',
        key: 'key-123',
        response: cachedResponse,
      });

      const result = await service.recordPayment('org-1', 'res-1', 'user-1', {
        amountPaisa: BigInt(50000),
        method: 'cash' as any,
        paidOn: '2024-01-15',
        idempotencyKey: 'key-123',
      });

      expect(result).toEqual(cachedResponse);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getDues', () => {
    it('should return paginated dues', async () => {
      const mockDues = [
        {
          id: 'due-1',
          residentId: 'res-1',
          amountDuePaisa: BigInt(850000),
          dueSince: new Date(),
          settled: false,
        },
      ];

      mockPrisma.dues.findMany.mockResolvedValue(mockDues);
      mockPrisma.dues.count.mockResolvedValue(1);

      const result = await service.getDues('org-1', { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getPayments', () => {
    it('should return paginated payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      mockPrisma.resident.findFirst.mockResolvedValue({ id: 'res-1', organizationId: 'org-1' });
      const result = await service.getPayments('org-1', 'res-1', { page: 1, pageSize: 20 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
