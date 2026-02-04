import { Test, TestingModule } from '@nestjs/testing';
import { EventLogsService } from './event-logs.service';

describe('EventLogsService', () => {
  let service: EventLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventLogsService],
    }).compile();

    service = module.get<EventLogsService>(EventLogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
