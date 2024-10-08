import { writeFileSync } from "node:fs";

import { testPerformance } from "./stream.benchmark.js";

const DEFAULT_NUM_REPS = 1000;
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

function generateDataLine(rep, streamData, arrayData, itertoolsData) {
    let line = `${10 ** rep}|`;
    for (let i = 0; i < streamData.length; i++) {
        const streamTime = roundToPlace(streamData[i], 2);
        const arrayTime = roundToPlace(arrayData[i], 2);
        const itertoolsTime = roundToPlace(itertoolsData[i], 2);
        line += ` ${streamTime}/${arrayTime}/${itertoolsTime} |`;
    }

    return `${line}\n`;
}

function writeData(file, data) {
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

function getTestData(numReps) {
    let count = 0;
    let output = [];

    for (const data of testPerformance(numReps)) {
        output = data;
        count++;
        // eslint-disable-next-line no-undef
        console.log(`Finished ${count}/${numReps} repetitions`);
    }

    return output;
}

function processArgs(args) {
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

function roundToPlace(val, place) {
    const _place = 10 ** place;
    return Math.round(val * _place) / _place;
}

// eslint-disable-next-line no-undef
processArgs(process.argv.slice(2));
