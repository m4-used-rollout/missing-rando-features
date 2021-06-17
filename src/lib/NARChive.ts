/*----------------------------------------------------------------------------*/
/*--  NARChive.ts                                                           --*/
/*--                                                                        --*/
/*--  Originally written in Java by Dabomstew under the terms of the GPL:   --*/
/*--                                                                        --*/
/*--  This program is free software: you can redistribute it and/or modify  --*/
/*--  it under the terms of the GNU General Public License as published by  --*/
/*--  the Free Software Foundation, either version 3 of the License, or     --*/
/*--  (at your option) any later version.                                   --*/
/*--                                                                        --*/
/*--  This program is distributed in the hope that it will be useful,       --*/
/*--  but WITHOUT ANY WARRANTY; without even the implied warranty of        --*/
/*--  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the          --*/
/*--  GNU General Public License for more details.                          --*/
/*--                                                                        --*/
/*--  You should have received a copy of the GNU General Public License     --*/
/*--  along with this program. If not, see <http://www.gnu.org/licenses/>.  --*/
/*----------------------------------------------------------------------------*/

export default class NARChive {
    public filenames: string[] = [];
    public files: Buffer[] = [];

    public hasFilenames = false;

    constructor(data: Buffer = null) {
        if (!data)
            return; // creates a new empty NARC with no filenames by default
        let frames = this.readNitroFrames(data);
        if (!frames["FATB"] || !frames["FNTB"] || !frames["FIMG"]) {
            throw new Error("Not a valid narc file");
        }

        // File contents
        let fatbframe = frames["FATB"];
        let fimgframe = frames["FIMG"];
        let fileCount = fatbframe.readUInt32LE(0);
        for (let i = 0; i < fileCount; i++) {
            let startOffset = fatbframe.readUInt32LE(4 + i * 8);
            let endOffset = fatbframe.readUInt32LE(8 + i * 8);
            let thisFile = fimgframe.slice(startOffset, endOffset);
            this.files.push(thisFile);
        }

        // Filenames?
        let fntbframe = frames["FNTB"];
        let unk1 = fntbframe.readUInt32LE(0);
        if (unk1 == 8) {
            // Filenames exist
            this.hasFilenames = true;
            let offset = 8;
            for (let i = 0; i < fileCount; i++) {
                let fnLength = (fntbframe[offset] & 0xFF);
                offset++;
                let filename = fntbframe.toString("ascii", offset, offset + fnLength);
                this.filenames.push(filename);
            }
        }
        else {
            this.hasFilenames = false;
            for (let i = 0; i < fileCount; i++) {
                this.filenames.push(null);
            }
        }
    }

