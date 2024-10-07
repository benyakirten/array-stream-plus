import { writeFileSync } from "node:fs";

import { testPerformance } from "./stream.benchmark";

const DEFAULT_NUM_REPS = 1000;
const POWERS_OF_TENS = 7;

function generateHeader(): string {
    let firstLine = "| |";
    for (let i = 0; i < POWERS_OF_TENS; i++) {
        firstLine += ` ${10 ** i} |`;
    }

    let secondLine = "| ---: |";
    for (let i = 0; i < POWERS_OF_TENS; i++) {
        secondLine += " :---: |";
    }
    return `${firstLine}\n${secondLine}\n`;
}

function generateDataLine(
    rep: number,
    streamData: number[],
    arrayData: number[],
    itertoolsData: number[]
) {
    let line = `${10 ** rep}|`;
    for (let i = 0; i < streamData.length; i++) {
        const streamTime = streamData[i];
        const arrayTime = arrayData[i];
        const itertoolsTime = itertoolsData[i];
        line += ` ${streamTime}/${arrayTime}/ ${itertoolsTime} |`;
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

function getTestData(numReps: number) {
    let count = 0;
    let output: number[][][] = [];

    for (const data of testPerformance(numReps)) {
        output = data;
        count++;
        console.log(`Finished ${count}/${numReps} repetitions`);
    }

    return output;
}

function processArgs(args: string[]) {
    const outFile = args[0];
    if (!outFile) {
        throw new Error("No output file specified");
    }

    let numReps = Number.parseInt(args[1]);
    if (Number.isNaN(numReps)) {
        numReps = DEFAULT_NUM_REPS;
    }

    const data = getTestData(numReps);
    writeData(outFile, data);
}

processArgs(process.argv.slice(2));
