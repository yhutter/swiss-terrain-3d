export class IdGenerator {
    static generate(lodLevel: number, xPos: number, zPos: number): string {
        return `lod${lodLevel}_x${xPos}_z${zPos}`;
    }
}
