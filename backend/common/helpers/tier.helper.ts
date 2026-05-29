export class TierHelper {
  static calculateTier(rating: number): number {
    if (rating >= 2700) return 1;
    if (rating >= 1800) return 2;
    return 3;
  }
}
