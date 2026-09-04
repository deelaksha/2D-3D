/**
 * Parametric Sizing & Clearance Calculator for Automatic Connector Generation.
 */

export class ClearanceCalculator {
  /**
   * Computes recommended manufacturing clearance based on material thickness and laser/CNC kerf.
   */
  public static calculateClearance(
    thicknessMm: number,
    clearanceOverride?: number
  ): number {
    if (clearanceOverride !== undefined && clearanceOverride > 0) {
      return Number(clearanceOverride.toFixed(3));
    }
    if (thicknessMm <= 3.0) return 0.15;
    if (thicknessMm <= 6.0) return 0.20;
    return 0.25;
  }

  /**
   * Computes complementary tab and slot dimensions.
   */
  public static calculateTabSlotDimensions(
    edgeLengthMm: number,
    thicknessA: number,
    thicknessB: number,
    joiningAngleDeg = 180.0,
    clearanceOverride?: number
  ): {
    tabWidth: number;
    tabDepth: number;
    slotWidth: number;
    slotDepth: number;
    clearance: number;
  } {
    const clearance = this.calculateClearance(thicknessA, clearanceOverride);

    // Feature width along the edge
    const maxTabWidth = Math.max(8.0, edgeLengthMm * 0.5);
    const tabWidth = Number(Math.max(6.0, Math.min(maxTabWidth, 24.0)).toFixed(2));

    // Depth depends on whether the joining angle is perpendicular (90°) or planar (180°)
    let tabDepth: number;
    if (Math.abs(joiningAngleDeg - 90.0) < 15.0 || Math.abs(joiningAngleDeg - 270.0) < 15.0) {
      // Orthogonal joint: tab plugs through thickness of piece B
      tabDepth = Number(thicknessB.toFixed(2));
    } else {
      // Planar or angled joint
      tabDepth = Number(Math.max(3.0, Math.min(thicknessA * 1.5, 12.0)).toFixed(2));
    }

    // Complementary socket dimensions with clearance
    const slotWidth = Number((tabWidth + 2 * clearance).toFixed(2));
    const slotDepth = Number((tabDepth + clearance).toFixed(2));

    return {
      tabWidth,
      tabDepth,
      slotWidth,
      slotDepth,
      clearance,
    };
  }

  /**
   * Computes complementary crossing notch dimensions (half-lap).
   */
  public static calculateNotchDimensions(
    edgeLengthMm: number,
    thicknessA: number,
    thicknessB: number,
    clearanceOverride?: number
  ): {
    notchWidthA: number;
    notchDepthA: number;
    notchWidthB: number;
    notchDepthB: number;
    clearance: number;
  } {
    const clearance = this.calculateClearance(thicknessA, clearanceOverride);

    // In a half-lap crossing joint:
    // Width of notch A matches thickness of Piece B + clearance
    const notchWidthA = Number((thicknessB + 2 * clearance).toFixed(2));
    // Depth of notch A is half the piece width/height or thickness
    const notchDepthA = Number((thicknessA * 0.5).toFixed(2));

    const notchWidthB = Number((thicknessA + 2 * clearance).toFixed(2));
    const notchDepthB = Number((thicknessB * 0.5).toFixed(2));

    return {
      notchWidthA,
      notchDepthA,
      notchWidthB,
      notchDepthB,
      clearance,
    };
  }
}
