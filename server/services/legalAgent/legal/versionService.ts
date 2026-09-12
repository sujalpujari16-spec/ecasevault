/**
 * e-CASEVAULT Legal Version Service
 * Validates enacted legal versions, effective dates, and statutory transitions.
 */

export class VersionService {
  private static instance: VersionService;

  public static getInstance(): VersionService {
    if (!VersionService.instance) {
      VersionService.instance = new VersionService();
    }
    return VersionService.instance;
  }

  public getStatuteVersion(actCode: string): string {
    switch (actCode.toUpperCase()) {
      case 'BNS':
        return 'Bharatiya Nyaya Sanhita, 2023 (Enacted 2023, Effective 1 July 2024)';
      case 'BNSS':
        return 'Bharatiya Nagarik Suraksha Sanhita, 2023 (Enacted 2023, Effective 1 July 2024)';
      case 'BSA':
        return 'Bharatiya Sakshya Adhiniyam, 2023 (Enacted 2023, Effective 1 July 2024)';
      default:
        return 'Official Gazetted Version 2023';
    }
  }

  public isEnactedAndInForce(incidentDate?: string): boolean {
    if (!incidentDate) return true;
    const incident = new Date(incidentDate);
    const effective = new Date('2024-07-01');
    return incident >= effective;
  }
}
