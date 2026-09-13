import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';

describe('RetentionService', () => {
  let service: RetentionService;

  const mockPrisma = {
    organization: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    resident: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockFileService = {
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FileService, useValue: mockFileService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  it('does nothing when no organization is past its 30-day cancellation grace period', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([]);

    const result = await service.wipeCancelledOrganizations(new Date('2026-06-01'));

    expect(result.organizationsWiped).toBe(0);
    expect(mockPrisma.resident.findMany).not.toHaveBeenCalled();
  });

  it('wipes photo/ID document files and nulls the columns for an org past its grace period', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
    mockPrisma.resident.findMany.mockResolvedValue([
      { id: 'res-1', photoKey: 'org-1/photos/a.jpg', idDocumentKey: 'org-1/docs/a.pdf' },
      { id: 'res-2', photoKey: null, idDocumentKey: 'org-1/docs/b.pdf' },
    ]);
    mockFileService.delete.mockResolvedValue(undefined);
    mockPrisma.resident.update.mockResolvedValue({});
    mockPrisma.organization.update.mockResolvedValue({});

    const now = new Date('2026-06-01');
    const result = await service.wipeCancelledOrganizations(now);

    expect(result.organizationsWiped).toBe(1);
    expect(mockFileService.delete).toHaveBeenCalledWith('org-1', 'org-1/photos/a.jpg');
    expect(mockFileService.delete).toHaveBeenCalledWith('org-1', 'org-1/docs/a.pdf');
    expect(mockFileService.delete).toHaveBeenCalledWith('org-1', 'org-1/docs/b.pdf');
    expect(mockFileService.delete).toHaveBeenCalledTimes(3);

    expect(mockPrisma.resident.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { photoKey: null, idDocumentKey: null },
    });
    expect(mockPrisma.resident.update).toHaveBeenCalledWith({
      where: { id: 'res-2' },
      data: { photoKey: null, idDocumentKey: null },
    });

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { dataWipedAt: now },
    });
  });

  it('queries only organizations cancelled at least 30 days ago and not already wiped', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([]);

    const now = new Date('2026-06-01T00:00:00.000Z');
    await service.wipeCancelledOrganizations(now);

    const call = mockPrisma.organization.findMany.mock.calls[0][0];
    expect(call.where.dataWipedAt).toBeNull();
    const cutoff = call.where.cancelledAt.lte as Date;
    expect(cutoff.toISOString()).toBe('2026-05-02T00:00:00.000Z');
  });

  it('continues wiping other files even if one file delete fails', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
    mockPrisma.resident.findMany.mockResolvedValue([
      { id: 'res-1', photoKey: 'org-1/photos/a.jpg', idDocumentKey: null },
    ]);
    mockFileService.delete.mockRejectedValueOnce(new Error('not found'));
    mockPrisma.resident.update.mockResolvedValue({});
    mockPrisma.organization.update.mockResolvedValue({});

    const result = await service.wipeCancelledOrganizations(new Date('2026-06-01'));

    expect(result.organizationsWiped).toBe(1);
    expect(mockPrisma.resident.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { photoKey: null, idDocumentKey: null },
    });
    expect(mockPrisma.organization.update).toHaveBeenCalled();
  });
});
