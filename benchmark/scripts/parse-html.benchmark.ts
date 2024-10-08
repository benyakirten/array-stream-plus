import { writeFileSync, readFileSync } from "node:fs";

const POWERS_OF_TENS = 7;

function generateHeader() {
    let firstCell = "| |";
    for (let i = 0; i < POWERS_OF_TENS; i++) {
        firstCell += ` ${10 ** i} |`;
    }

    let otherCells = "| ---: |";
    for (let i = 0; i < POWERS_OF_TENS; i++) {
        otherCells += " :---: |";
    }
    return `${firstCell}\n${otherCells}\n`;
}

function generateDataLine(
    rep: number,
    streamData: number[],
    arrayData: number[],
    itertoolsData: number[]
) {
    let line = `${10 ** rep}|`;
    for (let i = 0; i < streamData.length; i++) {
        const streamTime = roundToPlace(streamData[i], 2);
        const arrayTime = roundToPlace(arrayData[i], 2);
        const itertoolsTime = roundToPlace(itertoolsData[i], 2);
        line += ` ${streamTime}/${arrayTime}/${itertoolsTime} |`;
    }

    return `${line}\n`;
}

function writeData(file: string, data: number[][][]) {
    let allLines = "";

    const header = generateHeader();
    allLines += header;

    for (let i = 0; i < POWERS_OF_TENS; i++) {
        const streamData = data[0][i];
        const arrayData = data[1][i];
        const itertoolsData = data[2][i];

        const line = generateDataLine(i, streamData, arrayData, itertoolsData);
        allLines += line;
    }

    writeFileSync(file, allLines);
}

function getTbody(data: string) {
    try {
        const tbody = data.match(/<tbody>([\s\S]+)<\/tbody>/);
        if (tbody === null) {
            throw new Error();
        }
        return tbody[1];
    } catch (e) {
        throw new Error(`Unable to find table body: ${e}`);
    }
}

function getTRows(tbody: string) {
    const rows = tbody.match(/<tr>([\s\S]+?)<\/tr>/g);
    if (rows === null || rows.length === 0) {
        throw new Error("No rows found in table body");
    }

    return rows;
}

function getLineResults(row: string) {
    const cells = row.match(/<td>([\s\S]+?)<\/td>/g);
    if (cells === null || cells.length === 0) {
        throw new Error("No cells found in row");
    }

    const cellNums: number[][] = [];
    for (const cell of cells) {
        const nums: number[] = [];
        for (const split of cell.split("<span ").slice(1)) {
            const match = split.match(/>(\d+\.?(\d+)?)\/?</);
            if (match === null) {
                throw new Error(`Unable to parse cell data: ${split}`);
            }
            nums.push(Number.parseFloat(match[1]));
        }
        if (nums.length !== 0) {
            cellNums.push(nums);
        }
    }

    return cellNums;
}

function readFile(file: string) {
    const data = readFileSync(file, "utf-8");
    const tbody = getTbody(data);
    const rows = getTRows(tbody);

    const parsedData: number[][][] = [[], [], []];
    for (const row of rows) {
        const results = getLineResults(row);

        const parsedStreamRow = [];
        const parsedArrayRow = [];
        const parsedItertoolsRow = [];

        for (const result of results) {
            parsedStreamRow.push(result[0]);
            parsedArrayRow.push(result[1]);
            parsedItertoolsRow.push(result[2]);
        }

        parsedData[0].push(parsedStreamRow);
        parsedData[1].push(parsedArrayRow);
        parsedData[2].push(parsedItertoolsRow);
    }

    return parsedData;
}

function processArgs(args: string[]) {
    const inputFile = args[0];
    if (!inputFile) {
        throw new Error("No input file specified");
    }

    const outFile = args[1];
    if (!outFile) {
        throw new Error("No output file specified");
    }

    const data = readFile(inputFile);
    writeData(outFile, data);
}

function roundToPlace(val: number, place: number) {
    const _place = 10 ** place;
    return Math.round(val * _place) / _place;
}

processArgs(process.argv.slice(2));
