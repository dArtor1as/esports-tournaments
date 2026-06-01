import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InvitationPolicyService } from './invitation-policy.service';

describe('InvitationPolicyService', () => {
  let service: InvitationPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitationPolicyService],
    }).compile();

    service = module.get<InvitationPolicyService>(InvitationPolicyService);
  });

  describe('checkTierDifference', () => {
    it('не викидає помилку, якщо різниця рівнів <= 1', () => {
      expect(() => service.checkTierDifference(2, 1)).not.toThrow();
      expect(() => service.checkTierDifference(1, 2)).not.toThrow();
      expect(() => service.checkTierDifference(2, 2)).not.toThrow();
    });

    it('викидає BadRequestException, якщо різниця > 1', () => {
      expect(() => service.checkTierDifference(3, 1)).toThrow(
        BadRequestException,
      );
      expect(() => service.checkTierDifference(1, 3)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkCapacity', () => {
    it('не викидає помилку, якщо є місця', () => {
      expect(() => service.checkCapacity(10, 2, 16)).not.toThrow();
    });

    it('викидає BadRequestException, якщо ліміт вичерпано', () => {
      expect(() => service.checkCapacity(15, 1, 16)).toThrow(
        BadRequestException,
      );
      expect(() => service.checkCapacity(16, 0, 16)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkDuplicates', () => {
    it('не викидає помилку, якщо дублікатів немає', () => {
      expect(() => service.checkDuplicates(null, null)).not.toThrow();
    });

    it('викидає помилку, якщо команда вже є учасником', () => {
      expect(() =>
        service.checkDuplicates({ id: 'p1' } as never, null),
      ).toThrow(BadRequestException);
    });

    it('викидає помилку, якщо запрошення вже надіслано', () => {
      expect(() =>
        service.checkDuplicates(null, { id: 'inv1' } as never),
      ).toThrow(BadRequestException);
    });
  });

  describe('checkRegionRestriction', () => {
    it('дозволяє будь-який регіон команди, якщо турнір GLOBAL', () => {
      expect(() =>
        service.checkRegionRestriction('EU', 'GLOBAL'),
      ).not.toThrow();
    });

    it('дозволяє, якщо регіони збігаються', () => {
      expect(() => service.checkRegionRestriction('EU', 'EU')).not.toThrow();
    });

    it('викидає помилку при розбіжності регіонів', () => {
      expect(() => service.checkRegionRestriction('EU', 'NA')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('determineAssignedStage', () => {
    it('повертає GROUP, якщо рівень команди <= рівня турніру', () => {
      expect(service.determineAssignedStage(1, 1)).toBe('GROUP');
      expect(service.determineAssignedStage(1, 2)).toBe('GROUP');
    });

    it('повертає CQ, якщо рівень команди слабший (більше значення) за турнір', () => {
      expect(service.determineAssignedStage(3, 2)).toBe('CQ');
    });
  });
});
