export enum IndexStitchingMode {
    Full = 0,

    North = 1 << 0, // 1
    East = 1 << 1, // 2
    South = 1 << 2, // 4
    West = 1 << 3, // 8

    // composites
    NorthEast = North | East,   // 3
    SouthEast = South | East,   // 6
    SouthWest = South | West,   // 12
    NorthWest = North | West,   // 9
}