    public getBytes() {
        // Get bytes required for FIMG frame
        let bytesRequired = 0;
        this.files.forEach(file => {
            bytesRequired += Math.ceil(file.length / 4.0) * 4;
        });
        // FIMG frame & FATB frame build

        // 4 for numentries, 8*size for entries, 8 for nitro header
        let fatbFrame = Buffer.allocUnsafe(4 + this.files.length * 8 + 8);
        // bytesRequired + 8 for nitro header
        let fimgFrame = Buffer.allocUnsafe(bytesRequired + 8);

        // Nitro headers
        fatbFrame[0] = 'B'.charCodeAt(0);
        fatbFrame[1] = 'T'.charCodeAt(0);
        fatbFrame[2] = 'A'.charCodeAt(0);
        fatbFrame[3] = 'F'.charCodeAt(0);
        fatbFrame.writeUInt32LE(fatbFrame.length, 4);

        fimgFrame[0] = 'G'.charCodeAt(0);
        fimgFrame[1] = 'M'.charCodeAt(0);
        fimgFrame[2] = 'I'.charCodeAt(0);
        fimgFrame[3] = 'F'.charCodeAt(0);
        fimgFrame.writeUInt32LE(fimgFrame.length, 4);
        let offset = 0;

        fatbFrame.writeUInt32LE(this.files.length, 8);
        this.files.forEach((file, i) => {
            let bytesRequiredForFile = (Math.ceil(file.length / 4.0) * 4);
            file.copy(fimgFrame, offset + 8, 0, file.length);
            for (let filler = file.length; filler < bytesRequiredForFile; filler++) {
                fimgFrame[offset + 8 + filler] = 0xFF;
            }
            fatbFrame.writeUInt32LE(offset, 12 + i * 8);
            fatbFrame.writeUInt32LE(offset + file.length, 16 + i * 8);
            offset += bytesRequiredForFile;
        })

        // FNTB Frame
        let bytesForFNTBFrame = 16;
        if (this.hasFilenames) {
            this.filenames.forEach(filename => {
                bytesForFNTBFrame += filename.length + 1;
            });
        }
        let fntbFrame = Buffer.allocUnsafe(bytesForFNTBFrame);

        fntbFrame[0] = 'B'.charCodeAt(0);
        fntbFrame[1] = 'T'.charCodeAt(0);
        fntbFrame[2] = 'N'.charCodeAt(0);
        fntbFrame[3] = 'F'.charCodeAt(0);
        fntbFrame.writeUInt32LE(fntbFrame.length, 4);

        if (this.hasFilenames) {
            fntbFrame.writeUInt32LE(8, 8);
            fntbFrame.writeUInt32LE(0x10000, 12);
            let fntbOffset = 16;
            this.filenames.forEach(filename => {
                let fntbfilename = Buffer.from(filename, 'ascii');
                fntbFrame[fntbOffset] = fntbfilename.length;
                fntbfilename.copy(fntbFrame, fntbOffset + 1, 0, fntbfilename.length);
                fntbOffset += 1 + fntbfilename.length;
            })
        }
        else {
            fntbFrame.writeUInt32LE(4, 8);
            fntbFrame.writeUInt32LE(0x10000, 12);
        }

        // Now for the actual Nitro file
        let nitrolength = 16 + fatbFrame.length + fntbFrame.length + fimgFrame.length;
        let nitroFile = Buffer.allocUnsafe(nitrolength);
        nitroFile[0] = 'N'.charCodeAt(0);
        nitroFile[1] = 'A'.charCodeAt(0);
        nitroFile[2] = 'R'.charCodeAt(0);
        nitroFile[3] = 'C'.charCodeAt(0);
        nitroFile.writeUInt16LE(0xFFFE, 4);
        nitroFile.writeUInt16LE(0x0100, 6);
        nitroFile.writeUInt32LE(nitrolength, 8);
        nitroFile.writeUInt16LE(0x10, 12);
        nitroFile.writeUInt16LE(3, 14);
        fatbFrame.copy(nitroFile, 16, 0, fatbFrame.length);
        fntbFrame.copy(nitroFile, 16 + fatbFrame.length, 0, fntbFrame.length);
        fimgFrame.copy(nitroFile, 16 + fatbFrame.length + fntbFrame.length, 0, fimgFrame.length);
        return nitroFile;
    }

    private readNitroFrames(data: Buffer) {

        // Read the number of frames
        let frameCount = data.readUInt16LE(0x0E);

        // each frame
        let offset = 0x10;
        let frames: { [key: string]: Buffer } = {};
        for (let i = 0; i < frameCount; i++) {
            let magic = [data[offset + 3], data[offset + 2], data[offset + 1], data[offset]];
            let magicS = magic.map(c => String.fromCharCode(c)).join('');

            let frame_size = data.readUInt32LE(offset + 4);
            // Patch for BB/VW and other DS hacks which don't update
            // the size of their expanded NARCs correctly
            if (i == frameCount - 1 && offset + frame_size < data.length) {
                frame_size = data.length - offset;
            }
            let frame = data.slice(offset + 8, offset + frame_size);
            frames[magicS] = frame;
            offset += frame_size;
        }
        return frames;
    }
}